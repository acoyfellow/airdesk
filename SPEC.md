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
3. **Dev signer is non-production.** The `DEV_SIGNER_KEY` must never be used
   with real credentials or production artifacts.
4. **Denial is resumable.** Denying an action leaves the workflow in a
   resumable state. The operator can retry with different parameters.
5. **WebAuthn is the root.** Only passkey signatures authorize irreversible
   actions.

## API

### POST /api/task
Submit a north star task.
- Body: `{ northStar: string, powers: string[] }`
- Returns: `{ workflowId: string }`

### GET /api/frontier/:id
Get frontier state for a task.
- Returns: `FrontierState`

### POST /api/sign/:id
Sign an action with WebAuthn.
- Body: `{ signature: string, signer: string }`
- Returns: `FrontierState`

### POST /api/deny/:id
Deny an action.
- Returns: `FrontierState`

### GET /api/verify/:id
Verify a signed manifest against its artifact.
- Returns: `{ verified: boolean, manifest, currentArtifactHash, expectedArtifactHash, expired: boolean }`

### POST /api/mcp
MCP contract interface.
- Body: `{ method: string, params?: object }`
- Methods: `submit_task`, `get_frontier`, `sign_action`, `deny_action`, `verify`

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
}
```

## Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `AIRDESK_FRONTIER` | Durable Object | Living artifact/frontier state |
| `AIRDESK_WORKFLOW` | Workflow | Sessionless durable work |
| `AIRDESK_ARTIFACTS` | R2 | Immutable signed artifacts and evidence |

## MCP contract

```typescript
interface MCPContract {
  submit_task(params: { northStar: string; powers: string[] }): { workflowId: string };
  get_frontier(params: { taskId: string }): FrontierState;
  sign_action(params: { taskId: string; signature: string; signer: string }): FrontierState;
  deny_action(params: { taskId: string }): FrontierState;
  verify(params: { taskId: string }): ActionManifest;
}
```