// Action manifest — the signed document binding action, artifact, powers, and expiry.

export interface ActionManifest {
  version: 1;
  taskId: string;
  northStar: string;
  artifactHash: string;
  powers: string[];
  evidenceRoot: string;
  alternatives: string[];
  expiry: number;
  createdAt: number;
  signature: string | null;
  signer: string | null;
}

export function createManifest(params: {
  taskId: string;
  northStar: string;
  artifactHash: string;
  powers: string[];
  evidenceRoot: string;
  alternatives: string[];
  expiry: number;
}): ActionManifest {
  return {
    version: 1,
    ...params,
    createdAt: Date.now(),
    signature: null,
    signer: null,
  };
}

export async function manifestDigest(manifest: ActionManifest): Promise<string> {
  const payload = JSON.stringify({
    version: manifest.version,
    taskId: manifest.taskId,
    artifactHash: manifest.artifactHash,
    powers: manifest.powers.sort(),
    evidenceRoot: manifest.evidenceRoot,
    expiry: manifest.expiry,
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}