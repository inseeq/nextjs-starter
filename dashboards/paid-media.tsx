import { ColumnChart, COLORS, MUTED, RankedBars, type Series } from '../components/charts.tsx';
import { Card, DataTable, EmptyState, Grid, KpiRow, Numbers, Swatch } from '../components/ui.tsx';
import { dateParams, runQuery } from '../lib/data.ts';
import { count, money, num, percent, ratio, shortDay } from '../lib/format.ts';
import type { Dashboard, ViewProps } from './types.ts';

/** One color per platform, wherever it appears. */
const PLATFORMS: Record<string, { label: string; color: string }> = {
  google_ads: { label: 'Google Ads', color: COLORS[0] },
  meta_ads: { label: 'Meta Ads', color: COLORS[1] },
  linkedin_ads: { label: 'LinkedIn Ads', color: COLORS[2] },
};
const platform = (key: string) => PLATFORMS[key] ?? { label: key, color: MUTED };

interface Totals {
  spend: number;
  clicks: number;
  impressions: number;
}

const add = (a: Totals, b: Totals): Totals => ({ spend: a.spend + b.spend, clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions });
const ZERO: Totals = { spend: 0, clicks: 0, impressions: 0 };

async function Overview({ period }: ViewProps) {
  const { rows } = await runQuery('paid_media_daily', dateParams(period.previousStart, period.end));
  if (rows.length === 0) return <EmptyState title="No ad data yet">Connect Google, Meta or LinkedIn Ads and this page fills in after the next refresh.</EmptyState>;

  const days = period.days;
  const current = { ...ZERO };
  const previous = { ...ZERO };
  const byPlatform = new Map<string, Totals>();
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = String(row.day);
    const totals = { spend: num(row.spend), clicks: num(row.clicks), impressions: num(row.impressions) };
    if (day < period.start) {
      Object.assign(previous, add(previous, totals));
      continue;
    }
    Object.assign(current, add(current, totals));
    byPlatform.set(String(row.platform), add(byPlatform.get(String(row.platform)) ?? ZERO, totals));
    byDay.set(`${day}|${row.platform}`, totals.spend);
  }

  const keys = [...byPlatform.keys()].sort((a, b) => Object.keys(PLATFORMS).indexOf(a) - Object.keys(PLATFORMS).indexOf(b));
  const series: Series[] = keys.map((key) => ({ key, ...platform(key), values: days.map((day) => byDay.get(`${day}|${key}`) ?? 0) }));
  const usd = (value: number) => money(value, period.currency);
  const compare = `vs previous ${period.days.length} days`;
  const cpc = (t: Totals) => ratio(t.spend, t.clicks);

  return (
    <>
      <KpiRow
        kpis={[
          { label: 'Spend', value: money(current.spend, period.currency, { compact: true }), current: current.spend, previous: previous.spend, upIsGood: null, compareLabel: compare },
          { label: 'Clicks', value: count(current.clicks, { compact: true }), current: current.clicks, previous: previous.clicks, compareLabel: compare },
          { label: 'Cost per click', value: cpc(current) === null ? 'n/a' : usd(cpc(current)!), current: cpc(current), previous: cpc(previous), upIsGood: false, compareLabel: compare },
          { label: 'Click rate', value: percent(ratio(current.clicks, current.impressions)), current: ratio(current.clicks, current.impressions), previous: ratio(previous.clicks, previous.impressions), compareLabel: compare },
        ]}
      />
      <Grid>
        <Card title="Spend per day" subtitle={period.label}>
          <ColumnChart label="Spend per day by platform" days={days} series={series} format={usd} axisFormat={(v) => money(v, period.currency, { compact: true })} />
          <Numbers>
            <DataTable
              rowKey={(day) => day}
              rows={days}
              columns={[
                { label: 'Day', value: (day) => shortDay(day) },
                ...series.map((s) => ({ label: s.label, numeric: true, value: (day: string) => usd(s.values[days.indexOf(day)]) })),
              ]}
            />
          </Numbers>
        </Card>
        <Card title="By platform" subtitle={period.label}>
          <DataTable
            rowKey={(key) => key}
            rows={keys}
            total="total"
            columns={[
              { label: 'Platform', value: (key) => (key === 'total' ? 'Total' : <><Swatch color={platform(key).color} />{platform(key).label}</>) },
              { label: 'Spend', numeric: true, value: (key) => usd((key === 'total' ? current : byPlatform.get(key)!).spend) },
              { label: 'Share', numeric: true, value: (key) => percent(ratio((key === 'total' ? current : byPlatform.get(key)!).spend, current.spend)) },
              { label: 'Clicks', numeric: true, value: (key) => count((key === 'total' ? current : byPlatform.get(key)!).clicks) },
              { label: 'Cost per click', numeric: true, value: (key) => { const c = cpc(key === 'total' ? current : byPlatform.get(key)!); return c === null ? 'n/a' : usd(c); } },
            ]}
          />
        </Card>
      </Grid>
    </>
  );
}

async function Campaigns({ period }: ViewProps) {
  const { rows } = await runQuery('paid_media_campaigns', dateParams(period.start, period.end));
  if (rows.length === 0) return <EmptyState title="No campaign spend in these days">Try a longer range.</EmptyState>;
  const usd = (value: number) => money(value, period.currency);
  const campaigns = rows.map((row, i) => ({ key: String(i), label: String(row.campaign), platform: String(row.platform), spend: num(row.spend), clicks: num(row.clicks) }));
  const shown = [...new Set(campaigns.map((c) => c.platform))].map((key) => ({ key, ...platform(key) }));

  return (
    <Grid>
      <Card title="Top campaigns by spend" subtitle={period.label}>
        <ul className="legend">
          {shown.map((p) => (
            <li key={p.key}>
              <Swatch color={p.color} />
              {p.label}
            </li>
          ))}
        </ul>
        <RankedBars label="Top campaigns by spend" format={usd} rows={campaigns.map((c) => ({ key: c.key, label: c.label, value: c.spend, color: platform(c.platform).color }))} />
        <Numbers>
          <DataTable
            rowKey={(c) => c.key}
            rows={campaigns}
            columns={[
              { label: 'Campaign', value: (c) => c.label },
              { label: 'Platform', value: (c) => platform(c.platform).label },
              { label: 'Spend', numeric: true, value: (c) => usd(c.spend) },
              { label: 'Clicks', numeric: true, value: (c) => count(c.clicks) },
              { label: 'Cost per click', numeric: true, value: (c) => (c.clicks ? usd(c.spend / c.clicks) : 'n/a') },
            ]}
          />
        </Numbers>
      </Card>
    </Grid>
  );
}

export const paidMedia: Dashboard = {
  slug: 'paid-media',
  title: 'Paid media',
  description: 'Spend and clicks across Google, Meta and LinkedIn Ads.',
  icon: 'chart',
  tabs: [
    { slug: 'overview', title: 'Overview', View: Overview },
    { slug: 'campaigns', title: 'Campaigns', View: Campaigns },
  ],
};
