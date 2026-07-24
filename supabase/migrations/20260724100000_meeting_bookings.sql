-- Rezervace uvodnich hovoru z verejneho webu. Anonymni navstevnik smi vlozit
-- rezervaci, ale NESMI cist cizi rezervace (jmena/e-maily/telefony) — obsazene
-- sloty se ctou vyhradne pres taken_slots(), ktera vraci jen datum a cas.
create table if not exists public.meeting_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  slot_time text not null,
  name text not null,
  email text not null,
  phone text,
  building_size text,
  note text,
  lang text not null default 'cs',
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  unique (slot_date, slot_time)
);
alter table public.meeting_bookings enable row level security;

drop policy if exists mb_insert_anon on public.meeting_bookings;
create policy mb_insert_anon on public.meeting_bookings for insert
  to anon, authenticated
  with check (
    slot_date >= current_date
    and slot_date <= current_date + interval '60 days'
    and length(trim(name)) between 2 and 120
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and length(coalesce(note,'')) <= 2000
  );

drop policy if exists mb_read_admin on public.meeting_bookings;
create policy mb_read_admin on public.meeting_bookings for select
  using (public.is_platform_admin());
drop policy if exists mb_update_admin on public.meeting_bookings;
create policy mb_update_admin on public.meeting_bookings for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.taken_slots(p_from date, p_to date)
returns table (slot_date date, slot_time text)
language sql security definer set search_path = public stable
as $$
  select mb.slot_date, mb.slot_time
  from public.meeting_bookings mb
  where mb.slot_date between p_from and p_to and mb.status <> 'cancelled';
$$;
revoke all on function public.taken_slots(date, date) from public;
grant execute on function public.taken_slots(date, date) to anon, authenticated;

-- Anonym musi umet is_platform_admin() zavolat, aby SELECT politika vyhodnotila
-- "nejsi admin" misto permission denied. Funkce je SECURITY DEFINER a pro
-- anonyma (auth.uid() IS NULL) vraci vzdy false — zadny pristup nepridava.
grant execute on function public.is_platform_admin() to anon;
