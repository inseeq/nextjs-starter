select coalesce(t.channel_key, 'unknown') as channel, count(*) as leads, countif(l.is_demo_booked) as booked
from int_funnel__leads as l
left join int_funnel__touches as t on t.touch_evidence_key = l.first_touch_evidence_key
where l.submitted_date_local between @start_date and @end_date
group by channel
order by leads desc, channel
