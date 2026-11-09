create schema santa;
revoke all on schema santa from public, anon, authenticated;

create table santa.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users,
  name text not null check (length(trim(name)) between 1 and 100)
);
create table santa.editions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references santa.groups,
  year int not null,
  draw_at timestamptz not null,
  exchange_at timestamptz not null check (exchange_at > draw_at),
  budget numeric(10,2) check (budget > 0),
  state text not null default 'draft' check (state in ('draft', 'scheduled', 'blocked', 'drawn')),
  version int not null default 0,
  drawn_at timestamptz,
  unique (group_id, year)
);
create table santa.members (
  edition_id uuid not null references santa.editions,
  user_id uuid not null references auth.users,
  name text not null check (length(trim(name)) between 1 and 80),
  email text not null,
  selected boolean not null default true,
  primary key (edition_id, user_id)
);
create table santa.exceptions (
  edition_id uuid not null references santa.editions,
  first_id uuid not null,
  second_id uuid not null,
  check (first_id < second_id),
  primary key (edition_id, first_id, second_id),
  foreign key (edition_id, first_id) references santa.members,
  foreign key (edition_id, second_id) references santa.members
);
create table santa.draws (
  edition_id uuid not null references santa.editions,
  giver_id uuid not null,
  receiver_id uuid not null,
  revealed boolean not null default false,
  check (giver_id <> receiver_id),
  primary key (edition_id, giver_id),
  unique (edition_id, receiver_id),
  foreign key (edition_id, giver_id) references santa.members,
  foreign key (edition_id, receiver_id) references santa.members
);
create table santa.gifts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users,
  name text not null check (length(trim(name)) between 1 and 200),
  description text not null check (length(trim(description)) between 1 and 3000),
  links jsonb not null default '[]',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on santa.gifts (owner_id) where not archived;
create table santa.claims (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references santa.gifts,
  edition_id uuid not null,
  giver_id uuid not null,
  state text not null check (state in ('reserved', 'bought', 'released', 'expired')),
  expires_at timestamptz not null,
  snapshot jsonb not null,
  foreign key (edition_id, giver_id) references santa.draws
);
create unique index one_active_claim on santa.claims (gift_id) where state in ('reserved', 'bought');
create index on santa.claims (edition_id, giver_id);
create index on santa.claims (expires_at) where state='reserved';
create table santa.invites (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references santa.editions,
  email text not null,
  token_hash bytea not null unique,
  code_hash bytea,
  code_expires_at timestamptz,
  code_requested_at timestamptz,
  attempts int not null default 0,
  accepted_by uuid references auth.users,
  unique (edition_id, email)
);
create table santa.outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null,
  email text not null,
  payload jsonb not null,
  due_at timestamptz not null default now(),
  attempts int not null default 0,
  leased_until timestamptz,
  sent_at timestamptz
);
create index on santa.outbox (due_at) where sent_at is null;

create function santa.owned(p_edition uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from santa.editions e join santa.groups g on g.id=e.group_id
    where e.id=p_edition and g.owner_id=auth.uid())
$$;

create function santa.queue(p_key text, p_kind text, p_email text, p_payload jsonb, p_due timestamptz default now()) returns void
language sql set search_path = '' as $$
  insert into santa.outbox(event_key,kind,email,payload,due_at)
    values(p_key,p_kind,p_email,p_payload,p_due) on conflict(event_key) do nothing
$$;

create function public.santa_groups() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'group_id',g.id,'name',g.name,'year',e.year,'draw_at',e.draw_at,
    'exchange_at',e.exchange_at,'state',e.state,'owner',g.owner_id=auth.uid()
  ) order by e.year desc, e.draw_at), '[]')
  from santa.editions e join santa.groups g on g.id=e.group_id
  left join santa.members m on m.edition_id=e.id and m.user_id=auth.uid()
  where g.owner_id=auth.uid() or m.user_id is not null
$$;

