-- Credit per channel, policy and scope, with the channel's ad spend. A paid channel with spend and no credit gets one row without a policy.
with credit as (
  select
    c.channel_key,
    c.policy_id,
    c.scope,
    sum(c.credit) as credit,
    -- Amounts in another currency are left out: they never add to the client's.
    coalesce(sum(if(c.currency = s.currency, c.credited_amount, null)), 0) as value
  from attr_touch_credit as c
  cross join cfg_client as s
  where c.conversion_type = @conversion_type and c.conversion_date_local between @start_date and @end_date
  group by c.channel_key, c.policy_id, c.scope
),

channels as (
  select channel_key, max(channel_name) as channel_name, max(if(is_paid, platform, null)) as platform
  from attr_touch_credit
  group by channel_key
),

-- Ad platforms are google_ads, meta_ads and linkedin_ads here, google, meta and linkedin on the channel.
spend as (
  select replace(platform, '_ads', '') as platform, sum(spend_amount) as spend
  from int_ads__performance_daily
  where not is_detail and date_native between @start_date and @end_date
  group by 1
)

select ch.channel_key as channel, ch.channel_name as name, sp.spend, cr.policy_id as policy, cr.scope, cr.credit, cr.value
from channels as ch
left join credit as cr on cr.channel_key = ch.channel_key
left join spend as sp on sp.platform = ch.platform
where cr.channel_key is not null or sp.spend > 0
order by channel, policy, scope
