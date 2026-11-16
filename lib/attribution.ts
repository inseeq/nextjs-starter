import { cache } from 'react';

import { mockAttribution } from './attribution-mock.ts';
import type { Period } from './data.ts';

/** What the attribution page reads. Each function answers with sample rows until its table exists: swap its body for a `runQuery` that returns the same columns. */

export type Outcome = 'pipeline' | 'leads' | 'won';

/** One row per channel, for outcomes dated in the period. Amounts are in the outcome's unit: currency, or a count for leads. */
export interface ChannelRow {
  channel: string;
  /** Null for a channel without ad spend. */
  spend: number | null;
  /** Value of outcomes whose lead-creating touch was on this channel. */
  sourced: number;
  /** Value of outcomes the channel touched, counting only the lead contact. Overlaps across channels. */
  influenced_contact: number;
  /** The same, counting every matched contact at the account and company-level ad engagement. */
  influenced_account: number;
  credit_first_touch: number;
  credit_last_touch: number;
  credit_last_non_direct: number;
  credit_linear: number;
  colleague_touches: number;
  outcomes_with_colleague_touches: number;
  outcomes_with_company_engagement: number;
}

/** Two rows: the period and the same number of days before it. */
export interface TotalsRow {
  period: 'current' | 'previous';
  spend: number;
  outcome_value: number;
  outcome_count: number;
}

/** One row per outcome dated in the period: a lead, a deal created or a deal won. */
export interface OutcomeRow {
  outcome_id: string;
  account_name: string;
  outcome_date: string;
  value: number;
  status: 'lead' | 'open' | 'won' | 'lost';
  lead_date: string;
  deal_created_date: string | null;
  closed_date: string | null;
  declared_source: string | null;
  /** Channels that touched the outcome at account level. */
  influenced_channels: string[];
  has_company_engagement: boolean;
}

/** One row per touch of an outcome in the period, plus one per week of company-level ad engagement. */
export interface TouchRow {
  outcome_id: string;
  kind: 'touch' | 'company_engagement';
  occurred_on: string;
  channel: string;
  label: string;
  /** Null on company engagement, which has no person. */
  contact_name: string | null;
  contact_role: string | null;
  is_lead_contact: boolean;
  /** False for a touch after the outcome date or by an unmatched contact. */
  is_counted: boolean;
  impressions: number | null;
  clicks: number | null;
  credit_first_touch: number;
  credit_last_touch: number;
  credit_last_non_direct: number;
  credit_linear: number;
}

/** One row for the period. */
export interface CoverageRow {
  outcomes: number;
  /** Outcomes with at least one touch that is not a direct visit. */
  outcomes_with_tracked_touch: number;
  contacts: number;
  contacts_matched: number;
  /** Value of outcomes with direct visits only. */
  unattributed_value: number;
  linkedin_companies: number;
  linkedin_companies_matched: number;
}

const sample = cache((end: string, length: number, outcome: Outcome) => mockAttribution({ end, days: Array.from({ length }, () => '') }, outcome));
const of = (period: Period, outcome: Outcome) => sample(period.end, period.days.length, outcome);

export async function getAttributionChannels(period: Period, outcome: Outcome): Promise<ChannelRow[]> {
  return of(period, outcome).channels;
}

export async function getAttributionTotals(period: Period, outcome: Outcome): Promise<TotalsRow[]> {
  return of(period, outcome).totals;
}

export async function getAttributionOutcomes(period: Period, outcome: Outcome): Promise<OutcomeRow[]> {
  return of(period, outcome).outcomes;
}

export async function getAttributionTouches(period: Period, outcome: Outcome): Promise<TouchRow[]> {
  return of(period, outcome).touches;
}

export async function getAttributionCoverage(period: Period, outcome: Outcome): Promise<CoverageRow> {
  return of(period, outcome).coverage;
}
