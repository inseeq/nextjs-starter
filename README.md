# inseeq Next.js starter

A small Next.js app on the [inseeq Data API](https://api.inseeq.com/llms.txt): a password login, a dashboard of your data's freshness and tables, a signed webhook receiver and a typed client. It works for any organization. Change it or replace it.

## Start

Make a private copy, because it will hold your dashboards. A fork of a public repo stays public.

```bash
gh repo create my-dashboard --template inseeq/nextjs-starter --private --clone
cd my-dashboard
npm install
npm run setup
npm run dev
```

You need Node 22.22 or newer. In Claude, with the inseeq connector, ask for a data key and open the one-time link. `setup` asks for the key in your own terminal, writes `.env`, prints your dashboard password once and checks the connection. Then open <http://localhost:3000>, and open Claude in this folder to build.

## What is here

| Path | What it does |
|---|---|
| `lib/inseeq.ts` | The API client: paging, retries and typed errors |
| `lib/session.ts`, `proxy.ts` | The signed cookie and the login gate |
| `app/webhooks/inseeq/route.ts` | The webhook receiver. Add your work to `handleEvent` |
| `queries/` | One `.sql` file per metric, with one SELECT each |
| `examples/daily-digest` | A daily Slack post from one query, run by GitHub Actions. No server. |
| `cli.ts` | The commands below |

```ts
const client = clientFromEnv();
const tables = await client.listTables();
const { rows, truncated } = await client.runSaved('since_example', {
  params: [{ name: 'since', type: 'DATE', value: '2026-01-01' }],
});
```

## Commands

```bash
npm run query "select 1 as ok"   # SQL, or the name of a file in queries/
npm run webhook register https://your-app.example.com
npm run webhook test <id>
```

`webhook register` writes `INSEEQ_WEBHOOK_SECRET` to `.env`. `next start` reads `.env` only when it starts, so restart it. Until then it answers 503 to every delivery.

The receiver checks each delivery's signature and logs the event. Deliveries can repeat, so make your work safe to repeat, or keep each `webhook-id` in shared storage for 4 days.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finseeq%2Fnextjs-starter&env=INSEEQ_API_KEY,DASHBOARD_PASSWORD&envDescription=Your%20inseeq%20data%20key%20and%20a%20long%20random%20dashboard%20password&envLink=https%3A%2F%2Fapi.inseeq.com%2Fllms.txt)

Keep the new repo private. Any Node host works. Set `INSEEQ_API_KEY` and `DASHBOARD_PASSWORD`, plus `INSEEQ_WEBHOOK_SECRET` for webhooks. Webhooks need a public https URL on port 443.

## Learn more

- [Data API docs](https://api.inseeq.com/llms.txt)
- [Dashboards](https://api.inseeq.com/docs/dashboards.md)
- [Automations](https://api.inseeq.com/docs/automations.md)
