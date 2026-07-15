# Tasker Living, backend setup

The app runs in two modes.

- No backend: works out of the box in demo mode with mock data. Just `npm install && npm run dev`, pick a role, explore.
- Real backend: everything live on Supabase.

## Turn on the real backend

1. Create a project at supabase.com, EU region (Frankfurt) for Czech data.

2. SQL editor: run `supabase/schema.sql` once, then every file in
   `supabase/migrations/` in filename order. This creates all tables, row level
   security, triggers, realtime and the storage buckets.

3. Deploy the Edge Function: `supabase functions deploy admin-users`
   (source in `supabase/functions/admin-users/`).

4. Auth settings in the dashboard:
   - Enable leaked password protection (Auth, Passwords).
   - Add your site URL to the redirect allowlist (Auth, URL Configuration)
     so password reset e-mails come back to the app.
   - Decide on e-mail confirmation. On for production.

5. Copy keys: duplicate `.env.example` to `.env`, fill in
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project settings, API).
   The anon key is public by design, row level security protects the data.

6. Create the first building and access codes from the operator console
   (`/operator`), or insert them in SQL. Add yourself to `platform_admins`
   to unlock the console:
   `insert into platform_admins (user_id) values ('<your auth uid>');`

Access codes are never committed to this repository. Generate them in the app
(Správa, tab Lidé) and hand them to residents privately.

## What is real

Auth with access codes, password reset, the whole feed, faults with photos and
timelines, units and payment charges with QR to the building account, meetings
with RSVP, share weighted polls with proxies, documents in a private bucket with
signed URLs and per role visibility, complaints kept on the unit, direct
messages with realtime delivery, service bookings, and in-app notifications
driven by database triggers. Demo mode keeps a mock fallback for all of it.
