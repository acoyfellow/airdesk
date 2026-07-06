# Proof receipts for airdesk

## Receipt 1: Manifest creation and signing (observed)

```bash
bun test
```

Output shows 5 passing tests covering:
- Valid manifest creation
- Changed artifact hash rejection
- Expiry enforcement
- Powers array requirement
- Timestamp recording

## Receipt 2: Signature binds artifact hash (projected)

A signed manifest's `artifactHash` must match the current artifact's hash.
If the artifact changes, verification fails. This is enforced in
`src/verify.ts` and `src/frontier.ts` (execute step checks hash match).

## Receipt 3: Denial is resumable (observed)

The frontier DO transitions to `denied` status on denial. The PWA surface
shows a "Start New Task" button. No state is corrupted. Verified in
`src/frontier.ts` (`/deny` handler).

## Receipt 4: Dev signer isolation (projected)

`airdesk.policy.ts` declares `devSigner.enabled: true` with label
"DEV_SIGNER — do not use in production". Production deployments set
`devSigner.enabled: false`. No code path mixes dev and production signing.

## Receipt 5: Content-addressed authority (observed)

The manifest digest includes `artifactHash`. A changed artifact produces a
different hash. The execute step in `src/frontier.ts` checks
`manifestData.artifactHash !== this.state.artifactHash` and returns 409 if
mismatched. The verify endpoint (`src/verify.ts`) recomputes the artifact
hash and compares it to the manifest's expected hash.