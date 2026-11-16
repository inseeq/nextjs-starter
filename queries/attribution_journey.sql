-- The account journey of one conversion. People are numbered, never named.
with names as (
  select channel_key, max(channel_name) as channel_name
  from attr_touch_credit
  group by channel_key
)

select
  t.touch_seq,
  t.occurred_date_local as day,
  t.channel_key as channel,
  n.channel_name as name,
  t.touch_type,
  t.evidence_count,
  t.is_direct_member,
  dense_rank() over (partition by t.is_direct_member order by t.person_key) as person,
  o.name as campaign,
  if(t.is_first_touch, 1, 0) as first_touch,
  if(t.is_last_touch, 1, 0) as last_touch,
  if(t.is_last_non_direct_touch, 1, 0) as last_non_direct,
  1 / t.touch_count as linear
from attr_conversion_touches as t
left join names as n on n.channel_key = t.channel_key
left join int_ads__object_tree as o on o.campaign_key = t.campaign_key and o.object_level = 'campaign'
where t.conversion_key = @outcome_id and t.scope = 'account'
order by t.touch_seq
