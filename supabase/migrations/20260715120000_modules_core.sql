-- Tasker Living: real backend for all modules.
-- Faults, documents, charges, meetings, polls, complaints, messages, bookings.

-- profiles: contact card
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists share_contact boolean not null default false;

-- units: rent and ownership data
alter table public.units add column if not exists rent numeric not null default 0;
alter table public.units add column if not exists vs text;
alter table public.units add column if not exists tenant text;
alter table public.units add column if not exists lease_end date;
alter table public.units add column if not exists share numeric not null default 0;

-- buildings: payment settings (QR platba target)
alter table public.buildings add column if not exists bank_account text;
alter table public.buildings add column if not exists bank_recipient text;

-- ---------- faults ----------
create table if not exists public.faults (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_label text not null default '',
  category text not null,
  location text not null,
  description text not null default '',
  status text not null default 'Nahlášeno' check (status in ('Nahlášeno','V řešení','Vyřešeno')),
  vendor text,
  created_at timestamptz not null default now()
);
create index if not exists faults_building_idx on public.faults (building_id, created_at desc);

create table if not exists public.fault_events (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults(id) on delete cascade,
  status text not null,
  note text,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fault_events_fault_idx on public.fault_events (fault_id, created_at);

create table if not exists public.fault_photos (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

-- ---------- documents (metadata; objects live in the private "docs" bucket) ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  kind text not null default 'PDF',
  category text,
  path text not null,
  visibility text[] not null default array['rezident','vybor','developer','investor'],
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists documents_building_idx on public.documents (building_id, created_at desc);

-- ---------- charges (platební předpisy) ----------
create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  label text not null,
  amount numeric not null,
  vs text,
  period text not null,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid','awaiting','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (unit_id, period, label)
);
create index if not exists charges_building_period_idx on public.charges (building_id, period);

-- ---------- meetings ----------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  starts_at timestamptz not null,
  place text not null,
  agenda text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.meeting_rsvps (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  going boolean not null default true,
  primary key (meeting_id, user_id)
);

-- ---------- polls: per rollam voting by ownership shares ----------
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  question text not null,
  quorum int not null default 50,
  open boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.ballots (
  poll_id uuid not null references public.polls(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  choice text not null check (choice in ('ano','ne','zdrzel')),
  voter_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (poll_id, unit_id)
);
create table if not exists public.proxies (
  poll_id uuid not null references public.polls(id) on delete cascade,
  from_unit uuid not null references public.units(id) on delete cascade,
  to_unit uuid not null references public.units(id) on delete cascade,
  primary key (poll_id, from_unit)
);

-- ---------- complaints (kept on the unit, author hidden from residents) ----------
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_label text not null,
  type text not null,
  note text not null default '',
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists complaints_building_idx on public.complaints (building_id, unit_label);

-- ---------- direct messages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at);

-- ---------- service bookings (Tasker) ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null,
  note text,
  status text not null default 'new' check (status in ('new','assigned','done','cancelled')),
  worker text,
  scheduled text,
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.faults enable row level security;
alter table public.fault_events enable row level security;
alter table public.fault_photos enable row level security;
alter table public.documents enable row level security;
alter table public.charges enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_rsvps enable row level security;
alter table public.polls enable row level security;
alter table public.ballots enable row level security;
alter table public.proxies enable row level security;
alter table public.complaints enable row level security;
alter table public.messages enable row level security;
alter table public.bookings enable row level security;

-- faults
drop policy if exists faults_read on public.faults;
create policy faults_read on public.faults for select using (is_member_of(building_id) or is_platform_admin());
drop policy if exists faults_insert on public.faults;
create policy faults_insert on public.faults for insert with check (is_member_of(building_id) and reporter_id = auth.uid());
drop policy if exists faults_update on public.faults;
create policy faults_update on public.faults for update
  using (member_role(building_id) in ('vybor','developer') or is_platform_admin())
  with check (member_role(building_id) in ('vybor','developer') or is_platform_admin());

drop policy if exists fault_events_read on public.fault_events;
create policy fault_events_read on public.fault_events for select using (
  exists (select 1 from public.faults f where f.id = fault_id and (is_member_of(f.building_id) or is_platform_admin()))
);
drop policy if exists fault_events_insert on public.fault_events;
create policy fault_events_insert on public.fault_events for insert with check (
  author_id = auth.uid() and exists (
    select 1 from public.faults f where f.id = fault_id and member_role(f.building_id) in ('vybor','developer')
  )
);

drop policy if exists fault_photos_read on public.fault_photos;
create policy fault_photos_read on public.fault_photos for select using (
  exists (select 1 from public.faults f where f.id = fault_id and (is_member_of(f.building_id) or is_platform_admin()))
);
drop policy if exists fault_photos_insert on public.fault_photos;
create policy fault_photos_insert on public.fault_photos for insert with check (
  exists (select 1 from public.faults f where f.id = fault_id and (f.reporter_id = auth.uid() or member_role(f.building_id) in ('vybor','developer')))
);

-- documents: visibility by role
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select using (
  is_platform_admin() or (is_member_of(building_id) and member_role(building_id) = any(visibility))
);
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for insert with check (member_role(building_id) in ('vybor','developer'));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update using (member_role(building_id) in ('vybor','developer')) with check (member_role(building_id) in ('vybor','developer'));
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete using (member_role(building_id) in ('vybor','developer'));

-- charges
drop policy if exists charges_read on public.charges;
create policy charges_read on public.charges for select using (
  is_platform_admin()
  or member_role(building_id) in ('vybor','developer','investor')
  or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = charges.unit_id)
);
drop policy if exists charges_manage on public.charges;
create policy charges_manage on public.charges for insert with check (member_role(building_id) in ('vybor','developer'));
drop policy if exists charges_update_admin on public.charges;
create policy charges_update_admin on public.charges for update
  using (member_role(building_id) in ('vybor','developer'))
  with check (member_role(building_id) in ('vybor','developer'));
