select p.platform, coalesce(c.name, 'Unnamed campaign') as campaign, sum(p.spend_amount) as spend, sum(p.clicks) as clicks
from int_ads__performance_daily as p
left join int_ads__object_tree as c on c.campaign_key = p.campaign_key and c.object_level = 'campaign'
where not p.is_detail and p.date_native between @start_date and @end_date
group by p.platform, p.campaign_key, campaign
having spend > 0
order by spend desc
limit 10
