-- One invitation per edition, shared manually by its organizer.
create table santa.shared_invitations (
  edition_id uuid primary key references santa.editions,
  token text not null unique check (token ~ '^[a-f0-9]{64}$')
);
create table santa.invitation_names (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references santa.shared_invitations,
  name text not null check (length(trim(name)) between 1 and 80),
  user_id uuid references auth.users,
  unique (edition_id, user_id)
);
create unique index invitation_names_unique_name on santa.invitation_names (edition_id, lower(name));
alter table santa.shared_invitations enable row level security;
alter table santa.invitation_names enable row level security;
revoke all on santa.shared_invitations, santa.invitation_names from public, anon, authenticated;

create function public.santa_shared_invitation(p_edition uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  return (select jsonb_build_object('token',s.token,'participants',coalesce((
    select jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'joined',n.user_id is not null) order by n.name)
    from santa.invitation_names n where n.edition_id=p_edition
  ),'[]'::jsonb)) from santa.shared_invitations s where s.edition_id=p_edition);
end
$$;

create function public.santa_add_invitation_names(p_edition uuid,p_names text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_state text; v_name text;
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  select state into v_state from santa.editions where id=p_edition for update;
  if v_state not in ('draft','blocked') then raise exception 'Rouvrez les inscriptions pour modifier les invitations.'; end if;
  if coalesce(cardinality(p_names),0) not between 1 and 100 then raise exception 'Saisissez entre 1 et 100 noms.'; end if;
  insert into santa.shared_invitations(edition_id,token) values(p_edition,
    replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
    on conflict(edition_id) do nothing;
  foreach v_name in array p_names loop
    if v_name is null or length(trim(v_name)) not between 1 and 80 then raise exception 'Chaque nom doit contenir entre 1 et 80 caractères.'; end if;
    insert into santa.invitation_names(edition_id,name) values(p_edition,trim(v_name)) on conflict do nothing;
  end loop;
  if (select count(*) from santa.invitation_names where edition_id=p_edition)>100 then
    raise exception 'La liste est limitée à 100 noms.';
  end if;
end
$$;

create function public.santa_remove_invitation_name(p_edition uuid,p_name uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_state text;
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  select state into v_state from santa.editions where id=p_edition for update;
  if v_state not in ('draft','blocked') then raise exception 'Rouvrez les inscriptions pour modifier les invitations.'; end if;
  delete from santa.invitation_names where edition_id=p_edition and id=p_name and user_id is null;
  if not found then raise exception 'Ce nom a déjà été choisi ou retiré.'; end if;
end
$$;

create or replace function public.santa_invitation_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_preview jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select jsonb_build_object('group',g.name,
    'organizer',coalesce(nullif(trim(m.name),''),nullif(left(trim(u.raw_user_meta_data->>'full_name'),80),'')),
    'shared',true,'open',e.state in ('draft','blocked'),
    'participants',case when e.state in ('draft','blocked') then coalesce((
      select jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'available',n.user_id is null) order by n.name)
      from santa.invitation_names n where n.edition_id=e.id
    ),'[]'::jsonb) else '[]'::jsonb end)
  into v_preview from santa.shared_invitations s
  join santa.editions e on e.id=s.edition_id
  join santa.groups g on g.id=e.group_id
  join auth.users u on u.id=g.owner_id
  left join santa.members m on m.edition_id=e.id and m.user_id=g.owner_id
  where s.token=p_token;
  if found then return v_preview; end if;
  -- Keep existing personal email invitation links working.
  return (select jsonb_build_object('group',g.name,
    'organizer',coalesce(nullif(trim(m.name),''),nullif(left(trim(u.raw_user_meta_data->>'full_name'),80),'')))
    from santa.invites i join santa.editions e on e.id=i.edition_id
    join santa.groups g on g.id=e.group_id join auth.users u on u.id=g.owner_id
    left join santa.members m on m.edition_id=e.id and m.user_id=g.owner_id
    where i.token_hash=sha256(convert_to(p_token,'UTF8')) and i.accepted_by is null and e.state in ('draft','blocked'));
end
$$;

create function public.santa_join_shared(p_token text,p_name uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_edition santa.editions; v_name santa.invitation_names; v_email text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid'); end if;
  select e.* into v_edition from santa.editions e join santa.shared_invitations s on s.edition_id=e.id
    where s.token=p_token for update of e;
  if not found then return jsonb_build_object('status','invalid'); end if;
  select * into v_name from santa.invitation_names where id=p_name and edition_id=v_edition.id for update;
  if not found then return jsonb_build_object('status','invalid'); end if;
  if v_name.user_id=auth.uid() then return jsonb_build_object('status','joined','edition',v_edition.id); end if;
  if v_edition.state not in ('draft','blocked') then return jsonb_build_object('status','closed'); end if;
  if v_name.user_id is not null then return jsonb_build_object('status','taken'); end if;
  if exists(select 1 from santa.members where edition_id=v_edition.id and user_id=auth.uid()) then
    return jsonb_build_object('status','already_member','edition',v_edition.id);
  end if;
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Vérifiez votre adresse mail pour rejoindre le groupe.'; end if;
  insert into santa.members(edition_id,user_id,name,email) values(v_edition.id,auth.uid(),v_name.name,v_email);
  update santa.invitation_names set user_id=auth.uid() where id=v_name.id;
  return jsonb_build_object('status','joined','edition',v_edition.id);
end
$$;

-- Removing a member also removes their claimed name, preventing reuse of that
-- identity through the shared link unless the organizer explicitly adds it again.
create function santa.remove_claimed_invitation_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from santa.invitation_names where edition_id=old.edition_id and user_id=old.user_id;
  return old;
end
$$;
revoke all on function santa.remove_claimed_invitation_name() from public, anon, authenticated;
create trigger remove_claimed_invitation_name after delete on santa.members
  for each row execute function santa.remove_claimed_invitation_name();

revoke all on function public.santa_shared_invitation(uuid),
  public.santa_add_invitation_names(uuid,text[]),public.santa_remove_invitation_name(uuid,uuid),
  public.santa_join_shared(text,uuid) from public, anon, authenticated;
grant execute on function public.santa_shared_invitation(uuid),
  public.santa_add_invitation_names(uuid,text[]),public.santa_remove_invitation_name(uuid,uuid),
  public.santa_join_shared(text,uuid) to authenticated;
revoke all on function public.santa_invitation_preview(text) from public, anon, authenticated;
grant execute on function public.santa_invitation_preview(text) to service_role;
