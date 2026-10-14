# Phase 07 integration handoff (staging only)

## Existing architecture preserved
- Existing signed feed webhook: `workers/phase07-comment-webhook.mjs`; stores/deduplicates `facebook_comment_events`. It never sends messages.
- Existing content/product mapping: `facebook_contents`, `facebook_content_aliases`, `facebook_content_products`.
- Existing published knowledge: `product_ai_knowledge`, `products`; `resolve` now excludes unpublished knowledge.
- Comment decision: `workers/phase07-comment-intelligence.mjs` (pure, draft-only).
- Admin review API: `workers/phase07-comment-review-api.mjs` (exported, not yet mounted on host routing).
- Orders and Meta CAPI: unchanged. Confirmed Lead and Delivered Purchase must remain separate and idempotent.

## Remaining integration checklist
1. Inspect the host Worker source, its routing and staffAuth contract. Mount `phase07CommentReview` at an authenticated staging-only route, not on production.
2. Confirm exact published-knowledge schema and payment field representation; do not auto-send without passing tests.
3. Add a review UI with comment preview, source post, product mapping, version, draft, escalation reason and send audit trail.
4. Use explicit approval before any Meta reply; implement send idempotency with a durable outbound message table and retry state, not only the inbound event unique key.
5. Ensure page-authored comments and echoes cannot trigger bot loops; test signed webhooks, duplicate deliveries, unmapped and multi-product cases.
6. Make knowledge publishing version-safe: create immutable published snapshots while editing new drafts; migrate only after staging backup.
7. Run `node --test tests/phase07-comment-intelligence.test.mjs tests/phase07-comment-review.test.mjs`, then authenticated Worker integration tests.
8. Verify Meta webhook subscriptions and permissions with the owner. Never paste tokens into chat.
9. Perform staging D1 backup, migration, deployment and end-to-end tests. Obtain separate user approval before any production action.

## Status
The decision module and review API are committed to the development branch. Tests are authored but **not executed**. The review API is **not connected to the host Worker**; no staging deployment or end-to-end test is claimed. The existing live Messenger integration has not been modified.
