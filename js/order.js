// ============================================================
// MISAQ GADGET — Order Form Logic
// Shared across all products
// ============================================================
//
// PRODUCT-AGNOSTIC:
// Product name and price come from data-product / data-price
// attributes on the <form> element.
//
// ATTRIBUTION:
// Tracks where the website order came from:
// - paid_meta
// - organic_meta
// - organic_search
// - direct
// - unknown
//
// For Meta Ads, Campaign ID / Ad Set ID / Ad ID are captured
// from URL parameters and submitted with the order.
//
// IMPORTANT:
// Order submission itself does NOT represent a verified Lead.
// Google Sheet Confirmation = Confirm is the verified Lead stage.
//
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const ORDER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwmTbNg3Ed4X3dlRfry7zPiWBmYSJpTyQ3_M1V_95FZBEaO-Gsdt3cJEaoUwOPAdOEgWg/exec";


// ============================================================
// PRODUCT / FORM SETUP
// ============================================================

const form =
  document.getElementById("orderForm");

const PRODUCT_NAME =
  form.dataset.product ||
  "Unknown Product";

const PRODUCT_PRICE =
  parseInt(
    form.dataset.price,
    10
  ) || 0;


const qtyInput =
  document.getElementById(
    "quantity"
  );

const deliveryZoneInput =
  document.getElementById(
    "deliveryZone"
  );

const colorInput =
  document.getElementById(
    "color"
  );

const sumProduct =
  document.getElementById(
    "sumProduct"
  );

const sumDelivery =
  document.getElementById(
    "sumDelivery"
  );

const sumTotal =
  document.getElementById(
    "sumTotal"
  );

const stickyPrice =
  document.getElementById(
    "stickyPrice"
  );

const formStatus =
  document.getElementById(
    "formStatus"
  );


const HAS_COLOR =
  colorInput !== null;


// ============================================================
// EVENT ID
// ============================================================
//
// Generates a unique ID for the order.
//
// The same underlying order EventID is stored in Google Sheet.
// Lead and Purchase server events later use:
//
// lead_<EventID>
// purchase_<EventID>
//
// ============================================================

