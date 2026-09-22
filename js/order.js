// ============================================================
// MISAQ GADGET — Order form logic (shared across all products)
// Submits to a Google Apps Script Web App which appends the
// order as a row in a Google Sheet. See README.md for setup.
//
// This file is now product-agnostic — the product name and price
// come from data-product / data-price attributes on the <form>
// element itself, set individually on each product page. So when
// you add a new product, you never need to edit this file.
//
// IMPORTANT: Delivery fee and color are NOT pre-selected by
// default. The customer must actively click one of each — this
// prevents an accidental order going through with the wrong
// delivery zone or color just because a default was silently
// selected for them.
//
// COLOR/SIZE IS OPTIONAL PER PRODUCT: if a product has no
// color/size variation, simply remove that <div class="field">
// block (and its #color hidden input) from that product's HTML.
// This script detects whether #color exists and skips all
// color-related logic and validation when it doesn't — no other
// change needed.
//
// SUCCESS FLOW: on a confirmed successful order, this redirects
// to /thank-you.html instead of showing an inline message. Order
// details (including the eventId used for Pixel/CAPI dedup) are
// stashed in sessionStorage first, and the Thank You page itself
// fires the Meta Pixel "Lead" event — firing it there (rather
// than right before this page navigates away) avoids the browser
// cutting the request off mid-flight.
// ============================================================

// TODO: paste your deployed Apps Script Web App URL here.
const ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwmTbNg3Ed4X3dlRfry7zPiWBmYSJpTyQ3_M1V_95FZBEaO-Gsdt3cJEaoUwOPAdOEgWg/exec";

const form = document.getElementById("orderForm");
const PRODUCT_NAME = form.dataset.product || "Unknown Product";
const PRODUCT_PRICE = parseInt(form.dataset.price, 10) || 0;

const qtyInput = document.getElementById("quantity");
const deliveryZoneInput = document.getElementById("deliveryZone");
const colorInput = document.getElementById("color"); // may be null — that's fine
const sumProduct = document.getElementById("sumProduct");
const sumDelivery = document.getElementById("sumDelivery");
const sumTotal = document.getElementById("sumTotal");
const stickyPrice = document.getElementById("stickyPrice");
const formStatus = document.getElementById("formStatus");

const HAS_COLOR = colorInput !== null;

// Generates a random ID for Pixel/CAPI event deduplication.
function generateEventId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "evt_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

// Returns the delivery charge as a number, or null if nothing
// has been selected yet.
function currentDeliveryCharge() {
  return deliveryZoneInput.value === "" ? null : parseInt(deliveryZoneInput.value, 10);
}

function updateSummary() {
  const qty = parseInt(qtyInput.value, 10) || 1;
  const delivery = currentDeliveryCharge();
  const productTotal = PRODUCT_PRICE * qty;

  sumProduct.textContent = `৳${PRODUCT_PRICE} x ${qty} = ৳${productTotal}`;

  if (delivery === null) {
    sumDelivery.textContent = "বেছে নিন";
    sumTotal.textContent = `৳${productTotal} + ডেলিভারি`;
    stickyPrice.textContent = `৳${productTotal}+`;
  } else {
    const grandTotal = productTotal + delivery;
    sumDelivery.textContent = `৳${delivery}`;
    sumTotal.textContent = `৳${grandTotal}`;
    stickyPrice.textContent = `৳${grandTotal}`;
  }
}

document.getElementById("qtyPlus").addEventListener("click", () => {
  qtyInput.value = Math.min(10, (parseInt(qtyInput.value, 10) || 1) + 1);
  updateSummary();
});
document.getElementById("qtyMinus").addEventListener("click", () => {
  qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  updateSummary();
});

// ---- Delivery fee selector (ঢাকার ভিতরে / বাইরে) ----
document.querySelectorAll('.field .color-select .color-option[data-charge]').forEach((opt) => {
  opt.addEventListener("click", () => {
    document.querySelectorAll('.field .color-select .color-option[data-charge]').forEach((o) => o.classList.remove("is-selected"));
    opt.classList.add("is-selected");
    deliveryZoneInput.value = opt.dataset.charge;
    updateSummary();
  });
});

// ---- Color selector (সাদা / কালো, etc.) — only wired up if this product has one ----
if (HAS_COLOR) {
  document.querySelectorAll('.field .color-select .color-option[data-color]').forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll('.field .color-select .color-option[data-color]').forEach((o) => o.classList.remove("is-selected"));
      opt.classList.add("is-selected");
      colorInput.value = opt.dataset.color;
    });
  });
}

updateSummary();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Block submission if delivery fee wasn't chosen, or (for products
  // that have color/size) if that wasn't chosen either.
  const deliveryMissing = deliveryZoneInput.value === "";
  const colorMissing = HAS_COLOR && colorInput.value === "";

  if (deliveryMissing || colorMissing) {
    formStatus.dataset.state = "error";
    formStatus.textContent = HAS_COLOR
      ? "অনুগ্রহ করে ডেলিভারি ফি এবং কালার বেছে নিন।"
      : "অনুগ্রহ করে ডেলিভারি ফি বেছে নিন।";
    return;
  }

  if (!ORDER_ENDPOINT) {
    formStatus.dataset.state = "error";
    formStatus.textContent =
      "অর্ডার সিস্টেম এখনো সংযুক্ত হয়নি। অনুগ্রহ করে সরাসরি কল করুন।";
    return;
  }

  const qty = parseInt(qtyInput.value, 10) || 1;
  const delivery = currentDeliveryCharge();
  const productTotal = PRODUCT_PRICE * qty;
  const grandTotal = productTotal + delivery;
  const eventId = generateEventId();

  const payload = {
    product: PRODUCT_NAME,
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    deliveryZone: delivery === 70 ? "ঢাকার ভিতরে" : "ঢাকার বাইরে",
    color: HAS_COLOR ? colorInput.value : "N/A",
    quantity: qty,
    unitPrice: PRODUCT_PRICE,
    deliveryCharge: delivery,
    total: grandTotal,
    eventId: eventId, // shared with the Thank You page's fbq() call for dedup
    submittedAt: new Date().toISOString(),
  };

  formStatus.dataset.state = "";
  formStatus.textContent = "পাঠানো হচ্ছে...";

  try {
    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Request failed");

    // Stash order details for the Thank You page (order summary +
    // the Pixel Lead event fires there, not here).
    try {
      sessionStorage.setItem("misaq_order", JSON.stringify({
        product: PRODUCT_NAME,
        total: grandTotal,
        quantity: qty,
        eventId: eventId,
      }));
    } catch (err) {
      // sessionStorage unavailable (private browsing etc.) — order
      // still went through fine, the Thank You page will just show
      // its generic version without the order summary.
    }

    // Path is relative to this product page's folder (e.g. q10-earbuds/),
    // so it points up to the site root's thank-you.html.
    window.location.href = "../thank-you.html";
  } catch (err) {
    formStatus.dataset.state = "error";
    formStatus.textContent =
      "দুঃখিত, অর্ডার পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে সরাসরি কল করুন।";
  }
});
