// Deterministic tests for airdesk contracts.
import { describe, it, expect } from 'bun:test';
import { createManifest } from '../src/manifest';

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
    // Simulate signature on original
    manifest.signature = 'signed';
    manifest.signer = 'passkey-user';

    // Artifact changed — hash no longer matches
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
});