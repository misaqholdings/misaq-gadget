// ============================================================
// MISAQ GADGET — Order form logic
// Submits to a Google Apps Script Web App which appends the
// order as a row in a Google Sheet. See README.md for setup.
// ============================================================

// TODO: paste your deployed Apps Script Web App URL here.
const ORDER_ENDPOINT = "";

const PRODUCT_PRICE = 950;

const form = document.getElementById("orderForm");
const qtyInput = document.getElementById("quantity");
const districtSelect = document.getElementById("district");
const colorInput = document.getElementById("color");
const colorOptions = document.querySelectorAll(".color-option");
const sumProduct = document.getElementById("sumProduct");
const sumDelivery = document.getElementById("sumDelivery");
const sumTotal = document.getElementById("sumTotal");
const stickyPrice = document.getElementById("stickyPrice");
const formStatus = document.getElementById("formStatus");

function currentDeliveryCharge() {
  const opt = districtSelect.options[districtSelect.selectedIndex];
  return parseInt(opt.dataset.charge, 10);
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
districtSelect.addEventListener("change", updateSummary);

colorOptions.forEach((opt) => {
  opt.addEventListener("click", () => {
    colorOptions.forEach((o) => o.classList.remove("is-selected"));
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
    product: "Q10 HiFi Stereo Sports Earbuds",
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    district: districtSelect.value === "dhaka" ? "ঢাকার ভিতরে" : "ঢাকার বাইরে",
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
    // Sent as text/plain to avoid a CORS preflight request, which the
    // Apps Script web app endpoint does not handle. The script still
    // reads it as JSON on the server side.
    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Request failed");

    formStatus.dataset.state = "success";
    formStatus.textContent = "ধন্যবাদ! আপনার অর্ডারটি গৃহীত হয়েছে। শীঘ্রই আমরা কল করে কনফার্ম করবো।";
    form.reset();
    colorOptions.forEach((o) => o.classList.remove("is-selected"));
    colorOptions[0].classList.add("is-selected");
    colorInput.value = colorOptions[0].dataset.color;
    updateSummary();

    // Facebook Pixel: track a Lead/Purchase event here once Pixel is set up.
    // if (typeof fbq === "function") fbq('track', 'Lead');
  } catch (err) {
    formStatus.dataset.state = "error";
    formStatus.textContent =
      "দুঃখিত, অর্ডার পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে সরাসরি কল করুন।";
  }
});
