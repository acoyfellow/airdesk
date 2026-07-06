# airdesk — ambient agency with physical authority

## Pain

Agents either trap humans in chat supervision or receive dangerously broad
standing authority. The human should authorize **consequences**, not watch labor.

## Promise

> `airdesk` runs a north star sessionlessly across cloud and local surfaces,
> then asks for **one signed human decision** bound to the exact irreversible action.

## Quick start

```bash
git clone https://github.com/acoyfellow/airdesk
cd airdesk
bun install
bun run build
bun run dev
```

Open `http://localhost:8787`. Enter a north star and powers. Watch the task
execute. When it reaches the signature gate, approve with a passkey or deny.

## How it works

```
Task submitted → Workflow executes → Artifact published
  → WebAuthn challenge: hash + powers + evidence + alternatives + expiry
  → Human approves with passkey → Signature bound to exact artifact
  → Changed artifact cannot reuse signature → Executed
  → Denial leaves loop safely resumable
```

**Load-bearing primitives:**
- **Durable Object + WebSockets** — living artifact/frontier state
- **Workflows** — sessionless durable work execution
- **WebAuthn / COSE** — human identity and signed action manifests
- **R2** — immutable signed artifacts and evidence
- **MCP contracts** — local/physical capabilities without ambient authority

## Proof

```bash
bun test                    # deterministic contract checks
curl https://airdesk.coey.dev/api/verify/<taskId>  # verify signed manifest
```

See `proof/` for replayable receipts and `test/` for deterministic checks.

## Limits

- No broad "agent approved" session exists. Every action is individually signed.
- The dev signer (`DEV_SIGNER_KEY`) is explicitly non-production.
- WebAuthn is the only identity mechanism.
- Only powers listed in `airdesk.policy.ts` require signature.

## Policy

Edit `airdesk.policy.ts` — the one obvious config file. Change signature
timeouts, required powers, WebAuthn settings, and R2 bucket config.

## What this makes possible

airdesk is the physical authority layer in the Loop Up stack. Combined with
BACKWARDS (compilation), Temper (hammers), Deja (instinct), and MANYFACE
(adversarial synthesis), it completes the thin machine: destination, hammer,
acquired instinct, adversarial proof, and physical intent — all without a
single broad "agent approved" session.