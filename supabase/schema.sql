-- Tasker Living, database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor. It creates the tables, security
-- rules, realtime and storage the app expects, and seeds one demo building
-- with access codes so you can register straight away.

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Rezident',
  created_at timestamptz not null default now()
);

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  label text not null,
  floor text,
  unique (building_id, label)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  role text not null check (role in ('rezident','vybor','developer','investor')),
  unit_id uuid references public.units(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, building_id)
);

create table if not exists public.access_codes (
  code text primary key,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  role text not null check (role in ('rezident','vybor','developer','investor')),
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  handle text not null,
  role text,
  kind text not null default 'kom' check (kind in ('ozn','kom','udal','zav')),
  body text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists posts_building_created_idx on public.posts (building_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  handle text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- ---------- helper functions (run as owner, bypass RLS safely) ----------
create or replace function public.is_member_of(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships m where m.building_id = b and m.user_id = auth.uid());
$$;

create or replace function public.member_role(b uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from memberships m where m.building_id = b and m.user_id = auth.uid() limit 1;
$$;

-- create a profile row automatically on signup, name comes from signup metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Rezident'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- redeem an access code: joins the current user to a building with a role
create or replace function public.redeem_access_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare c public.access_codes; b public.buildings;
begin
  select * into c from public.access_codes where code = p_code and used_by is null;
  if not found then raise exception 'Neplatný nebo již použitý přístupový kód'; end if;
  insert into public.memberships (user_id, building_id, role, unit_id)
    values (auth.uid(), c.building_id, c.role, c.unit_id)
    on conflict (user_id, building_id) do nothing;
  update public.access_codes set used_by = auth.uid() where code = p_code;
  select * into b from public.buildings where id = c.building_id;
  return json_build_object('building_id', b.id, 'building', b.name);
end;
$$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.memberships enable row level security;
alter table public.access_codes enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

-- profiles: read own or those who share a building with you, update your own
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from memberships a join memberships b2 on a.building_id = b2.building_id
    where a.user_id = auth.uid() and b2.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- buildings and units: readable by members
drop policy if exists buildings_read on public.buildings;
create policy buildings_read on public.buildings for select using (is_member_of(id));
drop policy if exists units_read on public.units;
create policy units_read on public.units for select using (is_member_of(building_id));

-- memberships: your own, or co-members of a building you belong to
drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select using (
  user_id = auth.uid() or is_member_of(building_id)
);

-- access_codes: no direct access, redeemed only through the function above

-- posts: members read; members post; announcements limited to committee/developer
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (is_member_of(building_id));
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert with check (
  author_id = auth.uid() and is_member_of(building_id)
  and (kind <> 'ozn' or member_role(building_id) in ('vybor','developer'))
);
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete using (author_id = auth.uid());

-- likes: read within your buildings, like/unlike as yourself
drop policy if exists likes_read on public.post_likes;
create policy likes_read on public.post_likes for select using (
  exists (select 1 from posts p where p.id = post_likes.post_id and is_member_of(p.building_id))
);
drop policy if exists likes_insert on public.post_likes;
create policy likes_insert on public.post_likes for insert with check (
  user_id = auth.uid() and exists (select 1 from posts p where p.id = post_likes.post_id and is_member_of(p.building_id))
);
drop policy if exists likes_delete on public.post_likes;
create policy likes_delete on public.post_likes for delete using (user_id = auth.uid());

-- comments: read within your buildings, comment as yourself
drop policy if exists comments_read on public.post_comments;
create policy comments_read on public.post_comments for select using (
  exists (select 1 from posts p where p.id = post_comments.post_id and is_member_of(p.building_id))
);
drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert with check (
  author_id = auth.uid() and exists (select 1 from posts p where p.id = post_comments.post_id and is_member_of(p.building_id))
);

-- ---------- realtime ----------
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;

-- ---------- storage for feed images ----------
insert into storage.buckets (id, name, public) values ('feed', 'feed', true)
  on conflict (id) do nothing;
drop policy if exists feed_upload on storage.objects;
create policy feed_upload on storage.objects for insert to authenticated with check (bucket_id = 'feed');
drop policy if exists feed_read on storage.objects;
create policy feed_read on storage.objects for select using (bucket_id = 'feed');

-- ---------- seed one demo building + access codes ----------
insert into public.buildings (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Rezidence Vista Park', 'vista-park')
  on conflict (id) do nothing;

insert into public.units (building_id, label, floor) values
  ('11111111-1111-1111-1111-111111111111', 'B-204', '2. patro'),
  ('11111111-1111-1111-1111-111111111111', 'A-101', '1. patro'),
  ('11111111-1111-1111-1111-111111111111', 'C-302', '3. patro')
  on conflict (building_id, label) do nothing;

insert into public.access_codes (code, building_id, role, unit_id) values
  ('TL-VP-VYBOR', '11111111-1111-1111-1111-111111111111', 'vybor', null),
  ('TL-VP-DEV',   '11111111-1111-1111-1111-111111111111', 'developer', null),
  ('TL-VP-INV',   '11111111-1111-1111-1111-111111111111', 'investor', null),
  ('TL-VP-B204',  '11111111-1111-1111-1111-111111111111', 'rezident',
     (select id from public.units where building_id = '11111111-1111-1111-1111-111111111111' and label = 'B-204'))
  on conflict (code) do nothing;
