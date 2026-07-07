# Rebelco Website

Rebelco is a React + Vite storefront with:

- Public catalogue and checkout flow
- PUDO locker lookup by customer coordinates
- Admin sign-in for product and order management
- Vercel Blob-backed storage for products, orders, and image assets

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Vercel Serverless Functions (`api/*`)
- Vercel Blob (`@vercel/blob`)

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create local env file from example:

```bash
cp .env.example .env.local
```

3. Fill required env vars in `.env.local`:

- `BLOB_READ_WRITE_TOKEN`
- `ADMIN_EMAILS`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Optional:

- `PUDO_API_BASE_URL`
- `PUDO_API_KEY`
- `PUDO_BEARER_TOKEN` or `PUDO_API_TOKEN`
- `BLOB_ACCESS` (`private` default, or `public` for public Blob stores)
- `PRODUCTS_CATALOG_CACHE_TTL_MS` (default `30000`)
- `WHATSAPP_ORDER_PHONE` (digits only, defaults to `27636936204`)
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE` (if configured in PayFast)
- `PAYFAST_SANDBOX` (`true` for sandbox, otherwise live)
- `PAYFAST_RETURN_URL` (defaults to `https://rebelco.vercel.app/payment/success`)
- `PAYFAST_CANCEL_URL` (defaults to `https://rebelco.vercel.app/payment/cancel`)
- `PAYFAST_NOTIFY_URL` (defaults to `https://rebelco.vercel.app/api/payfast/itn`)
- `PAYFAST_ITN_TRUSTED_IPS` (optional comma-separated CIDRs/IPs to override the built-in PayFast ITN ranges)

4. Start dev server:

```bash
npm run dev
```

## Scripts

- `npm run dev` starts local dev server
- `npm run build` builds production assets
- `npm run preview` previews production build
- `npm run lint` runs ESLint
- `npm run check` runs lint + build

## API Overview

- Public APIs:
  - `GET /api/products`
  - `POST /api/orders` (creates the order and returns the signed PayFast redirect payload)
  - `GET /api/pudo-lockers`
  - `POST /api/payfast/initiate`
  - `POST /api/payfast/itn`
  - `POST /api/payfast/notify` (legacy alias)
  - `GET /api/payfast/status`

- Admin APIs (session required):
  - `GET|POST|DELETE /api/admin/session`
  - `GET|POST|PATCH|DELETE /api/admin/products`
  - `GET|PATCH /api/admin/orders`
  - `GET /api/admin/pudo-lockers`
  - `GET /api/admin/pudo-health`

## Notes

- Product images are private in Blob and served through `/api/blob/image`.
- Checkout now creates a pending order group, redirects the customer to PayFast, and waits for the ITN callback to confirm payment.
- Stock is reserved when checkout starts and released automatically if PayFast reports a failed or cancelled payment state.
