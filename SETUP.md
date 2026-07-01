# Tasker Living, backend setup

The app runs in two modes.

- No backend: works out of the box in demo mode with mock data. Just `npm install && npm run dev`, pick a role, explore.
- Real backend: real login and a live feed backed by Supabase. About 10 minutes to turn on.

## Turn on the real backend

1. Create a free project at supabase.com. Pick an EU region (Frankfurt) for Czech data.

2. Open the SQL editor, paste the whole of `supabase/schema.sql`, run it once. This creates the tables, security rules, realtime, the storage bucket for photos, and seeds one building with access codes.

3. Turn off email confirmation for now so registration logs you straight in. Authentication, Sign In / Providers, Email, switch Confirm email off. You can turn it back on for production.

4. Copy your keys into the app. Duplicate `.env.example` to `.env` and fill in:

   ```
   VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your anon public key
   ```

   Both are in Project settings, API. The anon key is safe in the browser, row level security protects the data.

5. Restart the dev server (`npm run dev`). The login screen now asks for email and password instead of a role picker.

6. Register. Click Registrovat, enter your name, email, password, and one of the seeded access codes:

   | Code | Joins as | Can do |
   | --- | --- | --- |
   | `TL-VP-VYBOR` | Výbor SVJ | everything, including announcements |
   | `TL-VP-B204` | Rezident, unit B-204 | resident view |
   | `TL-VP-DEV` | Developer | portfolio and handover |
   | `TL-VP-INV` | Investor | payments and lease ends |

   Start with `TL-VP-VYBOR`. You are in, and the feed is live. Post something, like it, reply, attach a photo. Open a second browser and register with `TL-VP-B204` to watch posts and likes update in real time between the two.

## What is real vs mock right now

Real, backed by Supabase: login and onboarding by access code, the whole Nástěnka feed (posts, likes, threaded replies, image upload to storage, realtime), and announcements from Správa.

Still mock, in memory: závady, nájmy, služby, schůze, kontakty, stížnosti. They read only from `src/lib/api.ts`. Wiring them to Supabase is the same pattern as the feed: add the tables to `schema.sql`, then replace those functions in `api.ts`. The screens do not change.

## Where the seams are

- `src/lib/supabase.ts` is the client and the demo/real switch.
- `src/lib/api.ts` has the `feed` object (real) and the `api` object (mock). One file to grow.
- `src/state/session.tsx` holds auth: sign in, register and redeem code, sign out, and loading the membership that carries role, building and unit.
