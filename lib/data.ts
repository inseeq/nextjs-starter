import { cache } from 'react';

import { addDays, dayRange, daysBetween } from './format.ts';
import { clientFromEnv, InseeqError, type QueryOptions, type QueryResult, type Status } from './inseeq.ts';

export const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const;
export type RangeKey = keyof typeof RANGES;
export const DEFAULT_RANGE: RangeKey = '30d';

export interface Period {
  range: RangeKey;
  /** The last full day in the client's zone, and the first day of the range. */
  start: string;
  end: string;
  /** The same number of days just before. */
  previousStart: string;
  previousEnd: string;
  days: string[];
  label: string;
  timezone: string;
  currency: string;
}

const client = cache(clientFromEnv);

export const getStatus = cache((): Promise<Status> => client().status());

/** Runs a file in queries/ and refuses a cut-off answer, so no total is ever silently short. */
export async function runQuery(name: string, options?: QueryOptions): Promise<QueryResult> {
  const result = await client().runSaved(name, options);
  if (result.truncated) throw new InseeqError('truncated', `The ${name} query returned more rows than the page reads, so its totals would be wrong.`);
  return result;
}

export function dateParams(start: string, end: string): QueryOptions {
  return {
    params: [
      { name: 'start_date', type: 'DATE', value: start },
      { name: 'end_date', type: 'DATE', value: end },
    ],
  };
}

export const getSettings = cache(async () => {
  try {
    const [row] = (await runQuery('client_settings')).rows;
    return { timezone: String(row?.timezone || 'UTC'), currency: String(row?.currency || 'USD') };
  } catch (error) {
    if (error instanceof InseeqError) return { timezone: 'UTC', currency: 'USD' };
    throw error;
  }
});

export function parseRange(value: unknown): RangeKey {
  return typeof value === 'string' && value in RANGES ? (value as RangeKey) : DEFAULT_RANGE;
}

/** Days are the client's days, from cfg_client: "yesterday" on a server in UTC is often the wrong day. */
export async function getPeriod(range: RangeKey): Promise<Period> {
  const { timezone, currency } = await getSettings();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const length = RANGES[range];
  const end = addDays(today, -1);
  const start = addDays(end, -(length - 1));
  return {
    range,
    start,
    end,
    previousStart: addDays(start, -length),
    previousEnd: addDays(start, -1),
    days: daysBetween(start, end),
    label: dayRange(start, end),
    timezone,
    currency,
  };
}
