select date_native as day, sum(sessions) as sessions, sum(engaged_sessions) as engaged_sessions, sum(new_users) as new_users
from int_web__traffic_daily
where date_native between @start_date and @end_date
group by day
order by day
