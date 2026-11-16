-- Touches by colleagues reached through the company, not by the lead or deal contacts.
select channel_key as channel, count(*) as touches, count(distinct conversion_key) as outcomes
from attr_conversion_touches
where scope = 'account'
  and not is_direct_member
  and conversion_type = @conversion_type
  and conversion_date_local between @start_date and @end_date
group by channel
order by touches desc, channel
