-- One-time cleanup after deploying manual-only gift descriptions.
-- Only an exact match with saved merchant text identifies an imported gift description.
-- User-written/edited text and every other gift or reservation field are preserved.
with prepared_gifts as materialized (
  select g.id, g.description as original_description, g.links as original_links,
    nullif(btrim(g.description), '') is not null and exists (
      select 1 from jsonb_array_elements(g.links) l
      where nullif(btrim(l->>'description'), '') = btrim(g.description)
    ) as imported_description,
    coalesce((select jsonb_agg(l - 'description' order by position)
      from jsonb_array_elements(g.links) with ordinality as entries(l, position)), '[]'::jsonb) as clean_links
  from santa.gifts g
), cleaned_gifts as (
  update santa.gifts g set
    description = case when p.imported_description then '' else g.description end,
    links = p.clean_links
  from prepared_gifts p
  where g.id = p.id and g.description = p.original_description and g.links = p.original_links
    and (p.imported_description or g.links is distinct from p.clean_links)
  returning p.imported_description
), prepared_claims as materialized (
  select c.id, c.snapshot as original_snapshot,
    nullif(btrim(c.snapshot->>'description'), '') is not null and exists (
      select 1 from jsonb_array_elements(coalesce(c.snapshot->'links', '[]'::jsonb)) l
      where nullif(btrim(l->>'description'), '') = btrim(c.snapshot->>'description')
    ) as imported_description,
    coalesce((select jsonb_agg(l - 'description' order by position)
      from jsonb_array_elements(coalesce(c.snapshot->'links', '[]'::jsonb)) with ordinality as entries(l, position)), '[]'::jsonb) as clean_links
  from santa.claims c
  where jsonb_typeof(c.snapshot->'links') = 'array'
), cleaned_claims as (
  update santa.claims c set snapshot = jsonb_set(
    case when p.imported_description then jsonb_set(c.snapshot, '{description}', '""'::jsonb) else c.snapshot end,
    '{links}', p.clean_links)
  from prepared_claims p
  where c.id = p.id and c.snapshot = p.original_snapshot
    and (p.imported_description or c.snapshot->'links' is distinct from p.clean_links)
  returning p.imported_description
)
select
  (select count(*) from cleaned_gifts) as gifts_updated,
  (select count(*) from cleaned_gifts where imported_description) as gift_descriptions_cleared,
  (select count(*) from cleaned_claims) as reservations_updated,
  (select count(*) from cleaned_claims where imported_description) as reservation_descriptions_cleared;
