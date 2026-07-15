# Tasker Living

All in one web app for apartment living, part of the Tasker brand. One app for
four roles in the same building: rezident, výbor SVJ, developer, investor.

Czech interface, premium and clean, responsive and PWA ready.

## Run

```
npm install
npm run dev
```

Open http://localhost:5173. With no backend configured this starts in demo mode:
pick a role and the whole app re-renders through that lens on mock data.

## Real backend

Everything runs on Supabase: auth, feed, faults, payments, meetings, voting,
documents, complaints, messages, bookings and in-app notifications. See
`SETUP.md`. Without env vars the app stays in demo mode.

## Sections

Nástěnka (živý kanál), Závady (fotky, timeline, dodavatelé), Nájmy (předpisy,
QR platba na účet domu, upomínky), Služby (dispečink Tasker), Schůze (RSVP,
hlasování podle podílů s plnými mocemi, dokumenty), Kontakty (adresář a přímé
zprávy), Stížnosti (vedené na číslo bytu), Správa (9 záložek), Nastavení.

## Structure

- `src/lib/supabase.ts` Supabase client and the demo/real switch
- `src/lib/api.ts` the whole data layer, real with demo fallback
- `src/lib/dm.ts` direct messages with realtime delivery
- `src/lib/types.ts` domain types and the role capability matrix
- `src/state/session.tsx` auth, membership, live notifications
- `src/features/` one folder per section
- `supabase/schema.sql` base schema; `supabase/migrations/` everything since
- `supabase/functions/admin-users` operator account management (service role)
- `.github/workflows/deploy.yml` build and deploy to GitHub Pages

## Deploy

Push to `main` builds and publishes `gh-pages` via GitHub Actions. Secrets
required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Pilot build, hardened but young. Report issues to the operator.
