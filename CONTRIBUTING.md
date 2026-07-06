# Contributing to airdesk

airdesk is a small personal project shared in public. PRs are welcome
but the bar is high — see below.

## Before you open a PR

1. **Read `README.md`.** Understand the one-sentence promise and limits.
2. **Read `SPEC.md`.** The contract is the source of truth.
3. **Read `airdesk.policy.ts`.** Policy is the one obvious config file.

## Rules

- **No production code without a passing test.** Every behavioral change
  needs a deterministic check in `test/`.
- **No new dependencies without a reason.** airdesk stays thin.
- **The dev signer is non-production.** Never use `DEV_SIGNER_KEY` in
  production config.

## License

By contributing, you agree your contributions are licensed under the
same MIT license as the rest of the repo (`LICENSE`).