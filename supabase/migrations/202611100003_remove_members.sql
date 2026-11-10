create function public.santa_remove_member(p_edition uuid,p_member uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_state text;
  v_email text;
  v_reopened boolean := false;
begin
  if not santa.owned(p_edition) then raise exception 'Groupe inaccessible.'; end if;
  select state into v_state from santa.editions where id=p_edition for update;
  if v_state='drawn' then raise exception 'Le tirage est définitif.'; end if;

  select email into v_email from santa.members where edition_id=p_edition and user_id=p_member;
  if not found then raise exception 'Ce participant a déjà été retiré.'; end if;

  delete from santa.exceptions where edition_id=p_edition and p_member in (first_id,second_id);
  with revoked as (
    delete from santa.invites where edition_id=p_edition and (accepted_by=p_member or (accepted_by is null and email=v_email))
    returning id
  )
  delete from santa.outbox as mail using revoked
    where mail.event_key='invite:'||revoked.id and mail.sent_at is null;
  delete from santa.members where edition_id=p_edition and user_id=p_member;

  if v_state='scheduled' and (select count(*) from santa.members where edition_id=p_edition and selected)<2 then
    v_state := 'draft';
    v_reopened := true;
  end if;
  update santa.editions set state=v_state,version=version+1 where id=p_edition;
  return jsonb_build_object('state',v_state,'reopened',v_reopened);
end
$$;

revoke all on function public.santa_remove_member(uuid,uuid) from public, anon, authenticated;
grant execute on function public.santa_remove_member(uuid,uuid) to authenticated;

create or replace function public.santa_join(p_token text,p_name text,p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_invite santa.invites; v_edition santa.editions; v_code text; v_own_email text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  select * into v_invite from santa.invites where token_hash=sha256(convert_to(p_token,'UTF8'));
  if not found then return jsonb_build_object('status','invalid'); end if;
  select * into v_edition from santa.editions where id=v_invite.edition_id for update;
  select * into v_invite from santa.invites where id=v_invite.id for update;
  if not found then return jsonb_build_object('status','invalid'); end if;
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
