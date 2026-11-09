import { ColumnChart, COLORS, MUTED, RankedBars } from '../components/charts.tsx';
import { Card, DataTable, EmptyState, Grid, KpiRow, Numbers } from '../components/ui.tsx';
import { dateParams, runQuery } from '../lib/data.ts';
import { count, humanize, num, percent, ratio, shortDay } from '../lib/format.ts';
import type { Dashboard, ViewProps } from './types.ts';

const NO_DATA = <EmptyState title="No leads in these days">Leads appear here once your forms are set up in inseeq. Try a longer range.</EmptyState>;
const RECENT = 'Recent leads may still book, so the newest days read low.';

const CHANNELS: Record<string, string> = {
  paid_search_google: 'Google search ads',
  paid_social_meta: 'Meta ads',
  paid_social_linkedin: 'LinkedIn ads',
  organic_search: 'Organic search',
  ai_assistant: 'AI assistants',
  outbound_email_phone: 'Outbound email and phone',
  outbound_linkedin: 'Outbound LinkedIn',
  unknown: 'Unknown',
};
const channelLabel = (key: string) => CHANNELS[key] ?? humanize(key);

async function Leads({ period }: ViewProps) {
  const { rows } = await runQuery('pipeline_daily', dateParams(period.previousStart, period.end));
  if (!rows.some((r) => String(r.day) >= period.start)) return NO_DATA;

  const sum = (from: string, to: string, column: string) => rows.filter((r) => String(r.day) >= from && String(r.day) <= to).reduce((total, r) => total + num(r[column]), 0);
  const leads = sum(period.start, period.end, 'leads');
  const booked = sum(period.start, period.end, 'booked');
  const leadsBefore = sum(period.previousStart, period.previousEnd, 'leads');
  const bookedBefore = sum(period.previousStart, period.previousEnd, 'booked');
  const byDay = new Map(rows.map((r) => [String(r.day), { leads: num(r.leads), booked: num(r.booked) }]));
  const at = (day: string) => byDay.get(day) ?? { leads: 0, booked: 0 };
  const compare = `vs previous ${period.days.length} days`;

  return (
    <>
      <KpiRow
        kpis={[
          { label: 'Leads', value: count(leads), current: leads, previous: leadsBefore, compareLabel: compare },
          { label: 'Booked a demo', value: count(booked), current: booked, previous: bookedBefore, compareLabel: compare },
          { label: 'Booking rate', value: percent(ratio(booked, leads)), current: ratio(booked, leads), previous: ratio(bookedBefore, leadsBefore), compareLabel: compare },
        ]}
      />
      <Grid>
        <Card title="Leads per day" subtitle={period.label} footnote={RECENT}>
          <ColumnChart
            label="Leads per day, split by whether they booked a demo"
            days={period.days}
            format={(v) => count(v)}
            series={[
              { key: 'booked', label: 'Booked a demo', color: COLORS[0], values: period.days.map((d) => at(d).booked) },
              { key: 'open', label: 'No demo yet', color: MUTED, values: period.days.map((d) => at(d).leads - at(d).booked) },
            ]}
          />
          <Numbers>
            <DataTable
              rowKey={(day) => day}
              rows={period.days}
              columns={[
                { label: 'Day', value: (day) => shortDay(day) },
                { label: 'Leads', numeric: true, value: (day) => count(at(day).leads) },
                { label: 'Booked a demo', numeric: true, value: (day) => count(at(day).booked) },
              ]}
            />
          </Numbers>
        </Card>
      </Grid>
    </>
  );
}

async function Channels({ period }: ViewProps) {
  const { rows } = await runQuery('pipeline_channels', dateParams(period.start, period.end));
  if (rows.length === 0) return NO_DATA;
  const channels = rows.map((r) => ({ key: String(r.channel), label: channelLabel(String(r.channel)), leads: num(r.leads), booked: num(r.booked) }));

  return (
    <Grid>
      <Card title="Leads by first touch" subtitle={period.label} footnote={`The channel of each lead's first visit or reply. ${RECENT}`}>
        <RankedBars
          label="Leads by first-touch channel"
          format={(v) => count(v)}
          rows={channels.map((c) => ({ key: c.key, label: c.label, value: c.leads, note: `${count(c.booked)} booked` }))}
        />
        <Numbers>
          <DataTable
            rowKey={(c) => c.key}
            rows={channels}
            columns={[
              { label: 'Channel', value: (c) => c.label },
              { label: 'Leads', numeric: true, value: (c) => count(c.leads) },
              { label: 'Booked a demo', numeric: true, value: (c) => count(c.booked) },
              { label: 'Booking rate', numeric: true, value: (c) => percent(ratio(c.booked, c.leads)) },
            ]}
          />
        </Numbers>
      </Card>
    </Grid>
  );
}

export const pipeline: Dashboard = {
  slug: 'pipeline',
  title: 'Pipeline',
  description: 'Leads from your forms, and how many booked a demo.',
  icon: 'funnel',
  tabs: [
    { slug: 'leads', title: 'Leads', View: Leads },
    { slug: 'channels', title: 'Channels', View: Channels },
  ],
};
