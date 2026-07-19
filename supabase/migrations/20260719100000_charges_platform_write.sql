-- Operátor platformy potřebuje opravovat platby klientů (stavy, chybné předpisy).
-- Čtení už platform admin má (charges_read), tady doplňujeme zápis.
drop policy if exists charges_platform_write on public.charges;
create policy charges_platform_write on public.charges
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
