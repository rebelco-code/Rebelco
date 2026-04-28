# Rebelco Admin Setup

The admin page is available at `/admina`.

## Vercel Blob

Create a Vercel Blob store and connect it to this Vercel project. Vercel will provide `BLOB_READ_WRITE_TOKEN`.

You can do this in the Vercel dashboard under Storage, or from the project folder with:

```bash
vercel link
vercel blob create-store rebelco-products
vercel env pull .env.local --yes
```

## Google Sign-In

Create a Google OAuth Web client in Google Cloud Console.

Add these authorized JavaScript origins:

```text
http://localhost:3000
https://your-vercel-domain.vercel.app
https://your-production-domain.com
```

Use the OAuth client ID for both:

```env
GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Admin Emails

Only emails listed in `ADMIN_EMAILS` can create products.

```env
ADMIN_EMAILS=first.admin@gmail.com,second.admin@gmail.com
ADMIN_SESSION_SECRET=use-a-long-random-secret
```

For local testing with the API routes, run the app through Vercel:

```bash
npx vercel dev
```
