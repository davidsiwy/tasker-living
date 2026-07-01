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

Login and the live feed run on Supabase. See `SETUP.md` for the roughly 10 minute
turn on: create a project, run `supabase/schema.sql`, paste two env vars, register
with a seeded access code. Without it the app stays in demo mode.

## Sections

Nástěnka (živý kanál), Závady, Nájmy (párování plateb podle variabilního symbolu),
Služby (dispečink Tasker), Schůze (hlasování a dokumenty), Kontakty, Stížnosti
(vedené na číslo bytu, ne na osobu), Správa, Nastavení.

## Structure

- `src/lib/supabase.ts` Supabase client and the demo/real switch
- `src/lib/api.ts` data layer, real feed plus mock for other views
- `src/lib/types.ts` domain types and the role capability matrix
- `src/state/session.tsx` auth and the current membership
- `src/components/` shell, icons, toasts
- `src/features/` one folder per section
- `supabase/schema.sql` the database, security rules, realtime and seed data

## Status

Real: auth by access code, the whole feed (posts, likes, replies, images, realtime).
Mock: závady, nájmy, služby, schůze, kontakty, stížnosti, all behind `api.ts`.

Prototype only. Not production hardened.
