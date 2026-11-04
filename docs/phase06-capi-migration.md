# Phase 06 — Multi-product Meta CAPI migration (development only)

## Current production behavior (unchanged)
- Every product page loads `../js/order.js`.
- `js/order.js` posts order JSON to Google Apps Script using `mode: "no-cors"`; an opaque response does **not** prove that an order was saved.
- The product form supplies product/price through `data-product` and `data-price`.
- Browser Meta Pixel currently fires PageView; do not fire Lead at order submission or Purchase on thank-you page.
- Existing order JSON uses camelCase keys and product display names; staging Worker expects authenticated, validated snake_case product codes and an idempotency key.

## Target architecture
1. Product pages retain shared order UI and one reusable attribution library.
2. A trusted same-origin backend or protected integration bridge validates order submissions, enforces rate limits and anti-abuse, and forwards them to staging Worker using **server-side credentials only**.
3. Browser-to-backend requests must carry stable order ID, product code, quantity, customer details, fbp/fbc, attribution, and an explicit, unbundled marketing consent choice. Never place Worker integration credentials in browser JavaScript.
4. Worker validates product price from its catalog; do not trust browser total. Delivery charge must be validated independently.
5. Capture browser IP from a **verified direct request** at a trusted edge, not from user-supplied X-Forwarded-For or a Google Apps Script proxy. Browser User-Agent is likewise verified. If request origin cannot be proven, omit both.
6. Store only permitted matching fields, with bounded retention. The staging Worker currently has a disabled-by-default trusted-network capture gate.
7. Order Pending: no Meta Lead. Confirmed: enqueue Lead once. Delivered: enqueue Purchase once. Cancellation/no-response: no successful conversion.
8. Outbox dispatcher must use a server-side Meta token, preserve event_id across retries, use a test-event code only for staging, and handle unknown network outcomes without blind duplicate sends.
9. For deduplication, browser and server must use the exact same event_name and event_id **only if both emit the same business event**. Do not add a browser Lead on submit just to create a pair.
10. On successful migration, decommission the old Google Apps Script Meta conversion trigger and reconcile the existing order sheet so no double firing occurs.

## Rollout gates
- [x] Shared reusable attribution helper added in isolated branch, not loaded on production pages.
- [ ] Integration bridge design, auth, CORS, CSRF/abuse checks and verified network path.
- [ ] Map each product form to catalog product_code (Q86, Q10, air fryer, future SKUs).
- [ ] Staging end-to-end submission, confirmation, delivery and idempotency tests.
- [ ] Consent UI and privacy notice reviewed.
- [ ] Meta test-event Lead/Purchase and matching diagnostics.
- [ ] Retry/recovery, unknown outcome, observability and deduplication QA.
- [ ] User approval before production cutover.

Never merge this branch or enable live CAPI without explicit authorization.
