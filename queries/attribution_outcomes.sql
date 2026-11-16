-- Conversions in the period that @channel touched at account level, with their declared and sourced channel.
with conversions as (
  -- The declared policy has one row per conversion and scope, so it carries each conversion once.
  select conversion_key, conversion_type, conversion_date_local, amount, currency, is_amount_outlier, has_touch_evidence, source_id, deal_id, company_id
  from attr_touch_credit
  where policy_id = 'declared'
    and scope = 'account'
    and conversion_type = @conversion_type
    and conversion_date_local between @start_date and @end_date
),

credit as (
  select
    conversion_key,
    max(if(policy_id = 'declared', channel_key, null)) as declared_channel,
    max(if(policy_id = 'declared', channel_name, null)) as declared_name,
    max(if(policy_id = 'sourced', channel_key, null)) as sourced_channel,
    max(if(policy_id = 'sourced', channel_name, null)) as sourced_name
  from attr_touch_credit
  where scope = 'account'
    and conversion_type = @conversion_type
    and conversion_date_local between @start_date and @end_date
  group by conversion_key
  having logical_or(policy_id = 'any_touch' and channel_key = @channel)
)

select
  c.conversion_key as outcome_id,
  coalesce(d.deal_name, co.company_name) as name,
  c.conversion_date_local as outcome_date,
  if(c.is_amount_outlier, null, c.amount) as amount,
  c.currency,
  case
    when c.conversion_type = 'lead' then 'lead'
    when d.is_closed_won then 'won'
    when d.is_closed_lost then 'lost'
    else 'open'
  end as status,
  d.created_date_local as deal_created_date,
  if(d.is_closed_won, d.won_date_local, d.closed_date_local) as closed_date,
  cr.declared_channel,
  cr.declared_name,
  cr.sourced_channel,
  cr.sourced_name,
  c.has_touch_evidence as is_tracked
from conversions as c
inner join credit as cr on cr.conversion_key = c.conversion_key
left join int_crm__deals as d on d.source_id = c.source_id and d.deal_id = c.deal_id
left join int_crm__companies as co on co.source_id = c.source_id and co.company_id = c.company_id
order by outcome_date desc, outcome_id
