# Studio Slots

Realtime board for 4 shared Adobe device seats (Account 1: slots 1–2, Account 2: slots 1–2).
Nobody logs in to Adobe while all seats are full. The app never stores Adobe credentials.

Stack: Vite + React + TypeScript, Tailwind v4, Radix UI, Zustand, three / R3F / drei,
Supabase (Auth, Postgres + RLS, Realtime, Edge Functions, pg_cron), deployed on Vercel.

> Status: schema + RPCs, List view and 3D studio done. Auth, admin panel and notifications pending.

## Run locally without Supabase (mock mode)

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: helpers + mock client rules
```

With no `VITE_SUPABASE_URL` the app uses an in-memory mock client that follows the same
rules as the SQL RPCs. The top bar shows a dashed **Dev** group (mock only):

- **Live demo**: simulated teammates claim, extend, break, render, queue and knock.
- **Speed** 1× / 60× / 240×: mock clock speed. Timers always derive from timestamps.
- **Acting as**: impersonate any seed user (including the admin). Dev tool only; it goes
  away when auth lands.

## Setup with Supabase

1. `npm install`
2. Create a Supabase project, then link it:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
3. Apply migrations: `npm run db:push`
   (dev projects only, with sample users: `npm run db:seed`)
4. Generate types: `npm run db:types`
5. `cp .env.example .env.local` and fill in the values, then `npm run dev`.

### Registration and sign-in

Anyone can register with name, work role, email and password, then sign in. Passwords need at
least 8 characters; "Forgot password?" sends a reset link. In **Dashboard → Authentication**:

- **Sign In / Providers → Email**: keep "Allow new users to sign up" on. Turn "Confirm email"
  off for the simplest flow (users are signed in right after registering), or leave it on to
  require a confirmation click first.
- **URL Configuration**: set *Site URL* to your app URL (`http://localhost:5173` locally, your
  Vercel URL in production) and add the same to *Redirect URLs* (used by confirmation and reset
  emails).

#### Branded confirmation email

`supabase/templates/confirmation.html` is the styled "Confirm signup" email (used by local
`supabase start` via `config.toml`). The hosted project does **not** pick it up from `db push`:
paste it in **Dashboard → Authentication → Emails → Templates → Confirm signup**
(subject: `Confirm your Studio Slots email`). Keep the `{{ .ConfirmationURL }}` placeholders.

In the app, registering with confirmation on shows a "Check your email" screen with a Resend
button; following the link signs the user in and shows a welcome toast. Expired or reused links
show a clear message on the sign-in screen.

### Admin and approval

The **first account that registers becomes an active admin**. Every account after that can sign
in but sees a **"Waiting for approval"** screen until an admin approves it in the **Admin** page
(the Admin button shows a badge with the number waiting). Approved users get in automatically
without reloading. Admins can also deactivate users (frees their seat, removes them from the
queue) and change roles. Promote someone by SQL if needed:

```sql
update public.profiles set role = 'admin', active = true where id = (select id from auth.users where email = 'you@example.com');
```

## Security

Enforced in the database, so it holds even if someone calls the API directly:

- **Read-only tables.** Clients can only `SELECT`; all writes go through `SECURITY DEFINER`
  RPCs (`search_path = ''`) that check the caller. Anonymous callers get nothing.
- **RLS.** Inactive/pending users see only their own profile. Non-admins never see inactive
  profiles. Activity is limited to 24 h for non-admins.
- **Ownership.** Users can only change their own slot; admin RPCs check the admin role;
  admins cannot demote or deactivate themselves.
- **Rate limits.** 30 actions per user per minute on every user RPC; knocks 1 per slot per 2 min.
- **Concurrency.** One advisory lock serialises board changes, plus row locks and unique
  indexes (one seat and one reservation per user).
- **Realtime.** The board uses a private channel; only active users may join
  (policy on `realtime.messages`). Table changes are still filtered by RLS.
- **Browser.** `vercel.json` sets CSP, frame-ancestors/X-Frame-Options (no clickjacking),
  nosniff, referrer and permissions policies, HSTS. `npm run preview` serves the same headers.
- **Secrets.** Only the public anon key is in the client. Never put the `service_role` key or
  the database password in `.env`/Vercel `VITE_*` vars. No Adobe credentials anywhere.

`npm test` runs the SQL security tests (`supabase/tests/rpc.test.ts`) against every migration
in an in-process Postgres: direct writes refused, other users' slots, admin-only RPCs, pending
users, rate limit, realtime join. Real concurrency is not covered there (single connection).

### Dashboard checklist (hosted project)

- **Authentication → Sign In / Providers → Email:** minimum password length **8**.
- **Authentication → Rate Limits:** keep defaults or lower sign-ups per hour.
- **Realtime → Settings:** turn off **public channel access** (allow private channels only).
- **Optional:** Authentication → Attack Protection → enable **CAPTCHA** (Turnstile/hCaptcha)
  for sign-up; needs a site key in the app (not wired yet).
- Rotate the **database password** if it was ever pasted anywhere public.

## Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Public anon key; RLS protects data |
| `DISCORD_WEBHOOK_URL` | Supabase secrets only | `npx supabase secrets set DISCORD_WEBHOOK_URL=...`. Never put it in a `VITE_` var. |

## Sample users (seed.sql, DEV ONLY)

`admin@studio.test` (admin) plus 10 users (`maya@`, `jun@`, `sam@`, `lena@`, `omar@`, `priya@`,
`theo@`, `kai@`, `rosa@`, `ivan@studio.test`). Shared password: `studio-slots-dev`.
**Do not seed a project real people use.** If you did, delete these users from the dashboard.

## Database design

- Tables: `profiles`, `accounts`, `slots`, `queue`, `activity_log`, `settings` (single row).
- Clients can only `SELECT` (RLS). All writes go through `SECURITY DEFINER` RPCs in
  `supabase/migrations/*_rpcs.sql`, serialised by one advisory lock plus row locks.
  Unique partial indexes enforce one seat and one reservation per user.
- Inactive users read nothing; non-admins never see inactive profiles; users see the last
  24 h of activity, admins see all of it.
- `activity_log.user_id` is the actor (null = system); `meta.target_user_id` is who to notify.
- RPC errors use stable codes (`slot_taken`, `slot_held`, `already_seated`, …) listed at the
  top of the RPC migration.
