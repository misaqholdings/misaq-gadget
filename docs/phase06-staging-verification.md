# Phase 06 — Staging verification and cutover gates

This branch is **not production ready**. No GitHub Pages order submission has been rerouted.

## Implemented in the development branch
- Product codes on Q86, Q10 and air fryer forms (not added to staging catalog).
- Optional marketing consent on product forms.
- Shared order payload carries productCode and marketing_consent.
- Reusable Meta attribution helper and Node test cases.
- Standalone, not-deployed staging bridge source at workers/staging-order-bridge.mjs.

## Outstanding blockers
1. Deploy the bridge as a distinct staging Worker with TURNSTILE_SECRET, ORDER_UPSTREAM_URL and ORDER_INTEGRATION_TOKEN. Bind a rate limiter/WAF and validate direct request origins.
2. Provide a Turnstile site key on a staging-only copy of the website, integrate challenge token into the shared form, and switch staging requests to an acknowledged JSON response. Do not expose any integration secret to the browser.
3. Validate staging Worker integration authentication and make sure it accepts the exact bridge payload. The only active staging catalog product is STAGING_TEST_Q86; the bridge currently uses Q86, Q10 and AIRFRYER_6L, so catalog mapping must be resolved before real E2E submission. Do not add additional catalog products until Product Manager phase.
4. Verify authenticated PATCH pending -> confirmed -> delivered through actual API, not SQL simulation.
5. Build a restricted staging-only Meta outbox dispatcher. Current outbox contains 11 pending QA records with dispatch_enabled=0; do not replay these to Meta.
6. Verify retry, unknown-outcome handling, Meta deduplication and IP/UA retention (including copies in outbox payload JSON).
7. Run automated tests and browser acceptance checks. No tests have been executed for this branch.
8. Obtain explicit production authorization, prepare reconciliation/rollback and then disable the legacy Apps Script conversion trigger. Until then keep existing Google Apps Script integration intact.

## Business event contract
- New Pending: no successful conversion.
- Confirmed: Meta Lead once.
- Delivered: Meta Purchase once with verified value/currency.
- Cancelled/fake/no-response: never count as Lead/Purchase.

Do not merge or deploy to production before these gates pass.
