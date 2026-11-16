import { cache } from 'react';

import { dateParams, runQuery, type Period } from './data.ts';
import { humanize, num } from './format.ts';
import type { QueryOptions, QueryParam } from './inseeq.ts';

/** What the attribution page reads: attr_touch_credit and attr_conversion_touches, with ad spend and deal names from silver. */

export type Outcome = 'pipeline' | 'leads' | 'won';
/** count: conversions, the sum of credit shares. value: their amount in the client currency. */
export type Measure = 'count' | 'value';
export type Scope = 'contact' | 'account';

export const POLICIES = ['declared', 'sourced', 'first_touch', 'last_touch', 'last_non_direct', 'linear', 'any_touch'] as const;
export type Policy = (typeof POLICIES)[number];
export type Credit = Record<Policy, number>;

const CONVERSION_TYPE: Record<Outcome, string> = { leads: 'lead', pipeline: 'opportunity', won: 'won' };

/** For a channel the warehouse has no name for yet. */
const FALLBACK: Record<string, string> = { no_touch: 'No tracked touch', unknown: 'Unknown' };
export const channelLabel = (key: string, name?: string | null) => name || FALLBACK[key] || humanize(key);
/** Channels that stand for missing evidence rather than a source. */
export const isGap = (key: string) => key === 'no_touch' || key === 'unknown';

export interface ChannelRow {
  channel: string;
  name: string | null;
  /** Null for a channel without ad spend. */
  spend: number | null;
  /** any_touch overlaps across channels; every other policy adds up to the outcome total within one scope. */
  credit: Record<Scope, Record<Measure, Credit>>;
  /** Touches by colleagues reached through the company, at account scope. */
  colleague_touches: number;
  outcomes_with_colleague_touches: number;
}

export interface Totals {
  spend: number;
  outcomes: number;
  /** Outcomes with a tracked touch at account scope. */
  tracked: number;
  /** Deals with an amount in the client currency, and the sum of those amounts. */
  with_amount: number;
  value: number;
  /** Deals with an amount in another currency, left out of value. */
  other_currency: number;
}

/** One outcome dated in the period: a lead, a deal created or a deal won. */
export interface OutcomeRow {
  outcome_id: string;
  /** The deal name, else the company name. */
  name: string | null;
  outcome_date: string;
  /** Null for a lead, a deal without an amount and an outlier amount. */
  amount: number | null;
  currency: string | null;
  status: 'lead' | 'open' | 'won' | 'lost';
  deal_created_date: string | null;
  closed_date: string | null;
  declared_channel: string;
  declared_name: string | null;
  sourced_channel: string;
  sourced_name: string | null;
  is_tracked: boolean;
}

/** One touch of an outcome's account journey: one person, day and channel. */
export interface TouchRow {
  touch_seq: number;
  day: string;
  channel: string;
  name: string | null;
  touch_type: string;
  evidence_count: number;
  /** The lead's person or a deal contact; false for a colleague at the same company. */
  is_direct_member: boolean;
  /** 1, 2, ... within direct members and within colleagues. */
  person: number;
  campaign: string | null;
  first_touch: number;
  last_touch: number;
  last_non_direct: number;
  linear: number;
}

const bool = (value: unknown) => value === true || value === 'true';
const text = (value: unknown) => (value === null || value === undefined ? null : String(value));

function params(start: string, end: string, outcome: Outcome, extra: QueryParam[] = []): QueryOptions {
  return { params: [...(dateParams(start, end).params ?? []), { name: 'conversion_type', type: 'STRING', value: CONVERSION_TYPE[outcome] }, ...extra] };
}

async function getSpend(period: Period) {
  const { rows } = await runQuery('paid_media_daily', dateParams(period.previousStart, period.end));
  const sum = (from: string, to: string) => rows.filter((r) => String(r.day) >= from && String(r.day) <= to).reduce((total, r) => total + num(r.spend), 0);
  return { current: sum(period.start, period.end), previous: sum(period.previousStart, period.previousEnd) };
}

const emptyCredit = (): Credit => Object.fromEntries(POLICIES.map((p) => [p, 0])) as Credit;

