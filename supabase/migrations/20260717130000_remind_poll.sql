-- Připomínka nehlasujícím (handoff 4c: "Připomenout 9 nehlasujícím").
-- Notifikaci dostanou členové jednotek, které nemají hlas ani plnou moc.
create or replace function public.remind_poll(p_poll uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.polls; n int;
begin
  select * into p from public.polls where id = p_poll;
  if not found then raise exception 'Hlasování nenalezeno'; end if;
  if member_role(p.building_id) not in ('vybor','developer') and not is_platform_admin() then
    raise exception 'Pouze pro správu domu';
  end if;

  insert into public.notifications (user_id, building_id, icon, title, subtitle)
  select m.user_id, p.building_id, 'schuze',
         'Ještě jste nehlasovali',
         p.question
  from public.memberships m
  where m.building_id = p.building_id
    and m.unit_id is not null
    and not exists (select 1 from public.ballots b where b.poll_id = p.id and b.unit_id = m.unit_id)
    and not exists (select 1 from public.proxies x where x.poll_id = p.id and x.from_unit = m.unit_id);
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.remind_poll(uuid) from public;
grant execute on function public.remind_poll(uuid) to authenticated;
