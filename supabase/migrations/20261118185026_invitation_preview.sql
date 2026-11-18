-- Server-only lookup: possession of the token permits displaying these two names,
-- but never grants membership or exposes participant addresses.
create function public.santa_invitation_preview(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'group', g.name,
    'organizer', coalesce(nullif(trim(m.name), ''),
      nullif(left(trim(u.raw_user_meta_data->>'full_name'), 80), ''))
  )
  from santa.invites i
  join santa.editions e on e.id = i.edition_id
  join santa.groups g on g.id = e.group_id
  join auth.users u on u.id = g.owner_id
  left join santa.members m on m.edition_id = e.id and m.user_id = g.owner_id
  where p_token ~ '^[a-f0-9]{64}$'
    and i.token_hash = sha256(convert_to(p_token, 'UTF8'))
    and i.accepted_by is null and e.state in ('draft', 'blocked');
$$;

revoke all on function public.santa_invitation_preview(text) from public, anon, authenticated;
grant execute on function public.santa_invitation_preview(text) to service_role;
