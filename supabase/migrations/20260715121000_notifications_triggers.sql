-- Real in-app notifications with triggers, plus server-side post identity.
-- (Mirror of the applied migration notifications_triggers.)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  icon text not null default 'bell',
  title text not null,
  subtitle text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

create or replace function public.notify_building(p_building uuid, p_except uuid, p_icon text, p_title text, p_sub text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, building_id, icon, title, subtitle)
  select distinct m.user_id, p_building, p_icon, p_title, p_sub
  from public.memberships m
  where m.building_id = p_building and (p_except is null or m.user_id <> p_except);
end;
$$;
revoke execute on function public.notify_building(uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.notify_roles(p_building uuid, p_roles text[], p_except uuid, p_icon text, p_title text, p_sub text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, building_id, icon, title, subtitle)
  select distinct m.user_id, p_building, p_icon, p_title, p_sub
  from public.memberships m
  where m.building_id = p_building and m.role = any(p_roles) and (p_except is null or m.user_id <> p_except);
end;
$$;
revoke execute on function public.notify_roles(uuid, text[], uuid, text, text, text) from public, anon, authenticated;

create or replace function public.notify_unit(p_unit uuid, p_icon text, p_title text, p_sub text)
returns int language plpgsql security definer set search_path = public as $$
declare b uuid; n int;
begin
  select building_id into b from public.units where id = p_unit;
  if b is null then raise exception 'Jednotka nenalezena'; end if;
  if member_role(b) not in ('vybor','developer') and not is_platform_admin() then
    raise exception 'Pouze pro správu domu';
  end if;
  insert into public.notifications (user_id, building_id, icon, title, subtitle)
  select m.user_id, b, p_icon, p_title, p_sub
  from public.memberships m where m.unit_id = p_unit;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.remind_charge(p_charge uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c public.charges; n int;
begin
  select * into c from public.charges where id = p_charge;
  if not found then raise exception 'Předpis nenalezen'; end if;
  if member_role(c.building_id) not in ('vybor','developer') and not is_platform_admin() then
    raise exception 'Pouze pro správu domu';
  end if;
  insert into public.notifications (user_id, building_id, icon, title, subtitle)
  select m.user_id, c.building_id, 'bank',
         'Upomínka: ' || c.label,
         'Částka ' || trim(to_char(c.amount, 'FM999G999G999')) || ' Kč, VS ' || coalesce(c.vs, '')
  from public.memberships m where m.unit_id = c.unit_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.trg_post_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'ozn' then
    perform notify_building(new.building_id, new.author_id, 'nastenka', 'Nové oznámení', left(new.body, 120));
  end if;
  return new;
end;
$$;
drop trigger if exists post_notify on public.posts;
create trigger post_notify after insert on public.posts for each row execute function public.trg_post_notify();

create or replace function public.trg_fault_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.fault_events (fault_id, status, author_id) values (new.id, 'Nahlášeno', new.reporter_id);
  perform notify_roles(new.building_id, array['vybor','developer'], new.reporter_id, 'zavady',
    'Nová závada: ' || new.category, new.location || case when new.description <> '' then ' · ' || left(new.description, 80) else '' end);
  return new;
end;
$$;
drop trigger if exists fault_created on public.faults;
create trigger fault_created after insert on public.faults for each row execute function public.trg_fault_created();

create or replace function public.trg_fault_event_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare f public.faults;
begin
  select * into f from public.faults where id = new.fault_id;
  if f.reporter_id is not null and (new.author_id is null or new.author_id <> f.reporter_id) then
    insert into public.notifications (user_id, building_id, icon, title, subtitle)
    values (f.reporter_id, f.building_id, 'zavady', 'Závada: ' || new.status,
            f.category || ', ' || f.location || coalesce(' · ' || new.note, ''));
  end if;
  return new;
end;
$$;
drop trigger if exists fault_event_notify on public.fault_events;
create trigger fault_event_notify after insert on public.fault_events for each row execute function public.trg_fault_event_notify();

create or replace function public.trg_complaint_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_roles(new.building_id, array['vybor','developer'], new.author_id, 'stiznosti',
    'Nová stížnost: ' || new.type, 'Byt ' || new.unit_label);
  return new;
end;
$$;
drop trigger if exists complaint_notify on public.complaints;
create trigger complaint_notify after insert on public.complaints for each row execute function public.trg_complaint_notify();

create or replace function public.trg_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare sender_name text;
begin
  select full_name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications (user_id, building_id, icon, title, subtitle)
  values (new.recipient_id, new.building_id, 'msg', 'Zpráva od ' || coalesce(sender_name, 'souseda'), left(new.body, 120));
  return new;
end;
$$;
drop trigger if exists message_notify on public.messages;
create trigger message_notify after insert on public.messages for each row execute function public.trg_message_notify();

create or replace function public.trg_meeting_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_building(new.building_id, new.created_by, 'schuze', 'Nová schůze vlastníků',
    to_char(new.starts_at at time zone 'Europe/Prague', 'DD. MM. YYYY HH24:MI') || ' · ' || new.place);
  return new;
end;
$$;
drop trigger if exists meeting_notify on public.meetings;
create trigger meeting_notify after insert on public.meetings for each row execute function public.trg_meeting_notify();

create or replace function public.trg_poll_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_building(new.building_id, new.created_by, 'schuze', 'Nové hlasování', left(new.question, 120));
  return new;
end;
$$;
drop trigger if exists poll_notify on public.polls;
create trigger poll_notify after insert on public.polls for each row execute function public.trg_poll_notify();

create or replace function public.trg_set_post_identity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_unit text; v_role text;
begin
  select p.full_name into v_name from public.profiles p where p.id = auth.uid();
  select u.label, m.role into v_unit, v_role
  from public.memberships m left join public.units u on u.id = m.unit_id
  where m.user_id = auth.uid() and m.building_id = new.building_id limit 1;
  if v_name is not null then new.author_name := v_name; end if;
  if v_role is not null then new.role := v_role; end if;
  new.handle := coalesce(v_unit, v_role, new.handle);
  return new;
end;
$$;
drop trigger if exists set_post_identity on public.posts;
create trigger set_post_identity before insert on public.posts for each row execute function public.trg_set_post_identity();

create or replace function public.trg_set_comment_identity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_unit text; v_role text; v_building uuid;
begin
  select building_id into v_building from public.posts where id = new.post_id;
  select p.full_name into v_name from public.profiles p where p.id = auth.uid();
  select u.label, m.role into v_unit, v_role
  from public.memberships m left join public.units u on u.id = m.unit_id
  where m.user_id = auth.uid() and m.building_id = v_building limit 1;
  if v_name is not null then new.author_name := v_name; end if;
  new.handle := coalesce(v_unit, v_role, new.handle);
  return new;
end;
$$;
drop trigger if exists set_comment_identity on public.post_comments;
create trigger set_comment_identity before insert on public.post_comments for each row execute function public.trg_set_comment_identity();

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
