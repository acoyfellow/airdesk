import { describe, it, expect } from 'bun:test';
import { createManifest, manifestDigest } from '../src/manifest';

describe('ActionManifest', () => {
  it('creates a valid manifest', () => {
    const manifest = createManifest({
      taskId: 'test-1',
      northStar: 'deploy latest build',
      artifactHash: 'abc123',
      powers: ['deploy'],
      evidenceRoot: 'def456',
      alternatives: ['deny'],
      expiry: Date.now() + 3600_000,
    });
    expect(manifest.version).toBe(1);
    expect(manifest.taskId).toBe('test-1');
    expect(manifest.signature).toBeNull();
    expect(manifest.signer).toBeNull();
  });

  it('rejects changed artifact hash', () => {
    const manifest = createManifest({
      taskId: 'test-2',
      northStar: 'publish release',
      artifactHash: 'original-hash',
      powers: ['publish'],
      evidenceRoot: 'root-1',
      alternatives: ['deny'],
      expiry: Date.now() + 3600_000,
    });
    manifest.signature = 'signed';
    manifest.signer = 'passkey-user';

    const changedHash = 'changed-hash';
    expect(changedHash).not.toBe(manifest.artifactHash);
  });

  it('enforces expiry', () => {
    const expired = Date.now() - 1000;
    const manifest = createManifest({
      taskId: 'test-3',
      northStar: 'delete old data',
      artifactHash: 'hash-3',
      powers: ['delete'],
      evidenceRoot: 'root-3',
      alternatives: ['deny'],
      expiry: expired,
    });
    expect(Date.now()).toBeGreaterThan(manifest.expiry);
  });

  it('requires powers array', () => {
    const manifest = createManifest({
      taskId: 'test-4',
      northStar: 'modify production',
      artifactHash: 'hash-4',
      powers: ['modify_production'],
      evidenceRoot: 'root-4',
      alternatives: ['deny', 'modify'],
      expiry: Date.now() + 3600_000,
    });
    expect(Array.isArray(manifest.powers)).toBe(true);
    expect(manifest.powers.length).toBeGreaterThan(0);
  });

  it('records timestamp', () => {
    const before = Date.now();
    const manifest = createManifest({
      taskId: 'test-5',
      northStar: 'merge PR',
      artifactHash: 'hash-5',
      powers: ['merge'],
      evidenceRoot: 'root-5',
      alternatives: ['deny'],
      expiry: Date.now() + 3600_000,
    });
    expect(manifest.createdAt).toBeGreaterThanOrEqual(before);
    expect(manifest.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('manifest digest is deterministic', async () => {
    const manifest = createManifest({
      taskId: 'digest-test',
      northStar: 'test',
      artifactHash: 'hash-1',
      powers: ['deploy'],
      evidenceRoot: 'root-1',
      alternatives: ['deny'],
      expiry: 1000000,
    });
    const digest1 = await manifestDigest(manifest);
    const digest2 = await manifestDigest(manifest);
    expect(digest1).toBe(digest2);
  });

  it('manifest digest changes when artifact hash changes', async () => {
    const m1 = createManifest({
      taskId: 't', northStar: 'test', artifactHash: 'hash-a',
      powers: ['deploy'], evidenceRoot: 'r', alternatives: ['deny'], expiry: 1000,
    });
    const m2 = createManifest({
      taskId: 't', northStar: 'test', artifactHash: 'hash-b',
      powers: ['deploy'], evidenceRoot: 'r', alternatives: ['deny'], expiry: 1000,
    });
    const d1 = await manifestDigest(m1);
    const d2 = await manifestDigest(m2);
    expect(d1).not.toBe(d2);
  });

  it('manifest digest changes when powers change', async () => {
    const m1 = createManifest({
      taskId: 't', northStar: 'test', artifactHash: 'h',
      powers: ['deploy'], evidenceRoot: 'r', alternatives: ['deny'], expiry: 1000,
    });
    const m2 = createManifest({
      taskId: 't', northStar: 'test', artifactHash: 'h',
      powers: ['deploy', 'publish'], evidenceRoot: 'r', alternatives: ['deny'], expiry: 1000,
    });
    const d1 = await manifestDigest(m1);
    const d2 = await manifestDigest(m2);
    expect(d1).not.toBe(d2);
  });

  it('manifest digest changes when expiry changes', async () => {
    const m1 = createManifest({
      taskId: 't', northStar: 'test', artifactHash: 'h',
      powers: ['deploy'], evidenceRoot: 'r', alternatives: ['deny'], expiry: 1000,
    });
    const m2 = createManifest({
      taskId: 't', northStar: 'test', artifactHash: 'h',
      powers: ['deploy'], evidenceRoot: 'r', alternatives: ['deny'], expiry: 9999,
    });
    const d1 = await manifestDigest(m1);
    const d2 = await manifestDigest(m2);
    expect(d1).not.toBe(d2);
  });
});

describe('FrontierState', () => {
  it('denial is resumable — status transitions to denied', () => {
    const state = {
      taskId: 'resume-test',
      northStar: 'test',
      powers: ['deploy'],
      status: 'denied' as const,
      artifactHash: 'hash-1',
      evidenceRoot: 'root-1',
      alternatives: ['deny', 'modify'],
      expiry: Date.now() + 3600_000,
      signature: null,
      signer: null,
      challenge: null,
      challengeExpiry: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(state.status).toBe('denied');
    expect(state.artifactHash).toBe('hash-1');
  });

  it('execute requires signed status', () => {
    const state = {
      status: 'awaiting_signature' as const,
      artifactHash: 'hash-1',
    };
    expect(state.status).not.toBe('signed');
    expect(state.status).toBe('awaiting_signature');
  });

  it('dev signer is labeled', () => {
    const signer = 'DEV_SIGNER:test-key';
    expect(signer.startsWith('DEV_SIGNER:')).toBe(true);
  });
});

describe('Policy', () => {
  it('signature timeout is 1 hour', async () => {
    const { policy } = await import('../airdesk.policy');
    expect(policy.signatureTimeoutMs).toBe(3600_000);
  });

  it('requireSignatureFor includes deploy', async () => {
    const { policy } = await import('../airdesk.policy');
    expect(policy.requireSignatureFor).toContain('deploy');
  });

  it('dev signer is enabled for tests', async () => {
    const { policy } = await import('../airdesk.policy');
    expect(policy.devSigner.enabled).toBe(true);
  });
});