# Brilliant Minds Tutorials

Next.js App Router site for Brilliant Minds Tutorials, Udaiganj, Lucknow. The public page preserves the supplied visual design, copy, verified facts, and section order. Unconfirmed faculty, results, gallery, and event content remains unpublished until the owner adds it.

## Local setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Create a Supabase project, open **Connect**, and copy the Transaction Pooler URL and direct connection URL. URL-encode any special characters in the database password, then put them in `DATABASE_URL` and `DIRECT_URL`. `DATABASE_URL` should use port `6543` with `pgbouncer=true`; `DIRECT_URL` should use port `5432`.
4. Fill in the admin, auth, and SMTP values. Never commit `.env`.
5. Apply the Prisma schema:

   ```powershell
   npm run db:push
   npm run db:seed
   ```

6. Start the site:

   ```powershell
   npm run dev
   ```

Open `http://localhost:3000`.

## Admin access

Use `http://localhost:3000/admin/login`, or the **Admin login** link at the bottom-left of the public site. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. Successful login opens the private enquiry inbox at `/admin/inbox`.

The dashboard at `/admin` shows database-derived KPIs for enquiries, registrations, income, expenses, follow-ups, PDCs, expected income, recent charts, and active batches. It contains no seeded demo numbers. The inbox at `/admin/inbox` supports search, status changes, notes, click-to-call, email reply links, CSV export, and deletion. Students, batches, attendance, and accounts are available at `/admin/students`, `/admin/batches`, `/admin/attendance`, and `/admin/accounts`. The dedicated media portal is at `/admin/media`; use it for faculty profiles and gallery uploads, then publish or delete each item. The broader content manager is at `/admin/content` for website records. New records are unpublished or empty by default; publish only verified content.

## Commands

- `npm run dev`: start local development
- `npm run build`: generate Prisma Client and create a production build
- `npm run start`: serve the production build
- `npm run lint`: run the TypeScript check
- `npm test`: run validation and API-level tests
- `npm run test:e2e`: run Playwright tests when configured
- `npm run db:push`: apply the Prisma schema to PostgreSQL
- `npm run db:seed`: insert verified settings and class programs

## Environment variables

- `DATABASE_URL`, `DIRECT_URL`: PostgreSQL connection strings for Supabase or Neon
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: owner login credentials
- `AUTH_SECRET`: long random secret used for the admin session cookie
- `OWNER_EMAIL`: recipient for enquiry notifications
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: SMTP delivery settings
- `NEXT_PUBLIC_SITE_URL`: canonical site URL used by metadata, sitemap, and robots
- `SUPABASE_URL`: Supabase project URL used by the server upload route
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase Storage key; never expose it with `NEXT_PUBLIC_`
- `SUPABASE_STORAGE_BUCKET`: public Storage bucket name, normally `gallery`

The enquiry endpoint validates and trims fields with Zod, rejects honeypot submissions, rate-limits by IP, checks request origin, stores enquiries privately in PostgreSQL, and returns the verified callback number `087379 14988`. The success state tells the visitor that the team will call that number; it does not open a messaging service. SMTP notifications are sent when SMTP variables are configured.

## Faculty and gallery uploads

After signing in, open `/admin/media`. Upload JPG, PNG, WebP, or AVIF files up to 5 MB, enter required alt text and content details, then save. New media is unpublished until the owner clicks **Publish**. Published records appear on the public home page; deleting a record removes it from the database and public page. Create a public Supabase Storage bucket matching `SUPABASE_STORAGE_BUCKET` before uploading. The service-role key is used only on the server.

To verify the Supabase connection, run `npm run db:push`. A successful command applies the Prisma schema. If Prisma reports `Can't reach database server at host:5432`, the placeholder URL is still in `.env` or the Supabase URL/password/region is incorrect.

## Deployment

Deploy to Vercel with the same environment variables configured in the Vercel project. Use a managed PostgreSQL database and run `npm run db:push` against that database before the first production request. Configure SMTP before relying on owner email notifications.

For production scale, replace the in-memory rate limiter in `lib/rate-limit.ts` with a shared Vercel-compatible store such as Upstash Redis. Configure a managed image provider and add server-side upload validation before publishing gallery or faculty photos. The current content forms store image URLs and required alt text; they do not upload files themselves.

## Verified business facts

Only these supplied facts are used: Brilliant Minds Tutorials; Chandrakanta Building, 10-A, Dr Jagdish Gandhi Marg, Udaiganj, Husainganj, Lucknow, Uttar Pradesh 226001; phone `087379 14988`; Google rating 5.0 with 11 reviews; and the two owner-supplied review quotes. No teachers, ranks, fees, student counts, awards, or results are invented.

Before launch, test the configured database and SMTP path, verify admin access, run `npm test` and `npm run build`, and check the public site at 320, 375, 768, 1024, and 1440px. Use Lighthouse and a real browser for final accessibility and interaction verification.
