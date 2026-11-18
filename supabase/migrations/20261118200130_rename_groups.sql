create function public.santa_rename_group(p_group uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour modifier ce groupe.'; end if;
  if v_name is null or length(v_name) not between 1 and 100 then
    raise exception 'Le nom du groupe doit contenir entre 1 et 100 caractères.';
  end if;
  update santa.groups set name = v_name where id = p_group and owner_id = auth.uid();
  if not found then raise exception 'Groupe inaccessible.'; end if;

  -- Queued invitations/reminders should use the new name too; sent mail stays unchanged.
  update santa.outbox set payload = jsonb_set(payload, '{group}', to_jsonb(v_name))
  where sent_at is null and payload ? 'group' and (
    payload->>'edition' in (select id::text from santa.editions where group_id = p_group)
    or event_key in (select 'invite:' || i.id from santa.invites i
      join santa.editions e on e.id = i.edition_id where e.group_id = p_group)
  );
end
$$;

revoke all on function public.santa_rename_group(uuid, text) from public, anon, authenticated;
grant execute on function public.santa_rename_group(uuid, text) to authenticated;
