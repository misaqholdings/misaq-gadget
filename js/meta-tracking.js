/* MISAQ Gadget centralized Meta Pixel & retargeting tracking.
 * Website-only browsing signals; Lead/Purchase remain staff-verified server events.
 * Include once on every HTML page: <script src="/js/meta-tracking.js" defer></script>
 */
(function () {
  'use strict';
  if (window.__misaqMetaTrackingInitialized) return;
  window.__misaqMetaTrackingInitialized = true;
  const PIXEL_ID = '2296738321065012';
  const productCodes = {
    'q86-earbuds': 'Q86',
    'q10-earbuds': 'Q10',
    'silver-crest-airfryer': 'AIRFRYER'
  };
  const segment = (location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
  const form = document.getElementById('orderForm');
  // Future product pages can supply data-product-code on their form.
  // Otherwise derive a stable code from the first product URL segment.
  const productCode = form
    ? (String(form.dataset.productCode || '').trim() ||
       productCodes[segment] ||
       (segment && segment !== 'index.html' ? segment.toUpperCase().replace(/[^A-Z0-9_-]/g, '_') : null))
    : null;

  if (!window.fbq) {
    !function(f,b,e,v,n,t,s) {
      if (f.fbq) return;
      n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if (!f._fbq) f._fbq=n;
      n.push=n;n.loaded=true;n.version='2.0';n.queue=[];
      t=b.createElement(e);t.async=true;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  }
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');

  // Product metadata comes from the existing shared order form, not separate tracking code.
  if (!form || !productCode) return;
  const productName = String(form.dataset.product || productCode);
  const price = Number(form.dataset.price);
  const details = {
    content_ids: [productCode],
    content_type: 'product',
    content_name: productName,
    currency: 'BDT'
  };
  if (Number.isFinite(price) && price >= 0) details.value = price;
  window.fbq('track', 'ViewContent', details);

  let checkoutStarted = false;
  function onFormActivity(e) {
    if (checkoutStarted || !(e.target instanceof Element)) return;
    if (!e.target.closest('input, select, textarea, .color-option, .qty-control')) return;
    checkoutStarted = true;
    const quantity = Math.max(1, Number(form.querySelector('[name="quantity"]')?.value) || 1);
    const checkout = {
      content_ids: [productCode],
      content_type: 'product',
      num_items: quantity,
      currency: 'BDT'
    };
    if (Number.isFinite(price) && price >= 0) checkout.value = price * quantity;
    window.fbq('track', 'InitiateCheckout', checkout);
  }
  form.addEventListener('focusin', onFormActivity);
  form.addEventListener('click', onFormActivity);
})();