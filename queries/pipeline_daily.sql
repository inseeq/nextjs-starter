select submitted_date_local as day, count(*) as leads, countif(is_demo_booked) as booked
from int_funnel__leads
where submitted_date_local between @start_date and @end_date
group by day
order by day
