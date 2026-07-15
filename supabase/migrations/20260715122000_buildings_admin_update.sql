-- committee and developer can edit building payment settings and name
drop policy if exists buildings_admin_update on public.buildings;
create policy buildings_admin_update on public.buildings for update
  using (member_role(id) in ('vybor','developer') or is_platform_admin())
  with check (member_role(id) in ('vybor','developer') or is_platform_admin());
