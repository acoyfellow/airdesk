# airdesk SPEC — stable contract

## Identity

- **Name:** airdesk
- **Version:** 0.0.1
- **License:** MIT

## Invariants

1. **No broad session.** Every signed action manifest binds exactly one
   artifact hash, one set of powers, and one expiry. No "agent approved"
   session exists.
2. **Content-addressed authority.** A changed artifact produces a different
   hash and cannot reuse a prior signature.
3. **Dev signer is non-production.** The `DEV_SIGNER` label must never be used
   with real credentials or production artifacts.
4. **Denial is resumable.** Denying an action leaves the workflow in a
   resumable state. The operator can retry with different parameters.
5. **WebAuthn is the root.** Only passkey signatures authorize irreversible
   actions.
6. **Server challenge.** Every signature requires a server-created random
   challenge bound to the canonical manifest digest and expiry.
7. **Artifact mutation invalidates grant.** If the artifact hash changes
   after signing, the execute step rejects with 409.

## API

### POST /api/task
Submit a north star task.
- Body: `{ northStar: string, powers: string[] }`
- Returns: `{ workflowId: string }`

### GET /api/frontier/:id
Get frontier state for a task.
- Returns: `FrontierState`

### GET /api/challenge/:id
Get a WebAuthn challenge for signing.
- Returns: `{ challenge, challengeHex, challengeExpiry, rpId, rpName, origin, artifactHash, powers, evidenceRoot, alternatives, expiry }`

### POST /api/register/:id
Register a WebAuthn credential.
- Body: `{ credentialId: string, publicKeyCose: number[], signCount: number }`
- Returns: `{ ok: true }`

### POST /api/sign/:id
Sign an action with WebAuthn assertion.
- Body: `{ credentialId, clientDataJSON, authenticatorData, signature, signer }`
- Returns: `FrontierState`

### POST /api/dev-sign/:id
Dev-only signing path (only when devSigner.enabled).
- Body: `{ signature: string, signer: string }`
- Returns: `FrontierState`

### POST /api/deny/:id
Deny an action.
- Returns: `FrontierState`

### GET /api/verify/:id
Verify a signed manifest against its artifact.
- Returns: `{ verified: boolean, manifest, currentArtifactHash, expectedArtifactHash, expired: boolean, isDevSigner: boolean, status: string }`

### POST /api/mcp
MCP contract interface.
- Body: `{ method: string, params?: object }`
- Methods: `submit_task`, `get_frontier`, `get_challenge`, `register_credential`, `sign_action`, `dev_sign`, `deny_action`, `verify`

## Data model

### ActionManifest
```typescript
interface ActionManifest {
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
  challenge: string | null;
}
```

### FrontierState
```typescript
interface FrontierState {
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
```

## Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `AIRDESK_FRONTIER` | Durable Object | Living artifact/frontier state (persisted) |
| `AIRDESK_WORKFLOW` | Workflow | Sessionless durable work |
| `AIRDESK_ARTIFACTS` | R2 | Immutable signed artifacts and evidence |

## MCP contract

```typescript
interface MCPContract {
  submit_task(params: { northStar: string; powers: string[] }): { workflowId: string };
  get_frontier(params: { taskId: string }): FrontierState;
  get_challenge(params: { taskId: string }): ChallengeResponse;
  register_credential(params: { taskId: string; credentialId: string; publicKeyCose: number[]; signCount: number }): { ok: true };
  sign_action(params: { taskId: string; credentialId: string; clientDataJSON: string; authenticatorData: string; signature: string; signer: string }): FrontierState;
  dev_sign(params: { taskId: string; signature: string; signer: string }): FrontierState;
  deny_action(params: { taskId: string }): FrontierState;
  verify(params: { taskId: string }): ActionManifest;
}
```