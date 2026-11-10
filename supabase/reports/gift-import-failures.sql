select
  merchant,
  sum(attempt_count) as incomplete_attempts,
  count(*) as distinct_urls,
  max(last_attempt_at) as last_incomplete_attempt_at
from santa.gift_import_failures
group by merchant
order by incomplete_attempts desc, distinct_urls desc, merchant;
