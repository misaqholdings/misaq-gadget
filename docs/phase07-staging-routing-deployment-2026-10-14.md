# Phase 07 staging-only routing deployment — 2026-10-14

## Authorized scope
Environment: Cloudflare Worker `misaq-sales-bot-staging` only.
GitHub branch: `dev/phase06-centralized-capi`.
No production changes or real Meta replies.

## Deployment and rollback
- Original deployed staging Worker v130: `fccdaaa8-be97-4a03-853e-39d00cd5a6f5` (rollback baseline).
- First routing patch staging version v131: `899c73f1-0293-46b2-9b45-3ec981d3fa57`.
- A CI test found the original live Worker referenced `phase07CommentWebhook` but lacked its function definition, causing unsigned feed requests to return 500.
- Restored the existing HMAC SHA-256 verified feed handler from `workers/phase07-comment-webhook.mjs` inside the staging Worker while retaining Comment Review Routing.
- Final staging version: `1bf677c0-4e42-4557-a274-7bb673b51cb5`, deployment `0c36f45b-6071-48bc-8a26-bfe2df64ee76`, 100% staging traffic.
- Pre- and post-version comparison confirmed all 16 existing Worker bindings preserved, plus `fetch` and `scheduled` handlers.
- Rollback via Cloudflare deployment of the original version if needed; note that the original has the missing webhook handler issue.

## Routing
`GET /api/v1/intelligence/comments/review?id=<positive integer>`:
- Mounted **after existing staff authentication** and **before** the existing `/api/v1/intelligence/` catchall route.
- Staff admin session required, staging-only.
- Looks up existing deduplicated comment event, current product mapping, active product and published knowledge.
- Returns safe draft or human review/clarification decision; does not dispatch a Meta message.
- No database migration or modifications to order, Google Sheets, Messenger or Meta CAPI logic.

## Tests
- GitHub Actions Phase 07 Staging Product Dashboard Smoke run `38555017172`: **success** including new endpoint unauthenticated rejection.
- GitHub Actions Phase 06 Staging Code Checks run `38555021768`, re-run attempt 2: **success**.
- Phase 06 CI results: 17 existing automated tests passed; unauthenticated upstream API returned 401; unsigned feed webhook returned 403 after the fix. Other negative website-order-bridge tests passed.
- Authenticated staff scenario, valid signed webhook comment ingestion, full Q86 decision response, actual Messenger delivery and human operator acceptance remain **not tested**.
- Cloudflare deployment/API confirms final version and bindings; GitHub Action provides actual public HTTP smoke results.

## Security and follow-up
No secret values were logged, committed or sent in chat. No automatic reply behavior enabled.
The integration currently lives in the Cloudflare Worker version; GitHub has the modular sources and a documented integration point, but not a full checked-in single-file Worker bundle. Add a reproducible CI-based staging build/deploy process to prevent drift.
