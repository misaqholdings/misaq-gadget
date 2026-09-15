// ============================================================
// MISAQ GADGET — Order form logic (shared across all products)
// Submits to a Google Apps Script Web App which appends the
// order as a row in a Google Sheet. See README.md for setup.
//
// This file is now product-agnostic — the product name and price
// come from data-product / data-price attributes on the <form>
// element itself, set individually on each product page. So when
// you add a new product, you never need to edit this file.
// ============================================================

// TODO: paste your deployed Apps Script Web App URL here.
const ORDER_ENDPOINT = "";

const form = document.getElementById("orderForm");
const PRODUCT_NAME = form.dataset.product || "Unknown Product";
const PRODUCT_PRICE = parseInt(form.dataset.price, 10) || 0;

const qtyInput = document.getElementById("quantity");
const deliveryZoneInput = document.getElementById("deliveryZone");
const colorInput = document.getElementById("color");
const sumProduct = document.getElementById("sumProduct");
const sumDelivery = document.getElementById("sumDelivery");
const sumTotal = document.getElementById("sumTotal");
const stickyPrice = document.getElementById("stickyPrice");
const formStatus = document.getElementById("formStatus");

function currentDeliveryCharge() {
  return parseInt(deliveryZoneInput.value, 10);
}

function updateSummary() {
  const qty = parseInt(qtyInput.value, 10) || 1;
  const delivery = currentDeliveryCharge();
  const productTotal = PRODUCT_PRICE * qty;
  const grandTotal = productTotal + delivery;

  sumProduct.textContent = `৳${PRODUCT_PRICE} x ${qty} = ৳${productTotal}`;
  sumDelivery.textContent = `৳${delivery}`;
  sumTotal.textContent = `৳${grandTotal}`;
  stickyPrice.textContent = `৳${grandTotal}`;
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

// ---- Color selector (সাদা / কালো, etc.) ----
document.querySelectorAll('.field .color-select .color-option[data-color]').forEach((opt) => {
  opt.addEventListener("click", () => {
    document.querySelectorAll('.field .color-select .color-option[data-color]').forEach((o) => o.classList.remove("is-selected"));
    opt.classList.add("is-selected");
    colorInput.value = opt.dataset.color;
  });
});

updateSummary();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

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

  const payload = {
    product: PRODUCT_NAME,
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    deliveryZone: delivery === 70 ? "ঢাকার ভিতরে" : "ঢাকার বাইরে",
    color: colorInput.value,
    quantity: qty,
    unitPrice: PRODUCT_PRICE,
    deliveryCharge: delivery,
    total: grandTotal,
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

    formStatus.dataset.state = "success";
    formStatus.textContent = "ধন্যবাদ! আপনার অর্ডারটি গৃহীত হয়েছে। শীঘ্রই আমরা কল করে কনফার্ম করবো।";
    form.reset();
    document.querySelectorAll('.field .color-select .color-option[data-charge]').forEach((o) => o.classList.remove("is-selected"));
    document.querySelector('.field .color-select .color-option[data-charge="70"]').classList.add("is-selected");
    deliveryZoneInput.value = "70";
    document.querySelectorAll('.field .color-select .color-option[data-color]').forEach((o) => o.classList.remove("is-selected"));
    document.querySelector('.field .color-select .color-option[data-color]').classList.add("is-selected");
    colorInput.value = document.querySelector('.field .color-select .color-option[data-color]').dataset.color;
    updateSummary();

    // Facebook Pixel: track a Lead/Purchase event here once Pixel is set up.
    // if (typeof fbq === "function") fbq('track', 'Lead');
  } catch (err) {
    formStatus.dataset.state = "error";
    formStatus.textContent =
      "দুঃখিত, অর্ডার পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে সরাসরি কল করুন।";
  }
});
