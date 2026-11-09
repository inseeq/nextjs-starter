import { COLORS, LineChart, RankedBars } from '../components/charts.tsx';
import { Card, DataTable, EmptyState, Grid, KpiRow, Numbers } from '../components/ui.tsx';
import { dateParams, runQuery } from '../lib/data.ts';
import { count, num, percent, ratio, shortDay } from '../lib/format.ts';
import type { Dashboard, ViewProps } from './types.ts';

const NO_DATA = <EmptyState title="No website data yet">Connect Google Analytics and this page fills in after the next refresh.</EmptyState>;

async function Traffic({ period }: ViewProps) {
  const { rows } = await runQuery('website_daily', dateParams(period.previousStart, period.end));
  if (rows.length === 0) return NO_DATA;

  const sum = (from: string, to: string, column: string) => rows.filter((r) => String(r.day) >= from && String(r.day) <= to).reduce((total, r) => total + num(r[column]), 0);
  const now = (column: string) => sum(period.start, period.end, column);
  const before = (column: string) => sum(period.previousStart, period.previousEnd, column);
  const sessionsByDay = new Map(rows.map((r) => [String(r.day), num(r.sessions)]));
  const values = period.days.map((day) => sessionsByDay.get(day) ?? 0);
  const compare = `vs previous ${period.days.length} days`;

  return (
    <>
      <KpiRow
        kpis={[
          { label: 'Sessions', value: count(now('sessions'), { compact: true }), current: now('sessions'), previous: before('sessions'), compareLabel: compare },
          { label: 'Engaged sessions', value: percent(ratio(now('engaged_sessions'), now('sessions'))), current: ratio(now('engaged_sessions'), now('sessions')), previous: ratio(before('engaged_sessions'), before('sessions')), compareLabel: compare },
          { label: 'New users', value: count(now('new_users'), { compact: true }), current: now('new_users'), previous: before('new_users'), compareLabel: compare },
        ]}
      />
      <Grid>
        <Card title="Sessions per day" subtitle={period.label}>
          <LineChart label="Sessions per day" days={period.days} series={[{ key: 'sessions', label: 'Sessions', color: COLORS[0], values }]} format={(v) => count(v)} axisFormat={(v) => count(v, { compact: true })} />
          <Numbers>
            <DataTable
              rowKey={(day) => day}
              rows={period.days}
              columns={[
                { label: 'Day', value: (day) => shortDay(day) },
                { label: 'Sessions', numeric: true, value: (day) => count(sessionsByDay.get(day) ?? 0) },
              ]}
            />
          </Numbers>
        </Card>
      </Grid>
    </>
  );
}

async function Channels({ period }: ViewProps) {
  const { rows } = await runQuery('website_channels', dateParams(period.start, period.end));
  if (rows.length === 0) return NO_DATA;
  const total = rows.reduce((sum, r) => sum + num(r.sessions), 0);
  const channels = rows.map((r) => ({ key: String(r.channel), label: String(r.channel), sessions: num(r.sessions), engaged: num(r.engaged_sessions) }));

  return (
    <Grid>
      <Card title="Sessions by channel" subtitle={period.label} footnote="Channels as Google Analytics groups them.">
        <RankedBars label="Sessions by channel" format={(v) => count(v)} rows={channels.map((c) => ({ key: c.key, label: c.label, value: c.sessions }))} />
        <Numbers>
          <DataTable
            rowKey={(c) => c.key}
            rows={channels}
            columns={[
              { label: 'Channel', value: (c) => c.label },
              { label: 'Sessions', numeric: true, value: (c) => count(c.sessions) },
              { label: 'Share', numeric: true, value: (c) => percent(ratio(c.sessions, total)) },
              { label: 'Engaged', numeric: true, value: (c) => percent(ratio(c.engaged, c.sessions)) },
            ]}
          />
        </Numbers>
      </Card>
    </Grid>
  );
}

export const website: Dashboard = {
  slug: 'website',
  title: 'Website',
  description: 'Visits to your site from Google Analytics.',
  icon: 'globe',
  tabs: [
    { slug: 'traffic', title: 'Traffic', View: Traffic },
    { slug: 'channels', title: 'Channels', View: Channels },
  ],
};
