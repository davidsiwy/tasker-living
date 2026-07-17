-- Oznámení podle handoffu 4a/7e: nadpis, cílení, push a čtenost po bytech.
-- Čistě aditivní: nové sloupce jsou nullable / s defaultem, post_reads je nová tabulka.

-- ---------- posts: nadpis, cílení, push ----------
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists audience text not null default 'all';
alter table public.posts add column if not exists push boolean not null default true;

-- cílení: celý dům, konkrétní vchod (A/B/C…), garáže, nebo jen vlastníci
alter table public.posts drop constraint if exists posts_audience_check;
alter table public.posts add constraint posts_audience_check
  check (audience = 'all' or audience = 'owners' or audience = 'garages' or audience ~ '^entrance:[A-Z]$');

-- ---------- post_reads: kdo a za jaký byt si oznámení přečetl ----------
create table if not exists public.post_reads (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  read_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_reads_post_idx on public.post_reads (post_id);
create index if not exists post_reads_unit_idx on public.post_reads (post_id, unit_id);

alter table public.post_reads enable row level security;

-- členové domu vidí čtenost svého domu (výbor potřebuje "koho obejít osobně")
drop policy if exists post_reads_read on public.post_reads;
create policy post_reads_read on public.post_reads for select using (
  exists (select 1 from public.posts p where p.id = post_id and public.is_member_of(p.building_id))
);

-- přečteno si zapisuje jen sám uživatel, a jen u oznámení ze svého domu
drop policy if exists post_reads_insert on public.post_reads;
create policy post_reads_insert on public.post_reads for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.posts p where p.id = post_id and public.is_member_of(p.building_id))
);

-- ---------- čtenost po bytech pro výbor ----------
-- Vrací jeden řádek na jednotku domu: přečteno / doručeno / nepřipojeno.
-- Nepřipojeným bytům se podle handoffu tiskne dopis, proto je odlišujeme.
create or replace function public.post_read_stats(p_post uuid)
returns table (unit_id uuid, unit_label text, state text, read_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.label,
    case
      when r.user_id is not null then 'read'
      when m.user_id is not null then 'delivered'
      else 'unconnected'
    end as state,
    r.read_at
  from public.posts p
  join public.units u on u.building_id = p.building_id
  left join public.memberships m on m.unit_id = u.id and m.building_id = p.building_id
  left join public.post_reads r on r.post_id = p.id and r.unit_id = u.id
  where p.id = p_post
    and public.is_member_of(p.building_id)
  group by u.id, u.label, r.user_id, m.user_id, r.read_at
  order by u.label;
$$;

revoke all on function public.post_read_stats(uuid) from public;
grant execute on function public.post_read_stats(uuid) to authenticated;
