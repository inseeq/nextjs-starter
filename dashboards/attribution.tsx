import Link from 'next/link';

import { COLORS, Legend, MUTED, RankedBars } from '../components/charts.tsx';
import { Card, DataTable, EmptyState, Grid, KpiRow, Numbers, Swatch, type Kpi } from '../components/ui.tsx';
import {
  channelLabel,
  getAttributionChannels,
  getAttributionOutcomes,
  getAttributionTotals,
  getAttributionTouches,
  isGap,
  type ChannelRow,
  type Credit,
  type Measure,
  type Outcome,
  type OutcomeRow,
  type Totals,
  type TouchRow,
} from '../lib/attribution.ts';
import type { Period } from '../lib/data.ts';
import { count, money, percent, ratio, shortDay } from '../lib/format.ts';
import type { Dashboard, ViewProps } from './types.ts';

const COLOR: Record<string, string> = {
  paid_search_google: COLORS[0],
  paid_social_meta: COLORS[1],
  paid_social_linkedin: COLORS[2],
  organic_search: COLORS[3],
  ai_assistant: COLORS[4],
  outbound_email_phone: COLORS[5],
  direct: COLORS[6],
};
const channelColor = (key: string) => COLOR[key] ?? MUTED;

const MODELS = [
  { key: 'linear', label: 'Linear' },
  { key: 'first_touch', label: 'First touch' },
  { key: 'last_touch', label: 'Last touch' },
  { key: 'last_non_direct', label: 'Last non-direct' },
] as const;

const WORDS: Record<Outcome, { count: string; value: string; one: string; many: string; date: string; costPer: string; perSpend: string; contacts: string }> = {
  pipeline: { count: 'Deals created', value: 'Pipeline created', one: 'deal', many: 'deals', date: 'Created', costPer: 'Cost per deal', perSpend: 'Pipeline to ad spend', contacts: 'Deal contacts' },
  leads: { count: 'Leads', value: '', one: 'lead', many: 'leads', date: 'Lead', costPer: 'Cost per lead', perSpend: '', contacts: 'Lead contact' },
  won: { count: 'Deals won', value: 'Revenue won', one: 'won deal', many: 'won deals', date: 'Won', costPer: 'Cost per won deal', perSpend: 'Revenue to ad spend', contacts: 'Deal contacts' },
};
const STATUS: Record<OutcomeRow['status'], string> = { lead: 'Lead', open: 'Open', won: 'Won', lost: 'Lost' };
const TOUCH: Record<string, [string, string]> = {
  page_view: ['Page view', 'page views'],
  form_submit: ['Form submission', 'form submissions'],
  ad_interaction: ['Ad interaction', 'ad interactions'],
  outbound_reply: ['Reply to outreach', 'replies to outreach'],
  outbound_positive_reply: ['Positive reply to outreach', 'positive replies to outreach'],
};

/** Credit shares are fractional under linear. */
const shares = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.abs(value) < 100 && !Number.isInteger(value) ? 1 : 0 }).format(value);

function touchText(t: TouchRow): string {
  const [one, many] = TOUCH[t.touch_type] ?? ['Touch', 'touches'];
  const what = t.evidence_count > 1 ? `${count(t.evidence_count)} ${many}` : one;
  return t.campaign ? `${what} · ${t.campaign}` : what;
}

/** Lane names for an outcome's people: never their names, only their part in it. */
function whoIs(outcome: Outcome, touches: TouchRow[]) {
  const direct = new Set(touches.filter((t) => t.is_direct_member).map((t) => t.person)).size;
  return (t: TouchRow) => (t.is_direct_member ? (outcome === 'leads' ? 'Lead contact' : direct > 1 ? `Deal contact ${t.person}` : 'Deal contact') : `Colleague ${t.person}`);
}

