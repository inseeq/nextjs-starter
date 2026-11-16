import Link from 'next/link';

import { COLORS, Legend, MUTED, RankedBars } from '../components/charts.tsx';
import { Card, DataTable, EmptyState, Grid, KpiRow, Numbers, Swatch, type Kpi } from '../components/ui.tsx';
import {
  getAttributionChannels,
  getAttributionCoverage,
  getAttributionOutcomes,
  getAttributionTotals,
  getAttributionTouches,
  type ChannelRow,
  type Outcome,
  type OutcomeRow,
  type TouchRow,
} from '../lib/attribution.ts';
import type { Period } from '../lib/data.ts';
import { count, humanize, money, percent, ratio, shortDay } from '../lib/format.ts';
import type { Dashboard, ViewProps } from './types.ts';

const CHANNELS: Record<string, { label: string; color: string }> = {
  paid_search_google: { label: 'Google Ads', color: COLORS[0] },
  paid_social_meta: { label: 'Meta Ads', color: COLORS[1] },
  paid_social_linkedin: { label: 'LinkedIn Ads', color: COLORS[2] },
  organic_search: { label: 'Organic search', color: COLORS[3] },
  email: { label: 'Email', color: COLORS[4] },
  outbound_email_phone: { label: 'Sales outreach', color: COLORS[5] },
  direct: { label: 'Direct', color: COLORS[6] },
};
const channelLabel = (key: string) => CHANNELS[key]?.label ?? humanize(key);
const channelColor = (key: string) => CHANNELS[key]?.color ?? MUTED;

const MODELS = [
  { key: 'linear', label: 'Linear', column: 'credit_linear' },
  { key: 'first', label: 'First touch', column: 'credit_first_touch' },
  { key: 'last', label: 'Last touch', column: 'credit_last_touch' },
  { key: 'last-non-direct', label: 'Last non-direct', column: 'credit_last_non_direct' },
] as const;

const WORDS: Record<Outcome, { total: string; one: string; many: string; date: string; perSpend: string }> = {
  pipeline: { total: 'Pipeline created', one: 'deal', many: 'deals', date: 'Created', perSpend: 'Pipeline to ad spend' },
  leads: { total: 'Leads', one: 'lead', many: 'leads', date: 'Lead', perSpend: 'Cost per lead' },
  won: { total: 'Revenue won', one: 'won deal', many: 'won deals', date: 'Won', perSpend: 'Revenue to ad spend' },
};
const STATUS: Record<OutcomeRow['status'], string> = { lead: 'Lead', open: 'Open', won: 'Won', lost: 'Lost' };

function kpis(outcome: Outcome, period: Period, totals: { spend: number; outcome_value: number }[], format: (v: number) => string): Kpi[] {
  const [now, before] = totals;
  const compareLabel = `vs previous ${period.days.length} days`;
  const perSpend = (t: { spend: number; outcome_value: number }) => (outcome === 'leads' ? ratio(t.spend, t.outcome_value) : ratio(t.outcome_value, t.spend));
  const current = perSpend(now);
  const efficiency = current === null ? 'n/a' : outcome === 'leads' ? money(current, period.currency) : `${current.toFixed(1)}x`;
  return [
    { label: 'Ad spend', value: money(now.spend, period.currency, { compact: true }), current: now.spend, previous: before.spend, upIsGood: null, compareLabel },
    { label: WORDS[outcome].total, value: format(now.outcome_value), current: now.outcome_value, previous: before.outcome_value, compareLabel },
    { label: WORDS[outcome].perSpend, value: efficiency, current, previous: perSpend(before), upIsGood: outcome !== 'leads', compareLabel },
  ];
}