create function public.santa_create_edition(p_group uuid,p_name text,p_draw timestamptz,p_exchange timestamptz,p_budget numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_group uuid := p_group; v_edition uuid;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  if p_draw <= now() or p_exchange <= p_draw then
    raise exception 'Le tirage doit être à venir et précéder l’échange.';
  end if;
  if p_group is null then
    insert into santa.groups(owner_id,name) values(auth.uid(),trim(p_name)) returning id into v_group;
  elsif not exists (select 1 from santa.groups where id=p_group and owner_id=auth.uid()) then
    raise exception 'Groupe inaccessible.';
  else
    perform 1 from santa.groups where id=p_group for update;
    if exists (select 1 from santa.editions where group_id=p_group and
      (state<>'drawn' or year>=extract(year from p_exchange at time zone 'Europe/Paris'))) then
      raise exception 'Créez une édition ultérieure après le tirage de l’édition précédente.';
    end if;
  end if;
  insert into santa.editions(group_id,year,draw_at,exchange_at,budget)
    values(v_group,extract(year from p_exchange at time zone 'Europe/Paris'),p_draw,p_exchange,p_budget)
    returning id into v_edition;
  return v_edition;
exception when unique_violation then
  raise exception 'Une édition existe déjà pour ce groupe et cette année.';
end
$$;

create function public.santa_edition(p_edition uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_owner boolean := santa.owned(p_edition); v_result jsonb;
begin
  if not v_owner and not exists (
    select 1 from santa.members where edition_id=p_edition and user_id=auth.uid()
  ) then return null; end if;
  select jsonb_build_object('id',e.id,'group_id',g.id,'name',g.name,'year',e.year,
    'state',e.state,'draw_at',e.draw_at,'exchange_at',e.exchange_at,'budget',e.budget,
    'owner',v_owner,'can_reveal', d.giver_id is not null,
    'recipient',case when d.revealed then r.name end)
  into v_result from santa.editions e join santa.groups g on g.id=e.group_id
  left join santa.draws d on d.edition_id=e.id and d.giver_id=auth.uid()
  left join santa.members r on r.edition_id=e.id and r.user_id=d.receiver_id where e.id=p_edition;
  if v_owner then
    v_result := v_result || jsonb_build_object(
      'members',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'email',email,'selected',selected) order by name)
        from santa.members where edition_id=p_edition),'[]'),
      'pending',coalesce((select jsonb_agg(email order by email)
        from santa.invites where edition_id=p_edition and accepted_by is null),'[]'),
      'exceptions',coalesce((select jsonb_agg(jsonb_build_array(first_id,second_id))
        from santa.exceptions where edition_id=p_edition),'[]')
    );
  end if;
  return v_result;
end
$$;