function kpis(outcome: Outcome, measure: Measure, period: Period, now: Totals, before: Totals): Kpi[] {
  const compareLabel = `vs previous ${period.days.length} days`;
  const efficiency = (t: Totals) => (measure === 'value' ? ratio(t.value, t.spend) : ratio(t.spend, t.outcomes));
  const current = efficiency(now);
  const words = WORDS[outcome];
  return [
    { label: 'Ad spend', value: money(now.spend, period.currency, { compact: true }), current: now.spend, previous: before.spend, upIsGood: null, compareLabel },
    measure === 'value'
      ? { label: words.value, value: money(now.value, period.currency, { compact: true }), current: now.value, previous: before.value, compareLabel }
      : { label: words.count, value: count(now.outcomes), current: now.outcomes, previous: before.outcomes, compareLabel },
    measure === 'value'
      ? { label: words.perSpend, value: current === null ? 'n/a' : `${current.toFixed(1)}x`, current, previous: efficiency(before), compareLabel }
      : { label: words.costPer, value: current === null ? 'n/a' : money(current, period.currency), current, previous: efficiency(before), upIsGood: false, compareLabel },
    { label: 'Tracked', value: percent(ratio(now.tracked, now.outcomes)), current: ratio(now.tracked, now.outcomes), previous: ratio(before.tracked, before.outcomes), compareLabel },
  ];
}