function ChannelBars({ rows, selected, href, format }: { rows: ChannelRow[]; selected: string; href: (channel: string) => string; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.influenced_account), 0);
  const width = (value: number) => `${max > 0 ? (value / max) * 100 : 0}%`;
  return (
    <>
      <Legend
        series={[
          { key: 'sourced', label: 'Sourced', color: COLORS[0] },
          { key: 'influenced', label: 'Influenced (overlaps)', color: MUTED },
        ]}
      />
      <ol className="pairs" aria-label="Sourced and influenced value by channel">
        {rows.map((row) => (
          <li key={row.channel}>
            <Link href={href(row.channel)} scroll={false} aria-current={row.channel === selected ? 'true' : undefined}>
              <span className="ranked-label">
                {channelLabel(row.channel)}
                {row.spend === null ? null : <small>{`${format(row.spend)} spend`}</small>}
              </span>
              <span className="pair">
                <span className="ranked-track">
                  <span className="ranked-bar" style={{ width: width(row.sourced), background: COLORS[0] }} />
                  <b>{format(row.sourced)}</b>
                </span>
                <span className="ranked-track">
                  <span className="ranked-bar" style={{ width: width(row.influenced_account), background: MUTED }} />
                  <b>{format(row.influenced_account)}</b>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

function Journey({ outcome, touches }: { outcome: OutcomeRow; touches: TouchRow[] }) {
  const time = (day: string) => new Date(`${day}T00:00:00Z`).getTime();
  const marks = [
    { day: outcome.lead_date, label: 'Lead' },
    ...(outcome.deal_created_date ? [{ day: outcome.deal_created_date, label: 'Deal created' }] : []),
    ...(outcome.closed_date ? [{ day: outcome.closed_date, label: STATUS[outcome.status] }] : []),
  ];
  const all = [...touches.map((t) => time(t.occurred_on)), ...marks.map((m) => time(m.day))];
  const min = Math.min(...all);
  const span = Math.max(...all) - min || 1;
  const left = (day: string) => `${((time(day) - min) / span) * 100}%`;

  const company = touches.filter((t) => t.kind === 'company_engagement');
  const people = touches.filter((t) => t.kind === 'touch');
  const contacts = [...new Map(people.map((t) => [t.contact_name, t])).values()].sort((a, b) => Number(b.is_lead_contact) - Number(a.is_lead_contact));
  const used = [...new Set(touches.map((t) => t.channel))];
  const lines = marks.map((m) => <span key={m.label} className="mark" style={{ left: left(m.day) }} />);

  return (
    <>
      <Legend series={used.map((key) => ({ key, label: channelLabel(key), color: channelColor(key) }))} />
      <div className="journey">
        <div className="journey-inner">
          <div className="lane head">
            <span />
            <div className="lane-track">
              {marks.map((m) => (
                <span key={m.label} className="mark" style={{ left: left(m.day) }}>
                  {`${m.label} · ${shortDay(m.day)}`}
                </span>
              ))}
            </div>
          </div>
          {company.length ? (
            <div className="lane">
              <span className="lane-who">
                Company
                <small>LinkedIn ad engagement</small>
              </span>
              <div className="lane-track">
                {lines}
                {company.map((t) => (
                  <span
                    key={t.occurred_on}
                    className={`week${t.is_counted ? '' : ' uncounted'}`}
                    style={{ left: left(t.occurred_on), background: channelColor(t.channel) }}
                    title={`Week of ${shortDay(t.occurred_on)}: ${count(t.impressions ?? 0)} impressions, ${count(t.clicks ?? 0)} clicks. Influence only, no credit.`}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {contacts.map((contact) => (
            <div key={contact.contact_name} className="lane">
              <span className="lane-who">
                {contact.contact_name}
                <small>{contact.is_lead_contact ? `${contact.contact_role} · lead contact` : contact.contact_role}</small>
              </span>
              <div className="lane-track">
                {lines}
                {people
                  .filter((t) => t.contact_name === contact.contact_name)
                  .map((t, i) => (
                    <span
                      key={i}
                      className={`dot${t.is_counted ? '' : ' uncounted'}`}
                      style={{ left: left(t.occurred_on), background: channelColor(t.channel) }}
                      title={`${shortDay(t.occurred_on)} · ${channelLabel(t.channel)}: ${t.label}${t.is_counted ? '' : ' (not counted)'}`}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function view(outcome: Outcome) {
  return async function Attribution({ period, path, query }: ViewProps) {
    const [channels, totals, outcomes, touches, coverage] = await Promise.all([
      getAttributionChannels(period, outcome),
      getAttributionTotals(period, outcome),
      getAttributionOutcomes(period, outcome),
      getAttributionTouches(period, outcome),
      getAttributionCoverage(period, outcome),
    ]);
    const words = WORDS[outcome];
    if (outcomes.length === 0) return <EmptyState title={`No ${words.many} in these days`}>Try a longer range.</EmptyState>;

    const format = (v: number) => (outcome === 'leads' ? count(v) : money(v, period.currency, { compact: true }));
    const current = totals.find((t) => t.period === 'current') ?? { spend: 0, outcome_value: 0 };
    const previous = totals.find((t) => t.period === 'previous') ?? { spend: 0, outcome_value: 0 };

    const reassigned = (row: ChannelRow) => row.sourced - row.credit_first_touch;
    const fallback = channels.reduce((best, row) => (reassigned(row) > reassigned(best) ? row : best), channels[0]);
    const channel = channels.find((row) => row.channel === query.channel) ?? fallback;
    const model = MODELS.find((m) => m.key === query.model) ?? MODELS[0];

    const list = outcomes
      .filter((o) => o.influenced_channels.includes(channel.channel))
      .sort((a, b) => b.value - a.value || b.outcome_date.localeCompare(a.outcome_date))
      .slice(0, 8);
    const selected = list.find((o) => o.outcome_id === query.deal) ?? list[0];
    const path$ = selected ? touches.filter((t) => t.outcome_id === selected.outcome_id) : [];

    const href = (change: Record<string, string>) => {
      const params = new URLSearchParams({ range: period.range, channel: channel.channel, ...(selected ? { deal: selected.outcome_id } : {}), model: model.key, ...change });
      if ('channel' in change) params.delete('deal');
      return `${path}?${params}`;
    };
    const credit = new Map<string, number>();
    for (const t of path$) credit.set(t.channel, (credit.get(t.channel) ?? 0) + t[model.column]);
    const share = [...credit].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const name = channelLabel(channel.channel);
    const notes = [
      channel.colleague_touches ? `${count(channel.colleague_touches)} colleague touches on ${count(channel.outcomes_with_colleague_touches)} ${words.many}` : '',
      channel.outcomes_with_company_engagement ? `Company ad engagement on ${count(channel.outcomes_with_company_engagement)} ${words.many}` : '',
    ].filter(Boolean);

    return (
      <>
        <KpiRow kpis={kpis(outcome, period, [current, previous], format)} />
        <Grid>
          <Card title="Channel Attribution" subtitle={period.label} footnote="Influenced counts the full value for every channel that touched it, so the bars add up to more than the total.">
            <ChannelBars rows={channels} selected={channel.channel} href={(key) => href({ channel: key })} format={format} />
            <Numbers>
              <DataTable
                rowKey={(row) => row.channel}
                rows={channels}
                columns={[
                  { label: 'Channel', value: (row) => channelLabel(row.channel) },
                  { label: 'Spend', numeric: true, value: (row) => (row.spend === null ? '' : money(row.spend, period.currency, { compact: true })) },
                  { label: 'Sourced', numeric: true, value: (row) => format(row.sourced) },
                  { label: 'Influenced', numeric: true, value: (row) => format(row.influenced_account) },
                  { label: 'First touch', numeric: true, value: (row) => format(row.credit_first_touch) },
                  { label: 'Last touch', numeric: true, value: (row) => format(row.credit_last_touch) },
                  { label: 'Last non-direct', numeric: true, value: (row) => format(row.credit_last_non_direct) },
                  { label: 'Linear', numeric: true, value: (row) => format(row.credit_linear) },
                ]}
              />
            </Numbers>
          </Card>

          <Card title={`Model Comparison: ${name}`} subtitle={words.total} wide={false}>
            <RankedBars
              label={`${name} by attribution model`}
              format={format}
              rows={[
                { key: 'sourced', label: 'Sourced', value: channel.sourced },
                { key: 'first', label: 'First touch', value: channel.credit_first_touch },
                { key: 'last', label: 'Last touch', value: channel.credit_last_touch },
                { key: 'lnd', label: 'Last non-direct', value: channel.credit_last_non_direct },
                { key: 'linear', label: 'Linear', value: channel.credit_linear },
              ]}
            />
          </Card>
          <Card title={`Influenced: ${name}`} subtitle="Contact vs account" wide={false} footnote={notes.join(' · ') || 'No colleague touches.'}>
            <RankedBars
              label={`${name} influenced value, lead contact only and whole account`}
              format={format}
              rows={[
                { key: 'contact', label: 'Lead contact only', value: channel.influenced_contact, color: MUTED },
                { key: 'account', label: 'Whole account', value: channel.influenced_account },
              ]}
            />
          </Card>

          <Card title={outcome === 'leads' ? `Lead Journeys: ${name}` : `Deal Journeys: ${name}`} subtitle={`The largest ${words.many} this channel touched`}>
            {list.length === 0 ? (
              <p className="footnote">{`${name} touched no ${words.many} in these days.`}</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>{words.date}</th>
                      <th>Status</th>
                      <th>Declared source</th>
                      {outcome === 'leads' ? null : <th className="num">Value</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((o) => (
                      <tr key={o.outcome_id} aria-current={o === selected ? 'true' : undefined}>
                        <td>
                          <Link className="row-link" href={href({ deal: o.outcome_id })} scroll={false}>
                            {o.account_name}
                          </Link>
                        </td>
                        <td className="nowrap">{shortDay(o.outcome_date)}</td>
                        <td>{STATUS[o.status]}</td>
                        <td>{o.declared_source ?? ''}</td>
                        {outcome === 'leads' ? null : <td className="num">{format(o.value)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selected ? (
            <Card
              title={`Journey: ${selected.account_name}`}
              subtitle={outcome === 'leads' ? `Lead on ${shortDay(selected.outcome_date)}` : `${format(selected.value)} · ${STATUS[selected.status]}`}
              footnote="Faded marks are not counted: they came after the date above, or from a contact not matched to the account. Company engagement counts as influence and never gets credit."
            >
              <div className="card-tools">
                <span>Credit</span>
                <nav className="segmented" aria-label="Credit model">
                  {MODELS.map((m) => (
                    <Link key={m.key} href={href({ model: m.key })} scroll={false} aria-current={m === model ? 'page' : undefined}>
                      {m.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <Journey outcome={selected} touches={path$} />
              <p className="credit-line">
                {share.map(([key, value], i) => (
                  <span key={key}>
                    {i ? ' · ' : ''}
                    <Swatch color={channelColor(key)} />
                    {`${channelLabel(key)} ${outcome === 'leads' ? percent(value) : format(value)}`}
                  </span>
                ))}
              </p>
              <Numbers>
                <DataTable
                  rowKey={(t) => `${t.kind}-${t.occurred_on}-${t.contact_name}-${t.label}`}
                  rows={path$.toSorted((a, b) => a.occurred_on.localeCompare(b.occurred_on))}
                  columns={[
                    { label: 'Day', value: (t) => shortDay(t.occurred_on) },
                    { label: 'Who', value: (t) => t.contact_name ?? 'Company' },
                    { label: 'Channel', value: (t) => channelLabel(t.channel) },
                    { label: 'Touch', value: (t) => (t.kind === 'touch' ? t.label : `${count(t.impressions ?? 0)} impressions, ${count(t.clicks ?? 0)} clicks`) },
                    { label: 'Counted', value: (t) => (t.is_counted ? 'Yes' : 'No') },
                    { label: `Credit, ${model.label.toLowerCase()}`, numeric: true, value: (t) => (t[model.column] ? (outcome === 'leads' ? percent(t[model.column]) : format(t[model.column])) : '') },
                  ]}
                />
              </Numbers>
            </Card>
          ) : null}
        </Grid>
        <p className="footnote">
          {`Tracked ${percent(ratio(coverage.outcomes_with_tracked_touch, coverage.outcomes))} · Matched to account ${percent(ratio(coverage.contacts_matched, coverage.contacts))} · Unattributed ${format(coverage.unattributed_value)} · LinkedIn companies matched ${percent(ratio(coverage.linkedin_companies_matched, coverage.linkedin_companies))}. Sample data for a fictional company.`}
        </p>
      </>
    );
  };
}

export const attribution: Dashboard = {
  slug: 'attribution',
  title: 'Attribution',
  description: 'Which channels sourced and influenced your pipeline.',
  icon: 'path',
  tabs: [
    { slug: 'pipeline', title: 'Pipeline', View: view('pipeline') },
    { slug: 'leads', title: 'Leads', View: view('leads') },
    { slug: 'won', title: 'Won', View: view('won') },
  ],
};
