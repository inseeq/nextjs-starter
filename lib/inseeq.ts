import { readFile } from 'node:fs/promises';

export const DEFAULT_API_URL = 'https://api.inseeq.com';

const MAX_RETRIES = 5;
const MAX_RETRY_WAIT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 90_000;
const LIST_PAGE_SIZE = 100;
const QUERY_PAGE_SIZE = 5_000;
const DEFAULT_ROW_LIMIT = 10_000;
const QUERIES_DIR = 'queries';

export interface Table {
  name: string;
  type: string;
  description: string | null;
  grain: string | null;
  date_column: string | null;
  date_from: string | null;
  date_to: string | null;
  row_count: number | null;
  last_updated: string | null;
}

export interface Status {
  refreshed_at: string | null;
  build_mode: string | null;
  stale_sources: string[];
  data_version: string | null;
  last_failure: { failed_at: string } | null;
  sources: Record<string, unknown>[];
}

export interface QueryParam {
  name: string;
  type: 'STRING' | 'INT64' | 'FLOAT64' | 'BOOL' | 'DATE' | 'TIMESTAMP';
  value: string;
}

export type QueryOptions = { params?: QueryParam[]; rowLimit?: number };

interface QueryPage {
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  row_count: number;
  total_rows: number;
  next_cursor: string | null;
  data_version: string | null;
  refreshed_at: string | null;
  cached: boolean;
  bytes_processed: number;
}

export type QueryResult = Omit<QueryPage, 'next_cursor'> & { truncated: boolean };

export type Webhook = { id: string; url: string; status: string };
export type InseeqEvent = { id: string; type: string; timestamp: string; data: Record<string, unknown> };

export class InseeqError extends Error {
  readonly code: string;
  readonly status: number;
  readonly resetsAt?: string;

  constructor(code: string, message: string, status = 0, resetsAt?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.resetsAt = resetsAt;
  }
}

function search(params: Record<string, string | number | null | undefined>) {
  const present = Object.entries(params).flatMap(([name, value]) => (value ? [[name, String(value)]] : []));
  return new URLSearchParams(present);
}

export type Client = ReturnType<typeof createClient>;

export function createClient({ apiKey, apiUrl }: { apiKey: string; apiUrl?: string }) {
  const baseUrl = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');

  async function request<T>(method: string, route: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      let text: string;
      try {
        response = await fetch(`${baseUrl}/v1${route}`, {
          method,
          headers: { Authorization: `Bearer ${apiKey}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        text = await response.text();
      } catch {
        throw new InseeqError('unreachable', `Could not reach ${baseUrl}.`);
      }

      let payload;
      try {
        payload = text ? JSON.parse(text) : undefined;
      } catch {
        if (response.ok) throw new InseeqError('unexpected_response', `${baseUrl} did not answer JSON. Check INSEEQ_API_URL.`, response.status);
      }
      if (response.ok) return payload;

      const { code = 'unexpected_response', message = `The API answered ${response.status}.`, resets_at: resetsAt } = payload?.error ?? {};
      const retryAfter = response.headers.get('retry-after') ?? '';
      const waitSeconds = /^\d+$/.test(retryAfter) ? Number(retryAfter) : 2 ** attempt;
      const waitMs = (waitSeconds + Math.random()) * 1000;
      const retryable = ['rate_limited', 'busy', 'internal_error'].includes(code) || response.status === 503;
      if (!retryable || attempt >= MAX_RETRIES || waitMs > MAX_RETRY_WAIT_MS) {
        throw new InseeqError(code, message, response.status, resetsAt);
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  async function listTables(): Promise<Table[]> {
    const tables: Table[] = [];
    let after: string | null = null;
    do {
      const page: { tables: Table[]; next_after: string | null } = await request('GET', `/tables?${search({ limit: LIST_PAGE_SIZE, after })}`);
      tables.push(...page.tables);
      after = page.next_after;
    } while (after);
    return tables;
  }

  async function query(sql: string, { params, rowLimit = DEFAULT_ROW_LIMIT }: QueryOptions = {}): Promise<QueryResult> {
    const { next_cursor: firstCursor, ...first } = await request<QueryPage>('POST', '/query', {
      sql,
      params,
      max_rows: Math.min(QUERY_PAGE_SIZE, rowLimit),
    });
    const rows = first.rows;
    let cursor = firstCursor;
    while (cursor && rows.length < rowLimit) {
      const page = await request<QueryPage>('GET', `/query/results?${search({ cursor })}`);
      rows.push(...page.rows);
      cursor = page.next_cursor;
    }
    const kept = rows.slice(0, rowLimit);
    return { ...first, rows: kept, row_count: kept.length, truncated: cursor !== null || rows.length > rowLimit };
  }

  async function runSaved(name: string, options?: QueryOptions): Promise<QueryResult> {
    if (!/^[\w-]+$/.test(name)) throw new Error(`Not a saved query name: ${name}`);
    return query(await readFile(`${QUERIES_DIR}/${name}.sql`, 'utf8'), options);
  }

  return {
    listTables,
    query,
    runSaved,
    getTable: (name: string) => request<Table & { columns: { name: string; type: string; description: string | null }[] }>('GET', `/tables/${encodeURIComponent(name)}`),
    status: () => request<Status>('GET', '/status'),
    createWebhook: (url: string) => request<Webhook & { secret: string }>('POST', '/webhooks', { url }),
    listWebhooks: async () => (await request<{ webhooks: Webhook[] }>('GET', '/webhooks')).webhooks,
    testWebhook: (id: string) => request<{ delivered: boolean; status: number | null }>('POST', `/webhooks/${encodeURIComponent(id)}/test`),
  };
}

export function clientFromEnv(): Client {
  const apiKey = process.env.INSEEQ_API_KEY;
  if (!apiKey) throw new InseeqError('missing_key', 'INSEEQ_API_KEY is not set. Run npm run setup in your own terminal.');
  return createClient({ apiKey, apiUrl: process.env.INSEEQ_API_URL });
}
