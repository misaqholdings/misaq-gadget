/**
 * MISAQ Gadget — reusable Meta attribution utilities (Phase 06 staging).
 * Not loaded by production pages until the staged order migration is approved.
 * No Lead or Purchase browser event is emitted by this module.
 */
(function (root) {
  "use strict";
  const getCookie = (name, cookieText) => {
    const entry = String(cookieText || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
    if (!entry) return null;
    try { return decodeURIComponent(entry.slice(name.length + 1)); } catch (_) { return null; }
  };
  const validFbp = v => typeof v === "string" && /^fb\.1\.\d{8,16}\.\d{1,30}$/.test(v);
  const validFbc = v => typeof v === "string" && /^fb\.1\.\d{8,16}\.[A-Za-z0-9_-]{1,150}$/.test(v);
  function attribution(url, cookies, nowMs) {
    const u = new URL(url);
    const fbp = getCookie("_fbp", cookies);
    const cookieFbc = getCookie("_fbc", cookies);
    const fbclid = u.searchParams.get("fbclid");
    const derivedFbc = fbclid && /^[A-Za-z0-9_-]{1,150}$/.test(fbclid)
      ? "fb.1." + String(Math.floor(nowMs)) + "." + fbclid : null;
    return {
      fbp: validFbp(fbp) ? fbp : null,
      fbc: validFbc(cookieFbc) ? cookieFbc : (validFbc(derivedFbc) ? derivedFbc : null),
      campaign_id: u.searchParams.get("campaign_id") || null,
      adset_id: u.searchParams.get("adset_id") || null,
      ad_id: u.searchParams.get("ad_id") || null
    };
  }
  function eventIds(orderId) {
    if (typeof orderId !== "string" || !/^[A-Za-z0-9:_-]{8,128}$/.test(orderId)) throw new Error("Invalid stable order ID");
    return { lead: "staging:" + orderId + ":Lead", purchase: "staging:" + orderId + ":Purchase" };
  }
  function consentGiven(form) {
    const checkbox = form && form.querySelector('[name="marketing_consent"]');
    return Boolean(checkbox && checkbox.type === "checkbox" && checkbox.checked);
  }
  root.MisaqMetaAttribution = Object.freeze({ attribution, eventIds, consentGiven });
})(typeof window !== "undefined" ? window : globalThis);
