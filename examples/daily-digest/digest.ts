import { existsSync } from 'node:fs';

import { clientFromEnv, InseeqError } from '../../lib/inseeq.ts';

const ENV_FILE = '.env';
const QUERY_NAME = 'daily_digest';
const MAX_LINES = 20;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SLACK_TIMEOUT_MS = 30_000;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function postToSlack(text: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(process.env.SLACK_WEBHOOK_URL ?? '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
  } catch {
    throw new InseeqError('slack_unreachable', 'Could not reach the Slack webhook.');
  }
  if (!response.ok) {
    const answer = (await response.text()).slice(0, 100);
    throw new InseeqError('slack_error', `Slack answered ${response.status}: ${answer}`, response.status);
  }
}

function describe(row: Record<string, unknown>): string {
  return Object.entries(row).map(([name, value]) => `${name}: ${value}`).join(', ');
}

async function digest(): Promise<void> {
  if (!process.env.SLACK_WEBHOOK_URL) fail('SLACK_WEBHOOK_URL is not set.');
  const client = clientFromEnv();

  const status = await client.status();
  const age = status.refreshed_at ? Date.now() - Date.parse(status.refreshed_at) : Infinity;
  if (status.last_failure || !(age <= MAX_AGE_MS)) {
    await postToSlack(`inseeq data is not fresh: last refresh ${status.refreshed_at ?? 'never'}`);
    fail('The data is not fresh. Posted that to Slack instead of the digest.');
  }

  const day = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
  const { rows, total_rows: totalRows } = await client.runSaved(QUERY_NAME, {
    params: [{ name: 'day', type: 'DATE', value: day }],
    rowLimit: MAX_LINES,
  });
  const lines = rows.length ? rows.map(describe) : ['No data.'];
  if (totalRows > rows.length) lines.push(`and ${totalRows - rows.length} more rows`);
  await postToSlack([`Yesterday (${day})`, ...lines].join('\n'));
  console.log(`Posted ${rows.length} lines for ${day}.`);
}

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

try {
  await digest();
} catch (error) {
  fail(error instanceof InseeqError ? `${error.code}: ${error.message}` : String(error));
}