create function public.santa_invite(p_edition uuid,p_emails text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v_edition santa.editions; v_email text; v_token text; v_id uuid; v_count int := 0;
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  select * into v_edition from santa.editions where id=p_edition for update;
  if v_edition.state not in ('draft','blocked') then raise exception 'Rouvrez la liste pour inviter des participants.'; end if;
  if cardinality(p_emails) not between 1 and 100 then raise exception 'Saisissez entre 1 et 100 adresses.'; end if;
  foreach v_email in array p_emails loop
    v_email := lower(trim(v_email));
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 then
      raise exception 'Vérifiez les adresses mail saisies.';
    end if;
    v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into santa.invites(edition_id,email,token_hash) values(p_edition,v_email,sha256(convert_to(v_token,'UTF8')))
      on conflict(edition_id,email) do nothing returning id into v_id;
    if v_id is not null then
      perform santa.queue('invite:'||v_id,'invite',v_email,jsonb_build_object(
        'token',v_token,'group',(select name from santa.groups where id=v_edition.group_id)));
      v_count := v_count+1;
    end if;
  end loop;
  return v_count;
end
$$;

create function public.santa_join(p_token text,p_name text,p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_invite santa.invites; v_edition santa.editions; v_code text; v_own_email text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  select * into v_invite from santa.invites where token_hash=sha256(convert_to(p_token,'UTF8'));
  if not found then return jsonb_build_object('status','invalid'); end if;
  select * into v_edition from santa.editions where id=v_invite.edition_id for update;
  select * into v_invite from santa.invites where id=v_invite.id for update;
  if v_invite.accepted_by=auth.uid() then
    return jsonb_build_object('status','joined','edition',v_invite.edition_id);
  end if;
  if v_invite.accepted_by is not null or v_edition.state not in ('draft','blocked') then
    return jsonb_build_object('status','invalid');
  end if;
  select lower(email) into v_own_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_own_email is distinct from v_invite.email then
    if nullif(trim(p_code),'') is null then
      if v_invite.code_requested_at > now()-interval '1 minute' then
        return jsonb_build_object('status','code_sent');
      end if;
      v_code := upper(left(replace(gen_random_uuid()::text,'-',''),8));
      update santa.invites set code_hash=sha256(convert_to(v_code,'UTF8')),
        code_expires_at=now()+interval '15 minutes',code_requested_at=now(),attempts=0 where id=v_invite.id;
      perform santa.queue('code:'||gen_random_uuid(),'invite_code',v_invite.email,jsonb_build_object('code',v_code));
      return jsonb_build_object('status','code_sent');
    end if;
    if v_invite.code_expires_at is null or v_invite.code_expires_at <= now() or v_invite.attempts >= 5 then
      return jsonb_build_object('status','expired_code');
    end if;
    if sha256(convert_to(upper(trim(p_code)),'UTF8')) is distinct from v_invite.code_hash then
      update santa.invites set attempts=attempts+1 where id=v_invite.id;
      return jsonb_build_object('status','bad_code');
    end if;
  end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 80 then
    raise exception 'Saisissez un prénom ou un nom d’affichage.';
  end if;
  if exists(select 1 from santa.members where edition_id=v_edition.id and user_id=auth.uid() and email<>v_invite.email) then
    return jsonb_build_object('status','already_member');
  end if;
  insert into santa.members(edition_id,user_id,name,email) values(v_edition.id,auth.uid(),trim(p_name),v_invite.email)
    on conflict(edition_id,user_id) do update set name=excluded.name;
  update santa.invites set accepted_by=auth.uid(),code_hash=null where id=v_invite.id;
  return jsonb_build_object('status','joined','edition',v_edition.id);
end
$$;

create function public.santa_add_host(p_edition uuid,p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_state text; v_email text;
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  select state into v_state from santa.editions where id=p_edition for update;
  if v_state not in ('draft','blocked') then raise exception 'Rouvrez la liste des participants.'; end if;
  select email into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Vérifiez votre adresse mail.'; end if;
  insert into santa.members(edition_id,user_id,name,email) values(p_edition,auth.uid(),trim(p_name),lower(v_email))
    on conflict(edition_id,user_id) do update set name=excluded.name;
end
$$;

create function public.santa_configure(p_edition uuid,p_draw timestamptz,p_exchange timestamptz,
  p_budget numeric,p_members uuid[],p_exceptions jsonb,p_schedule boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_edition santa.editions; v_pair jsonb; v_a uuid; v_b uuid;
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  select * into v_edition from santa.editions where id=p_edition for update;
  if v_edition.state='drawn' then raise exception 'Le tirage est définitif.'; end if;
  if p_exchange<=p_draw or (p_schedule and p_draw<=now()) then
    raise exception 'Choisissez un futur tirage, avant la date de l’échange.';
  end if;
  if extract(year from p_exchange at time zone 'Europe/Paris')<>v_edition.year then
    raise exception 'L’échange doit se dérouler dans l’année de cette édition.';
  end if;
  if p_schedule and (select count(*) from santa.members where edition_id=p_edition and user_id=any(p_members))<2 then
    raise exception 'Sélectionnez au moins deux participants qui ont rejoint le groupe.';
  end if;
  update santa.members set selected=user_id=any(p_members) where edition_id=p_edition;
  delete from santa.exceptions where edition_id=p_edition;
  for v_pair in select value from jsonb_array_elements(p_exceptions) loop
    v_a := (v_pair->>0)::uuid; v_b := (v_pair->>1)::uuid;
    if v_a is distinct from v_b then
      insert into santa.exceptions values(p_edition,least(v_a,v_b),greatest(v_a,v_b)) on conflict do nothing;
    end if;
  end loop;
  update santa.editions set draw_at=p_draw,exchange_at=p_exchange,budget=p_budget,
    state=case when p_schedule then 'scheduled' else 'draft' end,version=version+1 where id=p_edition;
end
$$;

create function public.santa_reveal(p_edition uuid) returns void
language sql security definer set search_path = '' as $$
  update santa.draws set revealed=true where edition_id=p_edition and giver_id=auth.uid()
$$;

create function public.santa_save_gift(p_id uuid,p_name text,p_description text,p_links jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_link jsonb;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  if jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links)>20 or octet_length(p_links::text)>75000 then
    raise exception 'Ajoutez au maximum 20 liens par cadeau.';
  end if;
  for v_link in select value from jsonb_array_elements(p_links) loop
    if coalesce(v_link->>'url','') !~* '^https?://[^[:space:]]+$' then raise exception 'Lien produit invalide.'; end if;
  end loop;
  if p_id is null then
    insert into santa.gifts(owner_id,name,description,links) values(auth.uid(),trim(p_name),trim(p_description),p_links)
      returning id into v_id;
  else
    update santa.gifts set name=trim(p_name),description=trim(p_description),links=p_links
      where id=p_id and owner_id=auth.uid() and not archived returning id into v_id;
    if not found then raise exception 'Cadeau introuvable.'; end if;
  end if;
  return v_id;
end
$$;

create function public.santa_remove_gift(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update santa.gifts set archived=true where id=p_id and owner_id=auth.uid()
$$;

create function public.santa_my_gifts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'links',g.links,
    'status',case when exists (select 1 from santa.claims c join santa.editions e on e.id=c.edition_id
      where c.gift_id=g.id and c.state='bought' and e.exchange_at<=now()) then 'bought' end)
    order by g.created_at desc),'[]')
  from santa.gifts g where g.owner_id=auth.uid() and not g.archived
$$;

create function public.santa_recipient_gifts(p_edition uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    (case when c.giver_id=auth.uid() and c.edition_id=p_edition then c.snapshot
      else jsonb_build_object('name',g.name,'description',g.description,'links',g.links) end)
    || jsonb_build_object('id',g.id,'status',case
      when c.state='bought' then 'bought'
      when c.state='reserved' and c.giver_id=auth.uid() and c.edition_id=p_edition then 'reserved'
      when c.state='reserved' then 'unavailable' end,
      'mine',coalesce(c.giver_id=auth.uid() and c.edition_id=p_edition,false))
    order by g.created_at desc),'[]')
  from santa.draws d join santa.gifts g on g.owner_id=d.receiver_id
  left join santa.claims c on c.gift_id=g.id and (c.state='bought' or (c.state='reserved' and c.expires_at>now()))
  where d.edition_id=p_edition and d.giver_id=auth.uid() and d.revealed
    and (not g.archived or (c.giver_id=auth.uid() and c.edition_id=p_edition))
$$;

create function public.santa_claim(p_edition uuid,p_gift uuid,p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_gift santa.gifts; v_claim santa.claims; v_email text; v_exchange timestamptz;
begin
  select g.* into v_gift from santa.gifts g join santa.draws d on d.receiver_id=g.owner_id
    where g.id=p_gift and d.edition_id=p_edition and d.giver_id=auth.uid() and d.revealed for update of g;
  if not found then raise exception 'Cadeau inaccessible.'; end if;
  select e.exchange_at,m.email into v_exchange,v_email from santa.editions e
    join santa.members m on m.edition_id=e.id where e.id=p_edition and m.user_id=auth.uid();
  if now()>=v_exchange then raise exception 'Cet échange est terminé.'; end if;
  update santa.claims set state='expired' where gift_id=p_gift and state='reserved' and expires_at<=now();
  select * into v_claim from santa.claims where gift_id=p_gift and state in ('reserved','bought');
  if p_action='reserve' then
    if v_gift.archived then raise exception 'Ce cadeau a été retiré de la liste.'; end if;
    if v_claim.id is not null then raise exception 'Ce cadeau est déjà indisponible.'; end if;
    insert into santa.claims(gift_id,edition_id,giver_id,state,expires_at,snapshot)
      values(p_gift,p_edition,auth.uid(),'reserved',now()+interval '14 days',
        jsonb_build_object('name',v_gift.name,'description',v_gift.description,'links',v_gift.links))
      returning * into v_claim;
    perform santa.queue('reservation:'||v_claim.id,'reservation',v_email,
      jsonb_build_object('claim',v_claim.id,'edition',p_edition,'gift',v_gift.name),now()+interval '5 days');
  elsif p_action in ('buy','release') then
    if v_claim.id is null or v_claim.giver_id<>auth.uid() or v_claim.edition_id<>p_edition or v_claim.state<>'reserved' then
      raise exception 'Cette réservation est arrivée à échéance ou n’est plus disponible.';
    end if;
    update santa.claims set state=case when p_action='buy' then 'bought' else 'released' end where id=v_claim.id;
  else raise exception 'Action inconnue.';
  end if;
end
$$;

create function santa.blocked(p_edition uuid) returns table(giver_id uuid,receiver_id uuid)
language sql stable set search_path = '' as $$
  select first_id,second_id from santa.exceptions where edition_id=p_edition
  union select second_id,first_id from santa.exceptions where edition_id=p_edition
  union select d.giver_id,d.receiver_id from santa.editions e
    join santa.editions prior on prior.group_id=e.group_id and prior.year between e.year-3 and e.year-1
    join santa.draws d on d.edition_id=prior.id where e.id=p_edition
$$;

create function public.santa_due_draws() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version,
    'members',coalesce((select jsonb_agg(user_id) from santa.members where edition_id=e.id and selected),'[]'),
    'blocked',coalesce((select jsonb_agg(jsonb_build_array(giver_id,receiver_id)) from santa.blocked(e.id)),'[]')
  )), '[]')
  from (select * from santa.editions where state='scheduled' and draw_at<=now() order by draw_at limit 10) e
