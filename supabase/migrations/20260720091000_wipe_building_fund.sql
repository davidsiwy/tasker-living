-- wipe_building v3: čistí i fond oprav (reserve_fund_entries/settings)
create or replace function public.wipe_building(p_building uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare out jsonb := '{}'::jsonb; n int;
begin
  if not is_platform_admin() then
    raise exception 'Pouze pro operátora platformy';
  end if;
  if not exists (select 1 from public.buildings where id = p_building) then
    raise exception 'Dům nenalezen';
  end if;

  delete from public.post_reads    where post_id in (select id from public.posts where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('post_reads', n);
  delete from public.post_likes    where post_id in (select id from public.posts where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('post_likes', n);
  delete from public.post_comments where post_id in (select id from public.posts where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('post_comments', n);
  delete from public.ballots       where poll_id in (select id from public.polls where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('ballots', n);
  delete from public.proxies       where poll_id in (select id from public.polls where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('proxies', n);
  delete from public.fault_events  where fault_id in (select id from public.faults where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('fault_events', n);
  delete from public.fault_photos  where fault_id in (select id from public.faults where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('fault_photos', n);
  delete from public.meeting_rsvps where meeting_id in (select id from public.meetings where building_id = p_building); get diagnostics n = row_count; out := out || jsonb_build_object('meeting_rsvps', n);

  delete from public.reserve_fund_entries  where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('reserve_fund_entries', n);
  delete from public.reserve_fund_settings where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('reserve_fund_settings', n);
  delete from public.bank_txs         where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('bank_txs', n);
  delete from public.bank_connections where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('bank_connections', n);
  delete from public.messages      where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('messages', n);
  delete from public.notifications where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('notifications', n);
  delete from public.access_codes  where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('access_codes', n);
  delete from public.bookings      where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('bookings', n);
  delete from public.complaints    where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('complaints', n);
  delete from public.documents     where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('documents', n);
  delete from public.charges       where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('charges', n);
  delete from public.posts         where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('posts', n);
  delete from public.polls         where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('polls', n);
  delete from public.faults        where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('faults', n);
  delete from public.meetings      where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('meetings', n);
  delete from public.memberships   where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('memberships', n);
  delete from public.units         where building_id = p_building; get diagnostics n = row_count; out := out || jsonb_build_object('units', n);
  delete from public.buildings     where id = p_building;          get diagnostics n = row_count; out := out || jsonb_build_object('buildings', n);

  return out;
end;
$$;
