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

With no `SUPABASE_URL` the app uses an in-memory mock client that follows the same
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
5. `cp .env.example .env` and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SESSION_SECRET`,
   then `npm run dev` (the BFF runs inside the dev server under `/api`).

### Registration and sign-in

Anyone can register with name, work role, email and password, then sign in. Passwords need at
least 8 characters; "Forgot password?" sends a reset link. In **Dashboard → Authentication**:

- **Sign In / Providers → Email**: keep "Allow new users to sign up" on. Turn "Confirm email"
  off for the simplest flow (users are signed in right after registering), or leave it on to
  require a confirmation click first.
- **URL Configuration**: set *Site URL* to your app URL (`http://localhost:5173` locally, your
  Vercel URL in production) and add `http://localhost:5173/**` and `https://YOUR-APP.vercel.app/**`
  to *Redirect URLs*. Email links return to `/api/auth/callback` on the BFF.

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
- **Secrets.** Nothing Supabase-related is in the client; see Architecture. Never put the
  `service_role` key or the database password anywhere in the app. No Adobe credentials anywhere.

`npm test` runs the SQL security tests (`supabase/tests/rpc.test.ts`) against every migration
in an in-process Postgres: direct writes refused, other users' slots, admin-only RPCs, pending
users, rate limit, realtime join. Real concurrency is not covered there (single connection).

### Dashboard checklist (hosted project)

- **Authentication → Sign In / Providers → Email:** minimum password length **8**.
- **Authentication → Rate Limits:** keep defaults or lower sign-ups per hour.
- **Realtime → Settings:** turn off **public channel access** (allow private channels only).
- **API settings:** the browser no longer calls Supabase, so only your BFF uses the anon key.
- **Optional:** Authentication → Attack Protection → enable **CAPTCHA** (Turnstile/hCaptcha)
  for sign-up; needs a site key in the app (not wired yet).
- Rotate the **database password** if it was ever pasted anywhere public.

## Look and feel

- **Voxel / pixel-art theme** (original, not copied from any game): bevelled block panels and
  buttons, segmented progress bars, hand-made 12x12 pixel icons (`src/ui/PixelIcon.tsx`).
  Pixelify Sans (OFL, self-hosted via `@fontsource`) for headings, buttons and labels; body text
  uses the system font for readability.
- **3D office:** a voxel office (cutaway room with brick/plaster walls, loft windows that show
  day or night, a door) built from 0.5-unit blocks with procedurally drawn 16x16 textures
  (`src/scene/voxel.tsx`, `src/scene/world.ts`), one instanced mesh per block type.
  Each account is a cubicle pod on its own carpet: two cubicles with fabric partitions and
  aluminium caps, a work surface on the back panel with dual monitors (they light up when the
  seat is in use), drawer pedestal, sticky notes, and the user seated facing the screens; the render farm is a server-rack corner whose LEDs,
  heat vapor and wall fans scale with active renders.
- **Lounge for the waiting list:** queued users don't stand in line. By queue position they
  watch TV on the sofa (#1), play arcade (#2), chill in a bean bag (#3), play ping-pong (#4),
  and so on, with a "#n waiting" tag (it pulses "seat ready" when their reservation starts).
  Spots live in `LOUNGE_SPOTS` in `src/scene/layout.ts`.

### Optional character pack

If `public/models/superhero_minecraft_character.glb` exists, avatars use its characters; each
user gets a random but stable one (hash of their id, distinct until all are in use). Without the
file the app uses its built-in blocky avatars. The file is gitignored, so it is not deployed
unless you add it deliberately; check its licence and add the author credit to the footer before
doing so. The loader maps the legacy `KHR_materials_pbrSpecularGlossiness` materials so textures
show, and rigs each character by geometry (legs, arms, head found by position, pivots added at
hips and shoulders), so they walk with a proper stride and sit with their hips on the seat.

## Environment variables

All server-only: read by the BFF, never bundled into the browser.

| Name | Where | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `.env`, Vercel | Project URL |
| `SUPABASE_ANON_KEY` | `.env`, Vercel | Anon key (RLS still applies to every query) |
| `SESSION_SECRET` | `.env`, Vercel | 32+ random chars, encrypts the session cookie. Required in production |
| `DISCORD_WEBHOOK_URL` | Supabase secrets | `npx supabase secrets set ...` |

Never use `VITE_` names for these: Vite would put them in the browser bundle.

## Architecture: BFF (backend for frontend)

```
browser ──/api/* (same origin, httpOnly cookie)──▶ BFF (server/, Vercel function) ──▶ Supabase
        ◀──────────── SSE /api/stream ◀───────────  (Realtime, private channel)
```

- The browser only talks to `/api/*`. No Supabase URL, key, token or SDK is in the bundle
  (CSP `connect-src 'self'`).
- **Session:** Supabase access/refresh tokens live in an AES-GCM encrypted, httpOnly,
  SameSite=Lax cookie scoped to `/api`. JavaScript cannot read it; the BFF refreshes it.
- **Email links** (confirm, reset) use PKCE: the link returns a one-time code to
  `/api/auth/callback`, exchanged server-side. Open them in the same browser.
- **Board actions:** `POST /api/rpc/:name`, only allowlisted RPCs with exact argument shapes.
  Queries run with the user's JWT, so RLS and the RPC checks still apply.
- **Live updates:** `GET /api/stream` (Server-Sent Events). The BFF listens to Supabase Realtime
  and sends a bare `change` event; the browser refetches `/api/board`. Each stream lives about
  50 s (function limit) and reconnects automatically.
- **CSRF:** every POST needs the `x-studio-csrf` header and a same-origin `Origin`.
- **Login throttling:** Supabase sees the BFF's IP for every user, so the BFF limits sign-in,
  sign-up and email requests per client IP (in memory, per instance, best effort).
- Locally, `npm run dev` mounts the same handlers (`server/vitePlugin.ts`); on Vercel,
  `vercel.json` rewrites `/api/*` to `api/index.ts`.

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
