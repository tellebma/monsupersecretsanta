alter table santa.gifts
  drop constraint gifts_description_check,
  alter column description set default '',
  add constraint gifts_description_check check (length(trim(description)) <= 3000);

create table santa.gift_import_failures (
  url text primary key check (length(url) <= 2048 and url ~ '^https://'),
  merchant text not null check (length(merchant) <= 253),
  attempt_count bigint not null default 1,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

create function public.santa_record_import_failure(p_url text,p_merchant text) returns void
language sql security definer set search_path = '' as $$
  insert into santa.gift_import_failures as failure(url,merchant)
    values(p_url,p_merchant)
    on conflict(url) do update set
      attempt_count=failure.attempt_count+1,
      last_attempt_at=now()
$$;

revoke all on function public.santa_record_import_failure(text,text) from public, anon, authenticated;
grant execute on function public.santa_record_import_failure(text,text) to service_role;
