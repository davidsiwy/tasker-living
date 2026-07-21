-- Fond oprav: viditelnost je volba výboru/developera (výchozí VYPNUTO), zápisy
-- vede výbor/developer jako jednoduchý deník (příjem/výdaj), zůstatek = součet.
create table if not exists public.reserve_fund_settings (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  visible_to_residents boolean not null default false,
  target_amount numeric,
  updated_at timestamptz not null default now()
);
alter table public.reserve_fund_settings enable row level security;

create table if not exists public.reserve_fund_entries (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  entry_date date not null default current_date,
  amount numeric not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.reserve_fund_entries enable row level security;
create index if not exists reserve_fund_entries_building_idx on public.reserve_fund_entries(building_id, entry_date desc);

create or replace function public.reserve_fund_visible(p_building uuid)
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select visible_to_residents from public.reserve_fund_settings where building_id = p_building), false);
$$;

drop policy if exists fund_settings_read on public.reserve_fund_settings;
create policy fund_settings_read on public.reserve_fund_settings for select
  using (public.member_role(building_id) is not null or public.is_platform_admin());
drop policy if exists fund_settings_write on public.reserve_fund_settings;
create policy fund_settings_write on public.reserve_fund_settings for all
  using (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin())
  with check (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());

drop policy if exists fund_entries_read on public.reserve_fund_entries;
create policy fund_entries_read on public.reserve_fund_entries for select
  using (
    public.member_role(building_id) in ('vybor','developer')
    or public.is_platform_admin()
    or (public.member_role(building_id) is not null and public.reserve_fund_visible(building_id))
  );
drop policy if exists fund_entries_insert on public.reserve_fund_entries;
create policy fund_entries_insert on public.reserve_fund_entries for insert
  with check (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());
drop policy if exists fund_entries_update on public.reserve_fund_entries;
create policy fund_entries_update on public.reserve_fund_entries for update
  using (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin())
  with check (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());
drop policy if exists fund_entries_delete on public.reserve_fund_entries;
create policy fund_entries_delete on public.reserve_fund_entries for delete
  using (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());
