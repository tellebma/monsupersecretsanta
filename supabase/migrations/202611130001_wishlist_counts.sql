create or replace function public.santa_edition(p_edition uuid) returns jsonb
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
      'members',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',name,'email',email,'selected',selected,
          'gift_count',(select count(*) from santa.gifts gift where gift.owner_id=member.user_id and not gift.archived)) order by name)
        from santa.members member where edition_id=p_edition),'[]'),
      'pending',coalesce((select jsonb_agg(email order by email)
        from santa.invites where edition_id=p_edition and accepted_by is null),'[]'),
      'exceptions',coalesce((select jsonb_agg(jsonb_build_array(first_id,second_id))
        from santa.exceptions where edition_id=p_edition),'[]')
    );
  end if;
  return v_result;
end
$$;

