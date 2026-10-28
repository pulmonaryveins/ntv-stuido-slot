# Studio Slots

Realtime board for 4 shared Adobe device seats (Account 1: slots 1–2, Account 2: slots 1–2).
Nobody logs in to Adobe while all seats are full. The app never stores Adobe credentials.

Stack: Vite + React + TypeScript, Tailwind v4, Radix UI, Zustand, three / R3F / drei,
Supabase (Auth, Postgres + RLS, Realtime, Edge Functions, pg_cron), deployed on Vercel.

> Status: phase 1 (schema, RLS, RPCs, seed, types). UI arrives in later phases.

## Setup

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

### Disable public sign-up (required)

`supabase/config.toml` sets `enable_signup = false` for local dev. On the hosted project, also
turn it off in **Dashboard → Authentication → Sign In / Providers → Allow new users to sign up**.
Users join only through admin invites.

### First admin on a real project

Invite yourself from **Dashboard → Authentication → Users → Invite user**, accept the email,
then run in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

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

## Optional scenery model

`public/models/town.glb` is optional background scenery (LowPolyBoy, CC BY 4.0, NoAI-tagged).
It is gitignored. To produce it from the source file:

```sh
npm run glb:compress -- path/to/source.glb
```

The app runs without it and shows a credit line in the footer when it is present.
