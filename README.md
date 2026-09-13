# MISAQ GADGET — Online Store

Facebook-driven gadget store under MISAQ HOLDINGS. Static site (no build tools), meant for `gadget.misaqholdings.com`, with one landing/order page per product.

## File structure

```
/
├── index.html                  Store homepage (product list)
├── css/style.css                Shared styling for all pages
├── js/order.js                   Order form logic (price calc + submit)
├── images/                        Logo, favicon
├── apps-script-orders.gs.txt      Google Apps Script backend code (see below)
└── q10-earbuds/
    ├── index.html                Q10 Earbuds landing/order page
    └── images/                    Product photos for this page
```

Each new product gets its own folder (e.g. `new-product/index.html`) so it gets a clean URL like `gadget.misaqholdings.com/new-product/`.

## 1. Push to GitHub

Create a **new, separate** repository for this (don't mix it into the corporate `misaq-holdings-website` repo — keeps updates independent):

```bash
git init
git add .
git commit -m "Initial gadget store"
git branch -M main
git remote add origin https://github.com/misaqholdings/misaq-gadget-store.git
git push -u origin main
```

(No local git? Just create the repo on github.com and use "uploading an existing file" to drag all these files/folders in — same as before.)

## 2. Deploy on Cloudflare Pages (new project)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the new `misaq-gadget-store` repository.
3. Leave build command and output directory blank/default (static site).
4. **Save and Deploy**.

## 3. Connect the subdomain

This uses the **same** `misaqholdings.com` domain already on Cloudflare — no new domain purchase needed.

1. In the new Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `gadget.misaqholdings.com` → Continue → Activate.
3. Cloudflare adds the DNS record automatically. Within a few minutes, `gadget.misaqholdings.com` will show this store.

## 4. Set up order intake (Google Sheets)

Since this is a static site, there's no database — orders are sent to a Google Sheet instead.

Follow the setup instructions written at the top of `apps-script-orders.gs.txt`. Once deployed, you'll get a Web App URL — paste it into `js/order.js`:

```js
const ORDER_ENDPOINT = "https://script.google.com/macros/s/XXXXXXX/exec";
```

Commit and push — Cloudflare redeploys automatically, and the order form starts working.

**Every order lands as a new row** in the "Orders" sheet tab, with timestamp, customer details, and total — viewable from any phone/computer with Google Sheets.

## 5. Facebook Pixel (for ad tracking)

Once you create a Pixel in Meta Events Manager, open `q10-earbuds/index.html`, find the commented-out Pixel code block near the top of `<head>`, uncomment it, and paste in your Pixel ID. Repeat for any new product page you add. This lets Meta track which ads lead to orders, so ad spend can be optimized.

## 6. Adding a new product later

1. Duplicate the `q10-earbuds/` folder, rename it to a short slug for the new product (e.g. `powerbank/`).
2. Replace the product photos in its `images/` subfolder.
3. Edit `index.html` inside that folder: update the title, price, features, and package contents.
4. Add a new card for it in the root `index.html` (store homepage) linking to the new folder.
5. Commit and push.

## Notes

- Delivery charges (৳70 Dhaka / ৳130 outside Dhaka) and the product price (৳950) are set directly in `q10-earbuds/index.html` and `js/order.js` — update both if prices change.
- The order form validates on the client side only (required fields) — always double-check phone numbers by calling before dispatching, since nothing stops a customer from typing an invalid number.
