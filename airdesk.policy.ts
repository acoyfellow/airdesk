// airdesk policy — the one obvious config file.
// Edit this to change behavior without touching source code.

export const policy = {
  // Maximum time (ms) a task can wait for human signature before expiry
  signatureTimeoutMs: 3600_000, // 1 hour

  // Powers that require human signature (others are auto-approved)
  requireSignatureFor: ['deploy', 'publish', 'merge', 'delete', 'modify_production'],

  // Maximum artifact size in bytes
  maxArtifactBytes: 10_485_760, // 10 MB

  // WebAuthn configuration
  webauthn: {
    rpName: 'airdesk',
    rpId: 'airdesk.coey.dev',
    origin: 'https://airdesk.coey.dev',
    timeoutMs: 60_000,
    userVerification: 'required' as const,
  },

  // Dev signer (explicitly non-production)
  devSigner: {
    enabled: true,
    label: 'DEV_SIGNER — do not use in production',
  },

  // R2 bucket for artifacts and evidence
  r2: {
    bucketName: 'airdesk-artifacts',
    publicUrl: 'https://airdesk-artifacts.coey.dev',
  },
} as const;

export type Policy = typeof policy;