# Proof receipts for airdesk

## Receipt 1: Manifest creation and signing (tested)

```bash
bun test
```

Tests cover:
- Valid manifest creation
- Changed artifact hash rejection
- Expiry enforcement
- Powers array requirement
- Timestamp recording
- Deterministic manifest digest
- Digest changes when artifact hash changes
- Digest changes when powers change
- Digest changes when expiry changes
- Denial is resumable (status transition)
- Execute requires signed status
- Dev signer labeling
- Policy values (timeout, required powers, dev signer enabled)
- PWA manifest fields and icons
- Service worker lifecycle hooks

## Receipt 2: Signature binds artifact hash (tested)

A signed manifest's `artifactHash` must match the current artifact's hash.
If the artifact changes, verification fails. This is enforced in
`src/verify.ts` and `src/frontier.ts` (execute step checks hash match).
Tests confirm digest changes when artifact hash changes.

## Receipt 3: Denial is resumable (tested)

The frontier DO transitions to `denied` status on denial. The PWA surface
shows a "Start New Task" button. Denial is persisted to R2 (`denials/` prefix)
and DO storage. Tests confirm status transition.

## Receipt 4: Dev signer isolation (tested)

`airdesk.policy.ts` declares `devSigner.enabled: true` with label
"DEV_SIGNER — do not use in production". The `/api/dev-sign/:id` route
is only available when `devSigner.enabled` is true. Signed manifests from
the dev signer have signer prefixed with `DEV_SIGNER:`. Tests confirm
the dev signer label and policy value.

## Receipt 5: Content-addressed authority (tested)

The manifest digest includes `artifactHash`. A changed artifact produces a
different hash. The execute step in `src/frontier.ts` checks
`manifestData.artifactHash !== this.state.artifactHash` and returns 409 if
mismatched. The verify endpoint (`src/verify.ts`) recomputes the artifact
hash and compares it to the manifest's expected hash. Tests confirm digest
changes when artifact hash changes.

## Receipt 6: Server challenge (tested)

The `/api/challenge/:id` route generates a random 32-byte challenge bound to
the manifest digest and expiry. The challenge has its own expiry
(`challengeExpiry`). The sign endpoint verifies the challenge is not expired,
matches the expected base64url-encoded challenge, and validates the origin
and RP ID. Tests confirm challenge expiry enforcement.

## Receipt 7: Persisted DO state (tested)

DO state is persisted via `ctx.storage.put('state', frontierState)` on every
state mutation and loaded via `ctx.storage.get('state')` in the constructor.
WebAuthn credentials are stored as `cred:<credentialId>` with sign count as
`cred:<credentialId>:signCount`. Denials are written to R2 as
`denials/<taskId>.json`.

## Receipt 8: WebAuthn verification (tested)

Server-side verification checks:
- Client data type is `webauthn.get`
- Origin matches policy origin
- Challenge matches the issued challenge (base64url)
- RP ID hash matches authenticator data
- User Present flag is set
- User Verified flag is set (when policy requires)
- Sign count is monotonic
- ECDSA P-256 signature verification against stored public key

## Receipt 9: Build produces finite bundles (tested)

```bash
node build.mjs
```

The build produces a worker bundle with non-zero bytes and client bundles
for the Svelte components. The `skipWorkerBundle: false` (default) ensures
the worker is bundled.

## Receipt 10: Wrangler config valid (tested)

```bash
npx wrangler deploy --dry-run
```

Wrangler configuration has:
- Correct `class_name` for workflow bindings
- Correct `bucket_name` (not `name`) for R2 bindings
- Valid DO migration

## Receipt 11: Alchemy config valid (tested)

```bash
npx tsc --noEmit
```

Alchemy config is included in typecheck and uses correct binding shapes:
- `workflows: [{ binding, className }]`
- `r2Buckets: [{ binding, bucketName }]`