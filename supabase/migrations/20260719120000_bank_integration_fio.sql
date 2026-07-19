-- Napojení na banku (v1: Fio). Token je write-only z klienta: žádná SELECT
-- policy na bank_connections, čte ho jen edge funkce přes service role.
-- Stav pro UI vrací security-definer RPC bez tokenu.

create table if not exists public.bank_connections (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  bank text not null default 'fio' check (bank in ('fio')),
  token text not null,
  enabled boolean not null default true,
  last_sync timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now()
);
alter table public.bank_connections enable row level security;

drop policy if exists bankconn_insert on public.bank_connections;
create policy bankconn_insert on public.bank_connections for insert
  with check (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());
drop policy if exists bankconn_update on public.bank_connections;
create policy bankconn_update on public.bank_connections for update
  using (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin())
  with check (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());
drop policy if exists bankconn_delete on public.bank_connections;
create policy bankconn_delete on public.bank_connections for delete
  using (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());

create table if not exists public.bank_txs (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  tx_id text not null,
  tx_date date,
  amount numeric not null,
  vs text,
  counter_account text,
  message text,
  status text not null default 'unmatched' check (status in ('matched','review','unmatched','dismissed')),
  matched_charge uuid references public.charges(id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (building_id, tx_id)
);
alter table public.bank_txs enable row level security;
drop policy if exists banktx_read on public.bank_txs;
create policy banktx_read on public.bank_txs for select
  using (public.member_role(building_id) in ('vybor','developer') or public.is_platform_admin());

create or replace function public.bank_connection_status(p_building uuid)
returns table (bank text, enabled boolean, last_sync timestamptz, last_result jsonb, review_count bigint)
language sql security definer set search_path = public as $$
  select c.bank, c.enabled, c.last_sync, c.last_result,
    (select count(*) from public.bank_txs t where t.building_id = p_building and t.status in ('review','unmatched'))
  from public.bank_connections c
  where c.building_id = p_building
    and (public.member_role(p_building) in ('vybor','developer') or public.is_platform_admin());
$$;

create or replace function public.resolve_bank_tx(p_tx uuid, p_charge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_b uuid; v_date date;
begin
  select building_id, tx_date into v_b, v_date from public.bank_txs where id = p_tx;
  if v_b is null then raise exception 'Pohyb nenalezen'; end if;
  if not (public.member_role(v_b) in ('vybor','developer') or public.is_platform_admin()) then
    raise exception 'Nedostatečná práva';
  end if;
  if not exists (select 1 from public.charges where id = p_charge and building_id = v_b) then
    raise exception 'Předpis nepatří k tomuto domu';
  end if;
  update public.charges set status = 'paid', paid_at = coalesce(v_date::timestamptz, now()) where id = p_charge;
  update public.bank_txs set status = 'matched', matched_charge = p_charge where id = p_tx;
end; $$;

create or replace function public.dismiss_bank_tx(p_tx uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_b uuid;
begin
  select building_id into v_b from public.bank_txs where id = p_tx;
  if v_b is null then raise exception 'Pohyb nenalezen'; end if;
  if not (public.member_role(v_b) in ('vybor','developer') or public.is_platform_admin()) then
    raise exception 'Nedostatečná práva';
  end if;
  update public.bank_txs set status = 'dismissed' where id = p_tx;
end; $$;

revoke all on function public.bank_connection_status(uuid) from public;
grant execute on function public.bank_connection_status(uuid) to authenticated;
revoke all on function public.resolve_bank_tx(uuid, uuid) from public;
grant execute on function public.resolve_bank_tx(uuid, uuid) to authenticated;
revoke all on function public.dismiss_bank_tx(uuid) from public;
grant execute on function public.dismiss_bank_tx(uuid) to authenticated;
