create table santa.catalog_search_budget (
  bucket text primary key,
  period date not null,
  requests integer not null
);

create function public.santa_take_catalog_search_budget(p_account uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'UTC')::date;
  month_start date := date_trunc('month', today::timestamp)::date;
  accepted integer;
begin
  if p_account is null then return false; end if;

  insert into santa.catalog_search_budget as budget (bucket, period, requests)
  values ('account:' || p_account, today, 1)
  on conflict (bucket) do update
    set period = excluded.period,
        requests = case when budget.period = excluded.period then budget.requests + 1 else 1 end
    where budget.period <> excluded.period or budget.requests < 25
  returning requests into accepted;
  if accepted is null then return false; end if;

  insert into santa.catalog_search_budget as budget (bucket, period, requests)
  values ('global', month_start, 1)
  on conflict (bucket) do update
    set period = excluded.period,
        requests = case when budget.period = excluded.period then budget.requests + 1 else 1 end
    where budget.period <> excluded.period or budget.requests < 1000
  returning requests into accepted;
  return accepted is not null;
end;
$$;

revoke all on function public.santa_take_catalog_search_budget(uuid) from public, anon, authenticated;
grant execute on function public.santa_take_catalog_search_budget(uuid) to service_role;
