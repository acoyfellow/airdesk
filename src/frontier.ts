// AirDeskFrontier — Durable Object holding the living artifact/frontier state.
// One frontier per task. WebSocket-enabled for live PWA updates.

import { DurableObject } from 'cloudflare:workers';

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
  createdAt: number;
  updatedAt: number;
}

export default class AirDeskFrontier extends DurableObject<Env> {
  private state: FrontierState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.state = {
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/state') {
      return Response.json(this.state);
    }

    if (path === '/init') {
      const body = await request.json<Partial<FrontierState>>();
      this.state = { ...this.state, ...body, status: 'running', createdAt: Date.now(), updatedAt: Date.now() };
      return Response.json(this.state);
    }

    if (path === '/publish') {
      const body = await request.json<{ artifactHash: string; evidenceRoot: string; alternatives: string[]; expiry: number }>();
      this.state = {
        ...this.state,
        ...body,
        status: 'awaiting_signature',
        updatedAt: Date.now(),
      };
      return Response.json(this.state);
    }

    if (path === '/sign') {
      if (this.state.status !== 'awaiting_signature') {
        return Response.json({ error: 'not awaiting signature' }, { status: 400 });
      }
      const body = await request.json<{ signature: string; signer: string }>();
      this.state = {
        ...this.state,
        signature: body.signature,
        signer: body.signer,
        status: 'signed',
        updatedAt: Date.now(),
      };
      // Store in R2
      await this.env.AIRDESK_ARTIFACTS.put(
        `manifests/${this.state.taskId}.json`,
        JSON.stringify(this.state, null, 2),
      );
      return Response.json(this.state);
    }

    if (path === '/deny') {
      this.state = { ...this.state, status: 'denied', updatedAt: Date.now() };
      return Response.json(this.state);
    }

    if (path === '/execute') {
      if (this.state.status !== 'signed') {
        return Response.json({ error: 'not signed' }, { status: 400 });
      }
      // Verify artifact hasn't changed
      const manifest = await this.env.AIRDESK_ARTIFACTS.get(`manifests/${this.state.taskId}.json`);
      if (!manifest) {
        return Response.json({ error: 'manifest not found' }, { status: 404 });
      }
      const manifestData = JSON.parse(await manifest.text());
      if (manifestData.artifactHash !== this.state.artifactHash) {
        return Response.json({ error: 'artifact changed — signature invalid' }, { status: 409 });
      }
      this.state = { ...this.state, status: 'executed', updatedAt: Date.now() };
      return Response.json(this.state);
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  }
}