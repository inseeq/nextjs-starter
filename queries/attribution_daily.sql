-- The declared policy has one row per conversion and scope, so counting its rows counts conversions.
select
  c.conversion_date_local as day,
  count(distinct c.conversion_key) as outcomes,
  count(distinct if(c.has_touch_evidence, c.conversion_key, null)) as tracked,
  count(distinct if(c.currency = s.currency and c.credited_amount is not null, c.conversion_key, null)) as with_amount,
  count(distinct if(c.currency != s.currency and c.credited_amount is not null, c.conversion_key, null)) as other_currency,
  coalesce(sum(if(c.currency = s.currency, c.credited_amount, null)), 0) as value
from attr_touch_credit as c
cross join cfg_client as s
where c.policy_id = 'declared'
  and c.scope = 'account'
  and c.conversion_type = @conversion_type
  and c.conversion_date_local between @start_date and @end_date
group by day
order by day
