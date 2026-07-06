// Verification handler — proves a signed manifest matches the artifact.

import type { Context } from 'hono';

export async function verifyHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const id = c.req.param('id');
  const manifestObj = await c.env.AIRDESK_ARTIFACTS.get(`manifests/${id}.json`);
  if (!manifestObj) {
    return c.json({ verified: false, error: 'manifest not found' }, 404);
  }
  const manifest = JSON.parse(await manifestObj.text());

  // Verify artifact hash matches current artifact
  const artifactObj = await c.env.AIRDESK_ARTIFACTS.get(`artifacts/${id}.json`);
  if (!artifactObj) {
    return c.json({ verified: false, error: 'artifact not found' }, 404);
  }
  const artifact = JSON.parse(await artifactObj.text());
  const artifactHash = await computeHash(JSON.stringify(artifact));

  const verified = artifactHash === manifest.artifactHash;
  return c.json({
    verified,
    manifest,
    currentArtifactHash: artifactHash,
    expectedArtifactHash: manifest.artifactHash,
    expired: manifest.expiry ? Date.now() > manifest.expiry : false,
  });
}

async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}