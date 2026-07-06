# airdesk

Ambient agency with physical authority — sign one irreversible action, not a session.

## Quick links

- [README.md](README.md) — seven-minute read
- [SPEC.md](SPEC.md) — stable contract
- [airdesk.policy.ts](airdesk.policy.ts) — config
- [proof/RECEIPTS.md](proof/RECEIPTS.md) — evidence
- [test/manifest.test.ts](test/manifest.test.ts) — deterministic checks

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  PWA/SEO │────▶│  Hono Worker │────▶│  Workflows  │
│  Surface  │     │  (svelte)    │     │  (durable)  │
└──────────┘     └──────┬───────┘     └──────┬──────┘
                        │                    │
                        ▼                    ▼
                 ┌──────────────┐     ┌─────────────┐
                 │  DO Frontier │     │  R2 Bucket  │
                 │  (WebSocket) │     │  (artifacts)│
                 └──────────────┘     └─────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  WebAuthn    │
                 │  (passkey)   │
                 └──────────────┘
```