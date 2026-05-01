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
  - `POST /api/orders`
  - `GET /api/pudo-lockers`

- Admin APIs (session required):
  - `GET|POST|DELETE /api/admin/session`
  - `GET|POST|PATCH|DELETE /api/admin/products`
  - `GET|PATCH /api/admin/orders`
  - `GET /api/admin/pudo-lockers`
  - `GET /api/admin/pudo-health`

## Notes

- Product images are private in Blob and served through `/api/blob/image`.
- Checkout now reserves stock for the full basket before writing orders and rolls back stock on order-write failure.
