select coalesce(channel_group, 'Unassigned') as channel, sum(sessions) as sessions, sum(engaged_sessions) as engaged_sessions
from int_web__traffic_daily
where date_native between @start_date and @end_date
group by channel
order by sessions desc