function generateEventId() {

  if (
    window.crypto &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();

  }

  return (
    "evt_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


// ============================================================
// ATTRIBUTION TRACKING
// ============================================================
//
// Source:
// website
//
// Acquisition:
// paid_meta
// organic_meta
// organic_search
// direct
// unknown
//
// Meta Ad identifiers:
// campaignId
// adSetId
// adId
//
// ============================================================


function getCurrentUrlParams() {

  return new URLSearchParams(
    window.location.search
  );

}


// ------------------------------------------------------------
// Safely read URL parameter
// ------------------------------------------------------------

function getUrlParam(
  params,
  name
) {

  return String(
    params.get(name) || ""
  ).trim();

}


// ------------------------------------------------------------
// Determine whether hostname belongs to Meta
// ------------------------------------------------------------

function isMetaReferrer(
  hostname
) {

  hostname =
    String(hostname || "")
      .toLowerCase();

  return (
    hostname === "facebook.com" ||
    hostname.endsWith(
      ".facebook.com"
    ) ||
    hostname === "instagram.com" ||
    hostname.endsWith(
      ".instagram.com"
    ) ||
    hostname === "l.facebook.com" ||
    hostname === "lm.facebook.com"
  );

}


// ------------------------------------------------------------
// Determine whether hostname belongs to a search engine
// ------------------------------------------------------------

function isSearchReferrer(
  hostname
) {

  hostname =
    String(hostname || "")
      .toLowerCase();

  return (
    hostname.includes(
      "google."
    ) ||
    hostname.includes(
      "bing."
    ) ||
    hostname.includes(
      "yahoo."
    ) ||
    hostname.includes(
      "duckduckgo."
    )
  );

}


// ------------------------------------------------------------
// Capture attribution from current landing URL
// ------------------------------------------------------------

function captureAttribution() {

  const params =
    getCurrentUrlParams();


  const utmSource =
    getUrlParam(
      params,
      "utm_source"
    ).toLowerCase();


  const utmMedium =
    getUrlParam(
      params,
      "utm_medium"
    ).toLowerCase();


  const campaignId =
    getUrlParam(
      params,
      "campaign_id"
    );


  const adSetId =
    getUrlParam(
      params,
      "adset_id"
    );


  const adId =
    getUrlParam(
      params,
      "ad_id"
    );


  const fbclid =
    getUrlParam(
      params,
      "fbclid"
    );


  let acquisition =
    "unknown";


  // ----------------------------------------------------------
  // 1. PAID META
  //
  // Strongest signal:
  // Meta campaign/ad identifiers supplied through the Ad URL.
  // ----------------------------------------------------------

  const hasMetaAdIds =
    campaignId !== "" ||
    adSetId !== "" ||
    adId !== "";


  const isMetaSource =
    utmSource === "facebook" ||
    utmSource === "instagram" ||
    utmSource === "meta" ||
    utmSource === "fb" ||
    utmSource === "ig";


  const isPaidMedium =
    utmMedium === "paid" ||
    utmMedium === "paid_social" ||
    utmMedium === "cpc" ||
    utmMedium === "ppc";


  if (
    hasMetaAdIds
  ) {

    acquisition =
      "paid_meta";

  }


  // ----------------------------------------------------------
  // 2. Meta UTM explicitly says paid
  // ----------------------------------------------------------

  else if (
    isMetaSource &&
    isPaidMedium
  ) {

    acquisition =
      "paid_meta";

  }


  // ----------------------------------------------------------
  // 3. Organic Meta UTM
  // ----------------------------------------------------------

  else if (
    isMetaSource
  ) {

    acquisition =
      "organic_meta";

  }


  // ----------------------------------------------------------
  // 4. Explicit organic search UTM
  // ----------------------------------------------------------

  else if (
    utmMedium === "organic"
  ) {

    acquisition =
      "organic_search";

  }


    // ----------------------------------------------------------
  // 5. Referrer fallback
  // ----------------------------------------------------------

  else if (
    document.referrer
  ) {

    try {

      const referrerUrl =
        new URL(
          document.referrer
        );

      const referrerHost =
        referrerUrl.hostname
          .toLowerCase();

      const currentHost =
        window.location.hostname
          .toLowerCase();


      // ------------------------------------------------------
      // Internal website navigation
      //
      // Example:
      // homepage → Q86 product page
      //
      // This is not a new acquisition source.
      // Treat as direct when no previous attribution exists.
      // ------------------------------------------------------

      if (
        referrerHost === currentHost
      ) {

        acquisition =
          "direct";

      }


      // ------------------------------------------------------
      // Facebook / Instagram organic referral
      // ------------------------------------------------------

      else if (
        isMetaReferrer(
          referrerHost
        )
      ) {

        acquisition =
          "organic_meta";

      }


      // ------------------------------------------------------
      // Search engine organic referral
      // ------------------------------------------------------

      else if (
        isSearchReferrer(
          referrerHost
        )
      ) {

        acquisition =
          "organic_search";

      }


      // ------------------------------------------------------
      // Other external referral
      // ------------------------------------------------------

      else {

        acquisition =
          "unknown";

      }

    } catch (err) {

      acquisition =
        "unknown";

    }

  }


  // ----------------------------------------------------------
  // 6. No campaign information and no referrer
  // ----------------------------------------------------------

  else {

    acquisition =
      "direct";

  }


  // ----------------------------------------------------------
  // 6. No campaign information and no referrer
  // ----------------------------------------------------------

  else {

    acquisition =
      "direct";

  }


  const attribution = {

    acquisition:
      acquisition,

    campaignId:
      campaignId,

    adSetId:
      adSetId,

    adId:
      adId,

    fbclid:
      fbclid,

    utmSource:
      utmSource,

    utmMedium:
      utmMedium

  };


  // ----------------------------------------------------------
  // Preserve attribution during this browser session
  // ----------------------------------------------------------

  try {

    sessionStorage.setItem(
      "misaq_attribution",
      JSON.stringify(
        attribution
      )
    );

  } catch (err) {

    // Storage unavailable.
    // Do not interrupt order flow.

  }


  return attribution;

}


// ------------------------------------------------------------
// Get attribution for current order
// ------------------------------------------------------------

function getAttribution() {

  const params =
    getCurrentUrlParams();


  const hasCurrentAttribution =
    params.has(
      "campaign_id"
    ) ||
    params.has(
      "adset_id"
    ) ||
    params.has(
      "ad_id"
    ) ||
    params.has(
      "fbclid"
    ) ||
    params.has(
      "utm_source"
    ) ||
    params.has(
      "utm_medium"
    );


  // ----------------------------------------------------------
  // Current URL attribution gets priority
  // ----------------------------------------------------------

  if (
    hasCurrentAttribution
  ) {

    return captureAttribution();

  }


  // ----------------------------------------------------------
  // Otherwise reuse attribution already captured
  // during this browser session.
  // ----------------------------------------------------------

  try {

    const stored =
      sessionStorage.getItem(
        "misaq_attribution"
      );


    if (
      stored
    ) {

      const parsed =
        JSON.parse(
          stored
        );


      if (
        parsed &&
        typeof parsed === "object"
      ) {

        return {

          acquisition:
            parsed.acquisition ||
            "unknown",

          campaignId:
            parsed.campaignId ||
            "",

          adSetId:
            parsed.adSetId ||
            "",

          adId:
            parsed.adId ||
            "",

          fbclid:
            parsed.fbclid ||
            "",

          utmSource:
            parsed.utmSource ||
            "",

          utmMedium:
            parsed.utmMedium ||
            ""

        };

      }

    }

  } catch (err) {

    // Ignore malformed or unavailable storage.

  }


  // ----------------------------------------------------------
  // No stored attribution exists.
  // Detect from referrer/direct visit.
  // ----------------------------------------------------------

  return captureAttribution();

}


// Capture attribution as soon as order.js loads.

const ORDER_ATTRIBUTION =
  getAttribution();


// ============================================================
// DELIVERY CHARGE
// ============================================================
//
// Returns delivery charge as a number.
//
// Returns null when customer has not selected a delivery zone.
//
// ============================================================

function currentDeliveryCharge() {

  return (
    deliveryZoneInput.value === ""
      ? null
      : parseInt(
          deliveryZoneInput.value,
          10
        )
  );

}


// ============================================================
// ORDER SUMMARY
// ============================================================

function updateSummary() {

  const qty =
    parseInt(
      qtyInput.value,
      10
    ) || 1;


  const delivery =
    currentDeliveryCharge();


  const productTotal =
    PRODUCT_PRICE * qty;


  sumProduct.textContent =
    `৳${PRODUCT_PRICE} x ${qty} = ৳${productTotal}`;


  if (
    delivery === null
  ) {

    sumDelivery.textContent =
      "বেছে নিন";

    sumTotal.textContent =
      `৳${productTotal} + ডেলিভারি`;

    stickyPrice.textContent =
      `৳${productTotal}+`;

  }

  else {

    const grandTotal =
      productTotal +
      delivery;


    sumDelivery.textContent =
      `৳${delivery}`;

    sumTotal.textContent =
      `৳${grandTotal}`;

    stickyPrice.textContent =
      `৳${grandTotal}`;

  }

}


// ============================================================
// QUANTITY CONTROLS
// ============================================================

document
  .getElementById(
    "qtyPlus"
  )
  .addEventListener(
    "click",
    () => {

      qtyInput.value =
        Math.min(
          10,
          (
            parseInt(
              qtyInput.value,
              10
            ) || 1
          ) + 1
        );


      updateSummary();

    }
  );


document
  .getElementById(
    "qtyMinus"
  )
  .addEventListener(
    "click",
    () => {

      qtyInput.value =
        Math.max(
          1,
          (
            parseInt(
              qtyInput.value,
              10
            ) || 1
          ) - 1
        );


      updateSummary();

    }
  );


// ============================================================
// DELIVERY ZONE SELECTOR
// ============================================================

document
  .querySelectorAll(
    '.field .color-select .color-option[data-charge]'
  )
  .forEach(
    (opt) => {

      opt.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              '.field .color-select .color-option[data-charge]'
            )
            .forEach(
              (o) =>
                o.classList.remove(
                  "is-selected"
                )
            );


          opt.classList.add(
            "is-selected"
          );


          deliveryZoneInput.value =
            opt.dataset.charge;


          updateSummary();

        }
      );

    }
  );


