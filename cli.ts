import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

import { clientFromEnv, createClient, DEFAULT_API_URL, InseeqError } from './lib/inseeq.ts';

const ENV_FILE = '.env';
const RECEIVER_PATH = '/webhooks/inseeq';
const QUERY_ROW_LIMIT = 1_000;
const INTERRUPTED_EXIT_CODE = 130;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function saveEnv(updates: Record<string, string>): void {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split('\n') : [];
  const kept = existing.filter((line) => line && !(line.split('=')[0] in updates));
  const lines = [...kept, ...Object.entries(updates).map(([name, value]) => `${name}=${value}`)];
  const temporary = `${ENV_FILE}.tmp`;
  writeFileSync(temporary, `${lines.join('\n')}\n`, { mode: 0o600 });
  renameSync(temporary, ENV_FILE);
}

async function readHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const silent = new Writable({ write: (_chunk, _encoding, done) => done() });
  const reader = createInterface({ input: process.stdin, output: silent, terminal: true });
  reader.on('SIGINT', () => process.exit(INTERRUPTED_EXIT_CODE));
  const answer = await reader.question('');
  reader.close();
  console.log();
  return answer.trim();
}

async function setup(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) fail('Setup needs a real terminal. Open your own in this folder and run: npm run setup');

  const apiKey = await readHidden('Paste your inseeq data key (it stays hidden): ');
  if (!apiKey) fail('No key entered, so nothing was changed.');

  const apiUrl = process.env.INSEEQ_API_URL || DEFAULT_API_URL;
  const savedPassword = process.env.DASHBOARD_PASSWORD;
  const password = savedPassword || randomBytes(24).toString('base64url');
  saveEnv({ INSEEQ_API_KEY: apiKey, INSEEQ_API_URL: apiUrl, DASHBOARD_PASSWORD: password });
  console.log(savedPassword ? 'Wrote .env and kept its DASHBOARD_PASSWORD.' : `Wrote .env. Dashboard password, shown once: ${password}`);

  const client = createClient({ apiKey, apiUrl });
  const [status, tables] = await Promise.all([client.status(), client.listTables()]);
  console.log(`Connected. ${tables.length} tables. Last refresh: ${status.refreshed_at ?? 'not recorded yet'}.`);
}

async function query(sqlOrName?: string): Promise<void> {
  if (!sqlOrName) fail('Usage: npm run query "select 1 as ok", or the name of a file in queries/');
  const file = `queries/${sqlOrName}.sql`;
  const sql = existsSync(file) ? readFileSync(file, 'utf8') : sqlOrName;
  const result = await clientFromEnv().query(sql, { rowLimit: QUERY_ROW_LIMIT });
  console.log(JSON.stringify(result, null, 2));
  if (result.truncated) console.error(`Stopped at ${QUERY_ROW_LIMIT} rows. Aggregate in SQL, or call client.query from code.`);
}

async function registerWebhook(address: string): Promise<void> {
  const client = clientFromEnv();
  const url = new URL(address);
  if (url.pathname === '/') url.pathname = RECEIVER_PATH;
  const existing = (await client.listWebhooks()).find((webhook) => webhook.url === url.href);
  if (existing) fail(`${url.href} is already registered as ${existing.id}. Send DELETE /v1/webhooks/${existing.id} first to get a new secret.`);

  const { id, secret } = await client.createWebhook(url.href);
  saveEnv({ INSEEQ_WEBHOOK_SECRET: secret });
  console.log(`Registered ${url.href} as ${id}. Wrote INSEEQ_WEBHOOK_SECRET to .env.`);
  console.log('next start reads .env only when it starts and answers 503 until you restart it. next dev reloads it. On a host, set the secret and redeploy.');
  console.log(`Then run: npm run webhook test ${id}`);
}

async function testWebhook(id: string): Promise<void> {
  const { delivered, status } = await clientFromEnv().testWebhook(id);
  if (!delivered) fail(`Not delivered. The receiver answered ${status ?? 'nothing'}.`);
  console.log(`Delivered. The receiver answered ${status}.`);
}

async function webhook(subcommand = '', argument = ''): Promise<void> {
  if (!argument || !['register', 'test'].includes(subcommand)) fail('Usage: npm run webhook register <url> | test <id>');
  await (subcommand === 'register' ? registerWebhook(argument) : testWebhook(argument));
}

const commands: Record<string, (...args: string[]) => Promise<void>> = { setup, query, webhook };
const [command = '', ...args] = process.argv.slice(2);
if (!Object.hasOwn(commands, command)) fail(`Commands: ${Object.keys(commands).join(', ')}`);
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

try {
  await commands[command](...args);
} catch (error) {
  fail(error instanceof InseeqError ? `${error.code}: ${error.message}` : String(error));
}