function ChannelBars({ rows, measure, selected, href, format, currency }: { rows: ChannelRow[]; measure: Measure; selected: string; href: (channel: string) => string; format: (v: number) => string; currency: string }) {
  const credit = (row: ChannelRow) => row.credit.account[measure];
  const max = Math.max(...rows.flatMap((r) => [credit(r).sourced, credit(r).any_touch]), 0);
  const width = (value: number) => `${max > 0 ? (value / max) * 100 : 0}%`;
  return (
    <>
      <Legend
        series={[
          { key: 'sourced', label: 'Sourced', color: COLORS[0] },
          { key: 'influenced', label: 'Influenced', color: MUTED },
        ]}
      />
      <ol className="pairs" aria-label="Sourced and influenced by channel">
        {rows.map((row) => (
          <li key={row.channel}>
            <Link href={href(row.channel)} scroll={false} aria-current={row.channel === selected ? 'true' : undefined}>
              <span className="ranked-label">
                {channelLabel(row.channel, row.name)}
                {row.spend === null ? null : <small>{`${money(row.spend, currency, { compact: true })} spend`}</small>}
              </span>
              <span className="pair">
                <span className="ranked-track">
                  <span className="ranked-bar" style={{ width: width(credit(row).sourced), background: COLORS[0] }} />
                  <b>{format(credit(row).sourced)}</b>
                </span>
                <span className="ranked-track">
                  <span className="ranked-bar" style={{ width: width(credit(row).any_touch), background: MUTED }} />
                  <b>{format(credit(row).any_touch)}</b>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

function Journey({ outcome, row, touches }: { outcome: Outcome; row: OutcomeRow; touches: TouchRow[] }) {
  const time = (day: string) => new Date(`${day}T00:00:00Z`).getTime();
  const created = outcome === 'leads' ? null : (row.deal_created_date ?? (outcome === 'pipeline' ? row.outcome_date : null));
  const events = [
    ...(outcome === 'leads' ? [{ day: row.outcome_date, label: 'Lead' }] : []),
    ...(created ? [{ day: created, label: 'Deal created' }] : []),
    ...(outcome === 'won' ? [{ day: row.outcome_date, label: 'Won' }] : []),
    ...(outcome === 'pipeline' && row.closed_date ? [{ day: row.closed_date, label: STATUS[row.status] }] : []),
  ];
  // Events on one day share a mark, so their labels never overlap.
  const marks = [...Map.groupBy(events, (e) => e.day)].map(([day, list]) => ({ day, label: list.map((e) => e.label).join(', ') }));
  const all = [...touches.map((t) => time(t.day)), ...marks.map((m) => time(m.day))];
  const min = Math.min(...all);
  const span = Math.max(...all) - min || 1;
  const left = (day: string) => `${((time(day) - min) / span) * 100}%`;

  const lanes = [...new Map(touches.map((t) => [`${t.is_direct_member ? 0 : 1}-${t.person}`, t])).entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  const who = whoIs(outcome, touches);
  const used = [...new Map(touches.map((t) => [t.channel, t.name])).entries()];
  const lines = marks.map((m) => <span key={m.label} className="mark" style={{ left: left(m.day) }} />);

  return (
    <>
      <Legend series={used.map(([key, name]) => ({ key, label: channelLabel(key, name), color: channelColor(key) }))} />
      <div className="journey">
        <div className="journey-inner">
          <div className="lane head">
            <span />
            <div className="lane-track">
              {marks.map((m) => (
                <span key={m.label} className={`mark${time(m.day) - min > span * 0.8 ? ' end' : ''}`} style={{ left: left(m.day) }}>
                  {`${m.label} · ${shortDay(m.day)}`}
                </span>
              ))}
            </div>
          </div>
          {lanes.map(([key, person]) => (
            <div key={key} className="lane">
              <span className="lane-who">{who(person)}</span>
              <div className="lane-track">
                {lines}
                {touches
                  .filter((t) => t.is_direct_member === person.is_direct_member && t.person === person.person)
                  .map((t) => (
                    <span
                      key={t.touch_seq}
                      className="dot"
                      style={{ left: left(t.day), background: channelColor(t.channel) }}
                      title={`${shortDay(t.day)} · ${channelLabel(t.channel, t.name)}: ${touchText(t)}`}
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

const ZERO: Totals = { spend: 0, outcomes: 0, tracked: 0, with_amount: 0, value: 0, other_currency: 0 };
/** Missing evidence goes last, so the real channels lead and the rows still add up to the total. */
const order = (a: ChannelRow, b: ChannelRow) => Number(isGap(a.channel)) - Number(isGap(b.channel)) || b.credit.account.count.any_touch - a.credit.account.count.any_touch || (b.spend ?? 0) - (a.spend ?? 0);

function view(outcome: Outcome) {
  return async function Attribution({ period, path, query }: ViewProps) {
    const [channelRows, totals] = await Promise.all([getAttributionChannels(period, outcome), getAttributionTotals(period, outcome)]);
    const words = WORDS[outcome];
    const { current = ZERO, previous = ZERO } = totals;
    if (current.outcomes === 0) return <EmptyState title={`No ${words.many} in these days`}>Try a longer range.</EmptyState>;

    const hasValue = outcome !== 'leads' && current.with_amount > 0;
    const measure: Measure = hasValue && query.measure === 'value' ? 'value' : 'count';
    const format = (v: number) => (measure === 'value' ? money(v, period.currency, { compact: true }) : shares(v));
    const channels = channelRows.toSorted(order);
    const real = channels.filter((row) => !isGap(row.channel) && row.channel !== 'direct');
    const channel = channels.find((row) => row.channel === query.channel) ?? real[0] ?? channels[0];
    const model = MODELS.find((m) => m.key === query.model) ?? MODELS[0];
    const name = channelLabel(channel.channel, channel.name);

    const touched = await getAttributionOutcomes(period, outcome, channel.channel);
    const list = (measure === 'value' ? touched.toSorted((a, b) => (b.amount ?? -1) - (a.amount ?? -1) || b.outcome_date.localeCompare(a.outcome_date)) : touched).slice(0, 8);
    const selected = list.find((o) => o.outcome_id === query.deal) ?? list[0];
    const touches = selected?.is_tracked ? await getAttributionTouches(selected.outcome_id) : [];
    const label = (o: OutcomeRow) => o.name ?? (outcome === 'leads' ? 'No company' : 'Unnamed deal');

    const href = (change: Record<string, string>) => {
      const params = new URLSearchParams({ range: period.range, channel: channel.channel, ...(selected ? { deal: selected.outcome_id } : {}), model: model.key, measure, ...change });
      if ('channel' in change || 'measure' in change) params.delete('deal');
      return `${path}?${params}`;
    };
    const credit = new Map<string, number>();
    for (const t of touches) credit.set(t.channel, (credit.get(t.channel) ?? 0) + t[model.key]);
    const touchName = new Map(touches.map((t) => [t.channel, t.name]));
    const share = [...credit].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const account = channel.credit.account[measure];
    const contact = channel.credit.contact[measure];
    const colleagues = channel.colleague_touches ? `${count(channel.colleague_touches)} colleague touches on ${count(channel.outcomes_with_colleague_touches)} ${words.many}.` : 'No colleague touches.';
    const sum = (key: keyof Credit) => channels.reduce((total, row) => total + row.credit.account[measure][key], 0);
    const spendTotal = channels.reduce((total, row) => total + (row.spend ?? 0), 0);
    const total: ChannelRow = { ...channel, channel: 'total', spend: spendTotal };
    const notes = [
      `Tracked ${percent(ratio(current.tracked, current.outcomes))}`,
      outcome === 'leads' ? '' : `${count(current.with_amount)} of ${count(current.outcomes)} ${words.many} have an amount`,
      current.other_currency ? `${count(current.other_currency)} in other currencies left out` : '',
    ].filter(Boolean);

    return (
      <>
        <KpiRow kpis={kpis(outcome, measure, period, current, previous)} />
        <Grid>
          <Card title="Channel Attribution" subtitle={period.label} footnote={`Influenced counts a ${words.one} once for every channel that touched it, so it adds up to more than the total.${measure === 'value' ? ` Value counts the ${count(current.with_amount)} of ${count(current.outcomes)} ${words.many} with an amount.` : ''}`}>
            {hasValue ? (
              <div className="card-tools">
                <nav className="segmented" aria-label="Measure">
                  <Link href={href({ measure: 'count' })} scroll={false} aria-current={measure === 'count' ? 'page' : undefined}>
                    {words.count}
                  </Link>
                  <Link href={href({ measure: 'value' })} scroll={false} aria-current={measure === 'value' ? 'page' : undefined}>
                    {words.value}
                  </Link>
                </nav>
              </div>
            ) : null}
            <ChannelBars rows={channels} measure={measure} selected={channel.channel} href={(key) => href({ channel: key })} format={format} currency={period.currency} />
            <Numbers>
              <DataTable
                rowKey={(row) => row.channel}
                rows={channels}
                total={total}
                columns={[
                  { label: 'Channel', value: (row) => (row === total ? 'Total' : channelLabel(row.channel, row.name)) },
                  { label: 'Spend', numeric: true, value: (row) => (row.spend === null ? '' : money(row.spend, period.currency, { compact: true })) },
                  { label: 'Declared', numeric: true, value: (row) => format(row === total ? sum('declared') : row.credit.account[measure].declared) },
                  { label: 'Sourced', numeric: true, value: (row) => format(row === total ? sum('sourced') : row.credit.account[measure].sourced) },
                  { label: 'First touch', numeric: true, value: (row) => format(row === total ? sum('first_touch') : row.credit.account[measure].first_touch) },
                  { label: 'Last touch', numeric: true, value: (row) => format(row === total ? sum('last_touch') : row.credit.account[measure].last_touch) },
                  { label: 'Last non-direct', numeric: true, value: (row) => format(row === total ? sum('last_non_direct') : row.credit.account[measure].last_non_direct) },
                  { label: 'Linear', numeric: true, value: (row) => format(row === total ? sum('linear') : row.credit.account[measure].linear) },
                  { label: 'Influenced', numeric: true, value: (row) => (row === total ? '' : format(row.credit.account[measure].any_touch)) },
                ]}
              />
            </Numbers>
          </Card>

          <Card title={`Model Comparison: ${name}`} subtitle={measure === 'value' ? words.value : words.count} wide={false}>
            <RankedBars
              label={`${name} by attribution model`}
              format={format}
              rows={[
                { key: 'declared', label: 'Declared', value: account.declared },
                { key: 'sourced', label: 'Sourced', value: account.sourced },
                { key: 'first', label: 'First touch', value: account.first_touch },
                { key: 'last', label: 'Last touch', value: account.last_touch },
                { key: 'lnd', label: 'Last non-direct', value: account.last_non_direct },
                { key: 'linear', label: 'Linear', value: account.linear },
              ]}
            />
          </Card>
          <Card title={`Contact vs Account: ${name}`} subtitle={`${words.contacts} or whole account`} wide={false} footnote={colleagues}>
            <RankedBars
              label={`${name}, ${words.contacts.toLowerCase()} only and whole account`}
              format={format}
              rows={[
                { key: 'inf-contact', label: `Influenced, ${words.contacts.toLowerCase()}`, value: contact.any_touch, color: MUTED },
                { key: 'inf-account', label: 'Influenced, account', value: account.any_touch },
                { key: 'lnd-contact', label: `Last non-direct, ${words.contacts.toLowerCase()}`, value: contact.last_non_direct, color: MUTED },
                { key: 'lnd-account', label: 'Last non-direct, account', value: account.last_non_direct },
              ]}
            />
          </Card>

          <Card title={outcome === 'leads' ? `Lead Journeys: ${name}` : `Deal Journeys: ${name}`} subtitle={measure === 'value' ? `The largest ${words.many} this channel touched` : `The latest ${words.many} this channel touched`}>
            {list.length === 0 ? (
              <p className="footnote">{`${name} touched no ${words.many} in these days.`}</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{outcome === 'leads' ? 'Company' : 'Deal'}</th>
                      <th>{words.date}</th>
                      {outcome === 'leads' ? null : <th>Status</th>}
                      <th>Declared</th>
                      <th>Sourced</th>
                      {outcome === 'leads' ? null : <th className="num">Amount</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((o) => (
                      <tr key={o.outcome_id} aria-current={o === selected ? 'true' : undefined}>
                        <td>
                          <Link className="row-link" href={href({ deal: o.outcome_id })} scroll={false}>
                            {label(o)}
                          </Link>
                        </td>
                        <td className="nowrap">{shortDay(o.outcome_date)}</td>
                        {outcome === 'leads' ? null : <td>{STATUS[o.status]}</td>}
                        <td>{channelLabel(o.declared_channel, o.declared_name)}</td>
                        <td>{channelLabel(o.sourced_channel, o.sourced_name)}</td>
                        {outcome === 'leads' ? null : <td className="num">{o.amount === null ? '' : money(o.amount, o.currency ?? period.currency, { compact: true })}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selected ? (
            <Card
              title={`Journey: ${label(selected)}`}
              subtitle={outcome === 'leads' ? `Lead on ${shortDay(selected.outcome_date)}` : [selected.amount === null ? '' : money(selected.amount, selected.currency ?? period.currency, { compact: true }), STATUS[selected.status]].filter(Boolean).join(' · ')}
              footnote="One mark per person, channel and day, up to the outcome."
            >
              {touches.length === 0 ? (
                <p className="footnote">{`No tracked touch before this ${words.one}.`}</p>
              ) : (
                <>
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
                  <Journey outcome={outcome} row={selected} touches={touches} />
                  <p className="credit-line">
                    {share.map(([key, value], i) => (
                      <span key={key}>
                        {i ? ' · ' : ''}
                        <Swatch color={channelColor(key)} />
                        {`${channelLabel(key, touchName.get(key))} ${percent(value)}`}
                      </span>
                    ))}
                  </p>
                  <Numbers>
                    <DataTable
                      rowKey={(t) => String(t.touch_seq)}
                      rows={touches}
                      columns={[
                        { label: 'Day', value: (t) => shortDay(t.day) },
                        { label: 'Who', value: whoIs(outcome, touches) },
                        { label: 'Channel', value: (t) => channelLabel(t.channel, t.name) },
                        { label: 'Touch', value: (t) => touchText(t) },
                        { label: `Credit, ${model.label.toLowerCase()}`, numeric: true, value: (t) => (t[model.key] ? percent(t[model.key]) : '') },
                      ]}
                    />
                  </Numbers>
                </>
              )}
            </Card>
          ) : null}
        </Grid>
        <p className="footnote">{`${notes.join(' · ')}. Touches count up to 365 days before the ${words.one}. Sales calls and emails are not touches.`}</p>
      </>
    );
  };
}

export const attribution: Dashboard = {
  slug: 'attribution',
  title: 'Attribution',
  description: 'Which channels sourced and influenced your leads and deals.',
  icon: 'path',
  tabs: [
    { slug: 'pipeline', title: 'Pipeline', View: view('pipeline') },
    { slug: 'leads', title: 'Leads', View: view('leads') },
    { slug: 'won', title: 'Won', View: view('won') },
  ],
};