// ============================================================
// COLOR / SIZE SELECTOR
// ============================================================
//
// Only active when this product has a #color hidden input.
//
// ============================================================

if (
  HAS_COLOR
) {

  document
    .querySelectorAll(
      '.field .color-select .color-option[data-color]'
    )
    .forEach(
      (opt) => {

        opt.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                '.field .color-select .color-option[data-color]'
              )
              .forEach(
                (o) =>
                  o.classList.remove(
                    "is-selected"
                  )
              );


            opt.classList.add(
              "is-selected"
            );


            colorInput.value =
              opt.dataset.color;

          }
        );

      }
    );

}


// Initial summary
updateSummary();


// ============================================================
// ORDER SUBMISSION
// ============================================================

form.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();


    // --------------------------------------------------------
    // Validate delivery / color selection
    // --------------------------------------------------------

    const deliveryMissing =
      deliveryZoneInput.value === "";


    const colorMissing =
      HAS_COLOR &&
      colorInput.value === "";


    if (
      deliveryMissing ||
      colorMissing
    ) {

      formStatus.dataset.state =
        "error";


      formStatus.textContent =
        HAS_COLOR
          ? "অনুগ্রহ করে ডেলিভারি ফি এবং কালার বেছে নিন।"
          : "অনুগ্রহ করে ডেলিভারি ফি বেছে নিন।";


      return;

    }


    // --------------------------------------------------------
    // Validate endpoint
    // --------------------------------------------------------

    if (
      !ORDER_ENDPOINT
    ) {

      formStatus.dataset.state =
        "error";


      formStatus.textContent =
        "অর্ডার সিস্টেম এখনো সংযুক্ত হয়নি। অনুগ্রহ করে সরাসরি কল করুন।";


      return;

    }


    // --------------------------------------------------------
    // Calculate order
    // --------------------------------------------------------

    const qty =
      parseInt(
        qtyInput.value,
        10
      ) || 1;


    const delivery =
      currentDeliveryCharge();


    const productTotal =
      PRODUCT_PRICE * qty;


    const grandTotal =
      productTotal +
      delivery;


    const eventId =
      generateEventId();


    // --------------------------------------------------------
    // Build order payload
    // --------------------------------------------------------

    const payload = {

      product:
        PRODUCT_NAME,

      name:
        document
          .getElementById(
            "name"
          )
          .value,

      phone:
        document
          .getElementById(
            "phone"
          )
          .value,

      address:
        document
          .getElementById(
            "address"
          )
          .value,

      deliveryZone:
        delivery === 70
          ? "ঢাকার ভিতরে"
          : "ঢাকার বাইরে",

      color:
        HAS_COLOR
          ? colorInput.value
          : "N/A",

      quantity:
        qty,

      unitPrice:
        PRODUCT_PRICE,

      deliveryCharge:
        delivery,

      total:
        grandTotal,

      eventId:
        eventId,


      // ------------------------------------------------------
      // Channel
      // ------------------------------------------------------

      source:
        "website",


      // ------------------------------------------------------
      // Acquisition attribution
      // ------------------------------------------------------

      acquisition:
        ORDER_ATTRIBUTION.acquisition,

      campaignId:
        ORDER_ATTRIBUTION.campaignId,

      adSetId:
        ORDER_ATTRIBUTION.adSetId,

      adId:
        ORDER_ATTRIBUTION.adId,


      submittedAt:
        new Date()
          .toISOString()

    };


    // --------------------------------------------------------
    // Show submitting state
    // --------------------------------------------------------

    formStatus.dataset.state =
      "";


    formStatus.textContent =
      "পাঠানো হচ্ছে...";


    // ========================================================
    // SEND ORDER
    // ========================================================

    try {

      // ------------------------------------------------------
      // no-cors:
      //
      // Apps Script redirects its response through
      // script.googleusercontent.com.
      //
      // Browser therefore receives an opaque response.
      //
      // We intentionally do not inspect res.ok.
      // ------------------------------------------------------

      await fetch(
        ORDER_ENDPOINT,
        {

          method:
            "POST",

          mode:
            "no-cors",

          headers: {

            "Content-Type":
              "text/plain;charset=utf-8"

          },

          body:
            JSON.stringify(
              payload
            )

        }
      );


      // ======================================================
      // STORE ORDER FOR THANK YOU PAGE
      // ======================================================

      try {

        sessionStorage.setItem(
          "misaq_order",
          JSON.stringify(
            {

              product:
                PRODUCT_NAME,

              total:
                grandTotal,

              quantity:
                qty,

              eventId:
                eventId,


              // Keep attribution available
              // on Thank You page as well.

              source:
                "website",

              acquisition:
                ORDER_ATTRIBUTION.acquisition,

              campaignId:
                ORDER_ATTRIBUTION.campaignId,

              adSetId:
                ORDER_ATTRIBUTION.adSetId,

              adId:
                ORDER_ATTRIBUTION.adId

            }
          )
        );

      } catch (err) {

        // sessionStorage unavailable.
        // Order has still been submitted.

      }


      // ======================================================
      // REDIRECT TO THANK YOU PAGE
      // ======================================================

      window.location.href =
        "../thank-you.html";

    }

    catch (err) {

      // ------------------------------------------------------
      // Genuine network failure
      // ------------------------------------------------------

      formStatus.dataset.state =
        "error";


      formStatus.textContent =
        "দুঃখিত, অর্ডার পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে সরাসরি কল করুন।";

    }

  }
);
