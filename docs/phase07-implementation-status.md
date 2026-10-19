# Phase 07 — Staging implementation and acceptance record

## Scope implemented (staging only)
- Existing product CRUD, variants, stock adjustment and audit trail.
- AI knowledge per product: structured specifications, FAQ, verified information, prohibited claims, sales instructions, delivery, warranty, return and escalation.
- Approval lifecycle: draft → review → approved → published; published knowledge is readable by authenticated integration role only.
- Facebook Page content records, many-to-many product mapping, aliases for ad/creative/boosted post, mapping resolution.
- Facebook Page posts Graph API synchronization (bounded pagination), preserving existing product mappings and approved knowledge.
- HMAC SHA-256 verified Facebook comment webhook intake, idempotent D1 comment review queue. No public/private reply dispatch enabled.
- Staging admin UI at /product-admin and /ai-knowledge-admin.
- Existing Phase 06 CAPI test outbox and production website unchanged.

## Constraints and blockers
- Cloudflare staging Worker has no FACEBOOK_PAGE_ACCESS_TOKEN or FACEBOOK_PAGE_ID configured. Graph sync therefore returns 503 and cannot be live-tested.
- Meta Page API permissions, webhook subscription, and actual Facebook comment/private-reply messaging must be verified and authorized before enabling sends.
- AI generation provider integration and response preview have not been connected or end-to-end verified.
- No real Q86, Q10 or Air Fryer product records were inserted into staging.
- The webhook queues incoming comments for review and does NOT auto-reply. Do not claim live comment automation is complete.
- Meta CAPI generalized production dispatcher, privacy retention and retry hardening are separate production-readiness work.
- CI covers syntax and unauthenticated endpoint negative checks; full authenticated browser CRUD/approval workflow acceptance is still required.

## Safe testing checklist
1. Admin logs in to both staging dashboards.
2. Create synthetic product, save knowledge, review, approve and publish; verify integration role only sees published content.
3. Create two synthetic content records mapping to same product; map two products to one content; resolve aliases; verify no duplicate product creation.
4. Test signed feed webhook with a staging test signature and ensure duplicate comment ID only inserts once.
5. Confirm no outbound public/private replies without explicit authorization.
6. Confirm production Worker, D1, Meta CAPI and live website remain unchanged.