$$;

create function public.santa_finish_draw(p_edition uuid,p_version int,p_assignments jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_edition santa.editions; v_name text; v_email text; v_payload jsonb; v_count int;
begin
  select * into v_edition from santa.editions where id=p_edition for update;
  if not found or v_edition.version<>p_version or v_edition.state<>'scheduled' or v_edition.draw_at>now() then
    return false;
  end if;
  select g.name,u.email into v_name,v_email from santa.groups g join auth.users u on u.id=g.owner_id
    where g.id=v_edition.group_id;
  v_payload := jsonb_build_object('edition',p_edition,'group',v_name);
  if p_assignments is null or v_edition.exchange_at<=now() then
    update santa.editions set state='blocked' where id=p_edition;
    perform santa.queue('blocked:'||p_edition||':'||p_version,'blocked',v_email,v_payload);
    return true;
  end if;
  select count(*) into v_count from santa.members where edition_id=p_edition and selected;
  if jsonb_array_length(p_assignments)<>v_count or v_count<2 then raise exception 'Tirage incomplet.'; end if;
  insert into santa.draws(edition_id,giver_id,receiver_id)
    select p_edition,a.giver,a.receiver from jsonb_to_recordset(p_assignments) as a(giver uuid,receiver uuid)
    join santa.members g on g.edition_id=p_edition and g.user_id=a.giver and g.selected
    join santa.members r on r.edition_id=p_edition and r.user_id=a.receiver and r.selected
    where not exists (select 1 from santa.blocked(p_edition) b where b.giver_id=a.giver and b.receiver_id=a.receiver);
  get diagnostics v_count = row_count;
  if v_count<>jsonb_array_length(p_assignments) then raise exception 'Le tirage enfreint une contrainte.'; end if;
  update santa.editions set state='drawn',drawn_at=now() where id=p_edition;
  perform santa.queue('draw:'||p_edition||':'||m.user_id,'draw',m.email,v_payload)
    from santa.members m where m.edition_id=p_edition and m.selected;
  perform santa.queue('empty:'||p_edition||':'||m.user_id,'empty',m.email,v_payload||jsonb_build_object('user',m.user_id),now()+interval '7 days')
    from santa.members m where m.edition_id=p_edition and m.selected and now()+interval '7 days'<v_edition.exchange_at;
  perform santa.queue('exchange:'||p_edition||':'||m.user_id,'exchange',m.email,v_payload,v_edition.exchange_at-interval '3 days')
    from santa.members m where m.edition_id=p_edition and m.selected;
  return true;
end
$$;

create function public.santa_due_mail() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_mail jsonb;
begin
  update santa.claims set state='expired' where state='reserved' and expires_at<=now();
  with due as (
    select o.id from santa.outbox o where o.sent_at is null and o.attempts<8 and o.due_at<=now()
      and (o.leased_until is null or o.leased_until<=now())
    order by o.due_at limit 24 for update skip locked
  ), leased as (
    update santa.outbox o set attempts=o.attempts+1,leased_until=now()+interval '5 minutes'
      from due where o.id=due.id returning o.id,o.attempts,o.kind,o.email,o.payload
  )
  select coalesce(jsonb_agg(to_jsonb(leased)), '[]') into v_mail from leased;
  return v_mail;
end
$$;

create function public.santa_mail_valid(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select case o.kind
    when 'reservation' then exists (select 1 from santa.claims c join santa.editions e on e.id=c.edition_id
      where c.id=(o.payload->>'claim')::uuid and c.state='reserved' and c.expires_at>now() and e.exchange_at>now())
    when 'empty' then not exists (select 1 from santa.gifts where owner_id=(o.payload->>'user')::uuid and not archived)
      and exists (select 1 from santa.editions where id=(o.payload->>'edition')::uuid and exchange_at>now())
    when 'exchange' then exists (select 1 from santa.editions where id=(o.payload->>'edition')::uuid and exchange_at>now())
    when 'invite_code' then o.due_at>now()-interval '15 minutes'
    else true end from santa.outbox o where o.id=p_id), false)
$$;

create function public.santa_mail_result(p_id uuid,p_attempt int,p_ok boolean) returns void
language sql security definer set search_path = '' as $$
  update santa.outbox set sent_at=case when p_ok then now() end,leased_until=null,
    due_at=case when p_ok then due_at else now()+make_interval(mins=>least(60,attempts*3)) end,
    payload=case when p_ok then '{}'::jsonb else payload end
    where id=p_id and attempts=p_attempt and sent_at is null
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature,p.proname as name from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'santa_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    if f.name in ('santa_due_draws','santa_finish_draw','santa_due_mail','santa_mail_valid','santa_mail_result') then
      execute format('grant execute on function %s to service_role',f.signature);
    else
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end
$$;
