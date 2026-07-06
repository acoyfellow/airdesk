# Security

## Reporting a vulnerability

airdesk is a personal project that authorizes irreversible actions via
signed human decisions. A class of vulnerability that matters here includes:

- Anything that lets an agent or third party obtain a signed action manifest
  for an artifact the human did not review.
- Anything that lets a changed artifact reuse a previously signed manifest.
- Anything that exposes WebAuthn credentials or signing keys outside the
  operator's browser or device.
- Anything that bypasses the denial path and leaves the loop in an
  unrecoverable state.

If you find something in any of those categories, please email the
maintainer privately rather than opening a public issue.

## Threat model assumptions

- The WebAuthn credential is the root of authority. An attacker who can
  register their own credential can authorize any action.
- The signed action manifest is a bearer proof. An attacker who obtains it
  can present it to any verifier before it expires.
- The dev signer (`DEV_SIGNER_KEY`) is explicitly non-production. It must
  never be used with real credentials or production artifacts.
- Artifact integrity is content-addressed. A changed artifact produces a
  different hash and cannot reuse a prior signature.

## What's NOT a vulnerability

- An agent that completes its task without requiring human intervention.
  That is the design — only the irreversible action needs a signature.
- The fact that `airdesk.policy.ts` is editable. Policy is the config file;
  the operator owns it.