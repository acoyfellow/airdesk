import { DurableObject } from 'cloudflare:workers';
import { policy } from '../airdesk.policy';

export interface FrontierState {
  taskId: string;
  northStar: string;
  powers: string[];
  status: 'running' | 'awaiting_signature' | 'signed' | 'denied' | 'executed';
  artifactHash: string | null;
  evidenceRoot: string | null;
  alternatives: string[];
  expiry: number | null;
  signature: string | null;
  signer: string | null;
  challenge: string | null;
  challengeExpiry: number | null;
  createdAt: number;
  updatedAt: number;
}

function defaultState(): FrontierState {
  return {
    taskId: '',
    northStar: '',
    powers: [],
    status: 'running',
    artifactHash: null,
    evidenceRoot: null,
    alternatives: [],
    expiry: null,
    signature: null,
    signer: null,
    challenge: null,
    challengeExpiry: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    bytes[i / 2] = parseInt(s.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default class AirDeskFrontier extends DurableObject<Env> {
  private mem: FrontierState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.mem = defaultState();
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<FrontierState>('state');
      if (stored) {
        this.mem = stored;
      }
    });
  }

  private async persist(): Promise<void> {
    this.mem.updatedAt = Date.now();
    await this.ctx.storage.put('state', this.mem);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/state') {
      return Response.json(this.mem);
    }

    if (path === '/init') {
      const body = await request.json<Partial<FrontierState>>();
      this.mem = { ...defaultState(), ...body, status: 'running', createdAt: Date.now(), updatedAt: Date.now() };
      await this.persist();
      return Response.json(this.mem);
    }

    if (path === '/publish') {
      const body = await request.json<{ artifactHash: string; evidenceRoot: string; alternatives: string[]; expiry: number }>();
      this.mem = {
        ...this.mem,
        ...body,
        status: 'awaiting_signature',
        updatedAt: Date.now(),
      };
      await this.persist();
      return Response.json(this.mem);
    }

    if (path === '/challenge') {
      if (this.mem.status !== 'awaiting_signature') {
        return Response.json({ error: 'not awaiting signature' }, { status: 400 });
      }
      const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
      const challenge = hex(challengeBytes);
      const challengeExpiry = Date.now() + policy.signatureTimeoutMs;
      this.mem.challenge = challenge;
      this.mem.challengeExpiry = challengeExpiry;
      await this.persist();
      return Response.json({
        challenge: base64Url(challenge),
        challengeHex: challenge,
        challengeExpiry,
        rpId: policy.webauthn.rpId,
        rpName: policy.webauthn.rpName,
        origin: policy.webauthn.origin,
        artifactHash: this.mem.artifactHash,
        powers: this.mem.powers,
        evidenceRoot: this.mem.evidenceRoot,
        alternatives: this.mem.alternatives,
        expiry: this.mem.expiry,
      });
    }

    if (path === '/register') {
      const body = await request.json<{ credentialId: string; publicKeyCose: number[]; signCount: number }>();
      const credentialId = body.credentialId;
      const publicKeyCose = new Uint8Array(body.publicKeyCose);
      const stored = await this.ctx.storage.get<Uint8Array>(`cred:${credentialId}`);
      if (stored) {
        return Response.json({ error: 'credential already registered' }, { status: 409 });
      }
      await this.ctx.storage.put(`cred:${credentialId}`, publicKeyCose);
      await this.ctx.storage.put(`cred:${credentialId}:signCount`, body.signCount);
      return Response.json({ ok: true });
    }

    if (path === '/sign') {
      if (this.mem.status !== 'awaiting_signature') {
        return Response.json({ error: 'not awaiting signature' }, { status: 400 });
      }
      if (!this.mem.challenge || !this.mem.challengeExpiry) {
        return Response.json({ error: 'no challenge issued' }, { status: 400 });
      }
      if (Date.now() > this.mem.challengeExpiry) {
        this.mem.challenge = null;
        this.mem.challengeExpiry = null;
        await this.persist();
        return Response.json({ error: 'challenge expired' }, { status: 400 });
      }

      const body = await request.json<{
        credentialId: string;
        clientDataJSON: string;
        authenticatorData: string;
        signature: string;
        signer: string;
      }>();

      const { credentialId, clientDataJSON, authenticatorData, signature: assertionSig, signer } = body;

      const storedKey = await this.ctx.storage.get<Uint8Array>(`cred:${credentialId}`);
      if (!storedKey) {
        return Response.json({ error: 'unknown credential' }, { status: 401 });
      }

      const storedSignCount = (await this.ctx.storage.get<number>(`cred:${credentialId}:signCount`)) ?? 0;

      const clientDataBytes = fromHex(clientDataJSON);
      const authDataBytes = fromHex(authenticatorData);
      const sigBytes = fromHex(assertionSig);

      let clientData: { type: string; challenge: string; origin: string };
      try {
        clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
      } catch {
        return Response.json({ error: 'invalid clientDataJSON' }, { status: 400 });
      }

      if (clientData.type !== 'webauthn.get') {
        return Response.json({ error: 'invalid clientData type' }, { status: 400 });
      }
      if (clientData.origin !== policy.webauthn.origin) {
        return Response.json({ error: 'origin mismatch' }, { status: 400 });
      }

      const expectedChallenge = base64Url(this.mem.challenge);
      if (clientData.challenge !== expectedChallenge) {
        return Response.json({ error: 'challenge mismatch' }, { status: 400 });
      }

      const rpIdHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(policy.webauthn.rpId));
      const rpIdHashHex = hex(new Uint8Array(rpIdHash));
      const authDataHex = hex(authDataBytes);
      if (!authDataHex.startsWith(rpIdHashHex)) {
        return Response.json({ error: 'RP ID mismatch in authenticator data' }, { status: 400 });
      }

      const flags = authDataBytes[32];
      const userPresent = (flags & 0x01) !== 0;
      const userVerified = (flags & 0x04) !== 0;
      if (!userPresent) {
        return Response.json({ error: 'user not present' }, { status: 400 });
      }
      if (policy.webauthn.userVerification === 'required' && !userVerified) {
        return Response.json({ error: 'user verification required' }, { status: 400 });
      }

      const signCount = new DataView(authDataBytes.buffer, authDataBytes.byteOffset + 33, 4).getUint32(0);
      if (signCount !== 0 && signCount <= storedSignCount) {
        return Response.json({ error: 'sign count not monotonic' }, { status: 400 });
      }
      await this.ctx.storage.put(`cred:${credentialId}:signCount`, signCount);

      const sigBase = new Uint8Array(authDataBytes.length + clientDataBytes.length);
      sigBase.set(authDataBytes);
      sigBase.set(clientDataBytes, authDataBytes.length);

      const valid = await this.verifySignature(storedKey, sigBase, sigBytes);
      if (!valid) {
        return Response.json({ error: 'signature verification failed' }, { status: 401 });
      }

      this.mem = {
        ...this.mem,
        signature: assertionSig,
        signer,
        status: 'signed',
        challenge: null,
        challengeExpiry: null,
        updatedAt: Date.now(),
      };
      await this.env.AIRDESK_ARTIFACTS.put(
        `manifests/${this.mem.taskId}.json`,
        JSON.stringify(this.mem, null, 2),
      );
      await this.persist();
      return Response.json(this.mem);
    }

    if (path === '/dev-sign') {
      if (this.mem.status !== 'awaiting_signature') {
        return Response.json({ error: 'not awaiting signature' }, { status: 400 });
      }
      if (!policy.devSigner.enabled) {
        return Response.json({ error: 'dev signer disabled' }, { status: 403 });
      }
      const body = await request.json<{ signature: string; signer: string }>();
      this.mem = {
        ...this.mem,
        signature: body.signature,
        signer: `DEV_SIGNER:${body.signer}`,
        status: 'signed',
        challenge: null,
        challengeExpiry: null,
        updatedAt: Date.now(),
      };
      await this.env.AIRDESK_ARTIFACTS.put(
        `manifests/${this.mem.taskId}.json`,
        JSON.stringify(this.mem, null, 2),
      );
      await this.persist();
      return Response.json(this.mem);
    }

    if (path === '/deny') {
      this.mem = {
        ...this.mem,
        status: 'denied',
        challenge: null,
        challengeExpiry: null,
        updatedAt: Date.now(),
      };
      await this.env.AIRDESK_ARTIFACTS.put(
        `denials/${this.mem.taskId}.json`,
        JSON.stringify(this.mem, null, 2),
      );
      await this.persist();
      return Response.json(this.mem);
    }

    if (path === '/execute') {
      if (this.mem.status !== 'signed') {
        return Response.json({ error: 'not signed' }, { status: 400 });
      }
      const manifest = await this.env.AIRDESK_ARTIFACTS.get(`manifests/${this.mem.taskId}.json`);
      if (!manifest) {
        return Response.json({ error: 'manifest not found' }, { status: 404 });
      }
      const manifestData = JSON.parse(await manifest.text());
      if (manifestData.artifactHash !== this.mem.artifactHash) {
        return Response.json({ error: 'artifact changed — signature invalid' }, { status: 409 });
      }
      this.mem = { ...this.mem, status: 'executed', updatedAt: Date.now() };
      await this.persist();
      return Response.json(this.mem);
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  }

  private async verifySignature(publicKeyCose: Uint8Array, data: Uint8Array, sig: Uint8Array): Promise<boolean> {
    try {
      const rawKey = this.coseToRaw(publicKeyCose);
      const key = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, data);
    } catch {
      return false;
    }
  }

  private coseToRaw(cose: Uint8Array): Uint8Array {
    if (cose[0] !== 0x02) {
      throw new Error('only uncompressed EC2 keys supported');
    }
    const raw = new Uint8Array(65);
    raw[0] = 0x04;
    raw.set(cose.slice(1, 33), 1);
    raw.set(cose.slice(33, 65), 33);
    return raw;
  }
}