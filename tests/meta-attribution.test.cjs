// Run: node --test tests/meta-attribution.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
require("../js/meta-attribution.js");
const meta = globalThis.MisaqMetaAttribution;

test("captures valid fbp/fbc and campaign parameters", () => {
  const x = meta.attribution("https://example.com/q86?campaign_id=c1&adset_id=a1&ad_id=d1",
    "_fbp=fb.1.1720000000000.12345; _fbc=fb.1.1720000000000.XYZ", 1720000000000);
  assert.equal(x.fbp, "fb.1.1720000000000.12345");
  assert.equal(x.fbc, "fb.1.1720000000000.XYZ");
  assert.equal(x.campaign_id, "c1");
  assert.equal(x.adset_id, "a1");
  assert.equal(x.ad_id, "d1");
});

test("derives fbc from valid fbclid and rejects malformed cookie values", () => {
  const x = meta.attribution("https://example.com/q10?fbclid=abc_123",
    "_fbp=invalid; _fbc=invalid", 1720000000000);
  assert.equal(x.fbp, null);
  assert.equal(x.fbc, "fb.1.1720000000000.abc_123");
});

test("separate stable event identities for confirmed Lead and delivered Purchase", () => {
  const x = meta.eventIds("order_12345678");
  assert.equal(x.lead, "staging:order_12345678:Lead");
  assert.equal(x.purchase, "staging:order_12345678:Purchase");
  assert.notEqual(x.lead, x.purchase);
  assert.throws(() => meta.eventIds("bad id"));
});

test("consent requires a checked checkbox", () => {
  assert.equal(meta.consentGiven({querySelector: () => ({type:"checkbox",checked:true})}), true);
  assert.equal(meta.consentGiven({querySelector: () => ({type:"checkbox",checked:false})}), false);
  assert.equal(meta.consentGiven({querySelector: () => null}), false);
});