export const getAttributionChannels = cache(async (period: Period, outcome: Outcome): Promise<ChannelRow[]> => {
  const [credit, colleagues] = await Promise.all([
    runQuery('attribution_channels', params(period.start, period.end, outcome)),
    runQuery('attribution_colleagues', params(period.start, period.end, outcome)),
  ]);
  const rows = new Map<string, ChannelRow>();
  const row = (channel: string, source?: Record<string, unknown>) => {
    let found = rows.get(channel);
    if (!found) {
      found = {
        channel,
        name: text(source?.name),
        spend: source?.spend === null || source?.spend === undefined ? null : num(source.spend),
        credit: { contact: { count: emptyCredit(), value: emptyCredit() }, account: { count: emptyCredit(), value: emptyCredit() } },
        colleague_touches: 0,
        outcomes_with_colleague_touches: 0,
      };
      rows.set(channel, found);
    }
    return found;
  };
  for (const r of credit.rows) {
    const channel = row(String(r.channel), r);
    const policy = String(r.policy) as Policy;
    const scope = String(r.scope) as Scope;
    if (!POLICIES.includes(policy) || (scope !== 'contact' && scope !== 'account')) continue;
    const target = channel.credit[scope];
    target.count[policy] = num(r.credit);
    target.value[policy] = num(r.value);
  }
  for (const r of colleagues.rows) {
    const target = rows.get(String(r.channel));
    if (!target) continue;
    target.colleague_touches = num(r.touches);
    target.outcomes_with_colleague_touches = num(r.outcomes);
  }
  return [...rows.values()];
});

export const getAttributionTotals = cache(async (period: Period, outcome: Outcome): Promise<{ current: Totals; previous: Totals }> => {
  const [{ rows }, spend] = await Promise.all([runQuery('attribution_daily', params(period.previousStart, period.end, outcome)), getSpend(period)]);
  const sum = (from: string, to: string, spendTotal: number): Totals => {
    const days = rows.filter((r) => String(r.day) >= from && String(r.day) <= to);
    const add = (column: string) => days.reduce((total, r) => total + num(r[column]), 0);
    return { spend: spendTotal, outcomes: add('outcomes'), tracked: add('tracked'), with_amount: add('with_amount'), value: add('value'), other_currency: add('other_currency') };
  };
  return { current: sum(period.start, period.end, spend.current), previous: sum(period.previousStart, period.previousEnd, spend.previous) };
});

/** Outcomes in the period that the channel touched at account level, newest first. */
export const getAttributionOutcomes = cache(async (period: Period, outcome: Outcome, channel: string): Promise<OutcomeRow[]> => {
  const { rows } = await runQuery('attribution_outcomes', params(period.start, period.end, outcome, [{ name: 'channel', type: 'STRING', value: channel }]));
  return rows.map((r) => ({
    outcome_id: String(r.outcome_id),
    name: text(r.name),
    outcome_date: String(r.outcome_date),
    amount: r.amount === null || r.amount === undefined ? null : num(r.amount),
    currency: text(r.currency),
    status: String(r.status) as OutcomeRow['status'],
    deal_created_date: text(r.deal_created_date),
    closed_date: text(r.closed_date),
    declared_channel: String(r.declared_channel ?? 'unknown'),
    declared_name: text(r.declared_name),
    sourced_channel: String(r.sourced_channel ?? 'no_touch'),
    sourced_name: text(r.sourced_name),
    is_tracked: bool(r.is_tracked),
  }));
});

export const getAttributionTouches = cache(async (outcomeId: string): Promise<TouchRow[]> => {
  const { rows } = await runQuery('attribution_journey', { params: [{ name: 'outcome_id', type: 'STRING', value: outcomeId }] });
  return rows.map((r) => ({
    touch_seq: num(r.touch_seq),
    day: String(r.day),
    channel: String(r.channel),
    name: text(r.name),
    touch_type: String(r.touch_type),
    evidence_count: num(r.evidence_count),
    is_direct_member: bool(r.is_direct_member),
    person: num(r.person),
    campaign: text(r.campaign),
    first_touch: num(r.first_touch),
    last_touch: num(r.last_touch),
    last_non_direct: num(r.last_non_direct),
    linear: num(r.linear),
  }));
});