drop policy if exists charges_update_own on public.charges;
create policy charges_update_own on public.charges for update
  using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = charges.unit_id))
  with check (status = 'awaiting');
drop policy if exists charges_delete on public.charges;
create policy charges_delete on public.charges for delete using (member_role(building_id) in ('vybor','developer'));

-- meetings
drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select using (is_member_of(building_id) or is_platform_admin());
drop policy if exists meetings_manage on public.meetings;
create policy meetings_manage on public.meetings for insert with check (member_role(building_id) in ('vybor','developer') and created_by = auth.uid());
drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update using (member_role(building_id) in ('vybor','developer')) with check (member_role(building_id) in ('vybor','developer'));
drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings for delete using (member_role(building_id) in ('vybor','developer'));

drop policy if exists rsvps_read on public.meeting_rsvps;
create policy rsvps_read on public.meeting_rsvps for select using (
  exists (select 1 from public.meetings mt where mt.id = meeting_id and is_member_of(mt.building_id))
);
drop policy if exists rsvps_write on public.meeting_rsvps;
create policy rsvps_write on public.meeting_rsvps for insert with check (
  user_id = auth.uid() and exists (select 1 from public.meetings mt where mt.id = meeting_id and is_member_of(mt.building_id))
);
drop policy if exists rsvps_update on public.meeting_rsvps;
create policy rsvps_update on public.meeting_rsvps for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists rsvps_delete on public.meeting_rsvps;
create policy rsvps_delete on public.meeting_rsvps for delete using (user_id = auth.uid());

-- polls, ballots, proxies
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select using (is_member_of(building_id) or is_platform_admin());
drop policy if exists polls_manage on public.polls;
create policy polls_manage on public.polls for insert with check (member_role(building_id) in ('vybor','developer') and created_by = auth.uid());
drop policy if exists polls_update on public.polls;
create policy polls_update on public.polls for update using (member_role(building_id) in ('vybor','developer')) with check (member_role(building_id) in ('vybor','developer'));

drop policy if exists ballots_read on public.ballots;
create policy ballots_read on public.ballots for select using (
  exists (select 1 from public.polls p where p.id = poll_id and is_member_of(p.building_id))
);
drop policy if exists ballots_write on public.ballots;
create policy ballots_write on public.ballots for insert with check (
  voter_id = auth.uid()
  and exists (select 1 from public.polls p where p.id = poll_id and p.open)
  and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = ballots.unit_id)
);
drop policy if exists ballots_update on public.ballots;
create policy ballots_update on public.ballots for update using (
  exists (select 1 from public.polls p where p.id = poll_id and p.open)
  and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = ballots.unit_id)
) with check (voter_id = auth.uid());
drop policy if exists ballots_delete on public.ballots;
create policy ballots_delete on public.ballots for delete using (
  exists (select 1 from public.polls p where p.id = poll_id and p.open)
  and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = ballots.unit_id)
);

drop policy if exists proxies_read on public.proxies;
create policy proxies_read on public.proxies for select using (
  exists (select 1 from public.polls p where p.id = poll_id and is_member_of(p.building_id))
);
drop policy if exists proxies_write on public.proxies;
create policy proxies_write on public.proxies for insert with check (
  exists (select 1 from public.polls p where p.id = poll_id and p.open)
  and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = proxies.from_unit)
);
drop policy if exists proxies_delete on public.proxies;
create policy proxies_delete on public.proxies for delete using (
  exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.unit_id = proxies.from_unit)
);

-- complaints: residents file them, only management reads the log
drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints for insert with check (
  author_id = auth.uid() and is_member_of(building_id) and member_role(building_id) in ('rezident','vybor')
);
drop policy if exists complaints_read on public.complaints;
create policy complaints_read on public.complaints for select using (
  member_role(building_id) in ('vybor','developer') or is_platform_admin()
);

-- messages
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists messages_write on public.messages;
create policy messages_write on public.messages for insert with check (
  sender_id = auth.uid() and is_member_of(building_id)
  and exists (select 1 from public.memberships m where m.user_id = recipient_id and m.building_id = messages.building_id)
);

-- bookings
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (
  user_id = auth.uid() or member_role(building_id) in ('vybor','developer') or is_platform_admin()
);
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert with check (user_id = auth.uid() and is_member_of(building_id));
drop policy if exists bookings_update_admin on public.bookings;
create policy bookings_update_admin on public.bookings for update using (member_role(building_id) in ('vybor','developer')) with check (member_role(building_id) in ('vybor','developer'));
drop policy if exists bookings_cancel_own on public.bookings;
create policy bookings_cancel_own on public.bookings for update using (user_id = auth.uid()) with check (status = 'cancelled');

-- ---------- private storage bucket for documents ----------
insert into storage.buckets (id, name, public) values ('docs', 'docs', false)
on conflict (id) do nothing;
drop policy if exists docs_upload on storage.objects;
create policy docs_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'docs' and member_role((split_part(name, '/', 1))::uuid) in ('vybor','developer')
);
drop policy if exists docs_read on storage.objects;
create policy docs_read on storage.objects for select to authenticated using (
  bucket_id = 'docs' and is_member_of((split_part(name, '/', 1))::uuid)
);
drop policy if exists docs_delete on storage.objects;
create policy docs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'docs' and member_role((split_part(name, '/', 1))::uuid) in ('vybor','developer')
);
