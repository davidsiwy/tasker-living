-- Per-resident jazyk rozhraní (ne za dům, za člověka — dům může mít mix
-- českého výboru a cizojazyčných vlastníků). Default 'cs' dokud si nikdo
-- nevybere; frontend jinak detekuje jazyk prohlížeče při prvním vstupu.
alter table public.profiles
  add column if not exists language text not null default 'cs'
  check (language in ('cs', 'en', 'de'));
