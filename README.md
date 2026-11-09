# inseeq dashboard starter

A private dashboard on your company's inseeq data: paid media, website and pipeline pages to start, and Claude builds the rest with you.

## Start in Claude Code

You need:

- [Claude Code](https://claude.com/claude-code), in the desktop app or the terminal. A chat on claude.ai cannot make the project.
- The inseeq connector, added in Claude under Settings, Connectors.
- [Node.js](https://nodejs.org) 22.22 or newer.

Open Claude Code in an empty folder and say:

```
Set up my inseeq dashboard from https://github.com/inseeq/nextjs-starter
```

Claude does the rest. You do two things:

1. Open the key link Claude gives you, click **Show my key**, then **Copy**, and tell Claude "copied".
2. Log in to the dashboard Claude opens. Claude puts the password on your clipboard.

You get three pages, each with tabs, on your own numbers from the last 30 days. Then ask for more, for example: "Add a page for demos, with a tab per sales rep."

## For Claude: set it up

Do these steps in order. Say in one line what you are doing at each step.

1. **Make the user's own copy.** It will hold their dashboards, so it is private and theirs.
   - If `gh auth status` succeeds: `gh repo create <name> --template inseeq/nextjs-starter --private --clone`, then `cd <name>`. Ask the user for a name, or use `inseeq-dashboard`.
   - If not: `git clone --depth 1 https://github.com/inseeq/nextjs-starter <name> && cd <name> && rm -rf .git && git init -q`. Tell the user it lives only on their computer for now.
   - Never fork: a fork of a public repo stays public.
2. **Install:** `npm install`. Warnings are normal. Stop only on an error.
3. **Get a data key.** Call the inseeq connector's `create_data_key` with label `Dashboard`. Give the user the link exactly as it comes back, and say: "Open this, click Show my key, then Copy, and tell me when you've copied it." Never open the link, and never ask for the key in chat. If no inseeq tools are loaded, ask the user to add the inseeq connector in Claude, then restart Claude Code.
4. **When the user says they copied it:** `npm run setup -- --from-clipboard`. It saves the key and a dashboard password in `.env`, checks the connection, clears the clipboard and prints neither. If it says the clipboard holds no key, ask the user to click Copy again.
5. **Start it:** `npm run dev` in the background. Wait for it to answer, then run `npm run password` and tell the user: "Open http://localhost:3000 and paste the password. It's on your clipboard."
6. **Tell the user what they are looking at** in two or three sentences, then explain saved queries (below) in plain words, and offer to build their first page.

If a page shows "This view needs data your organization does not have yet", that source is not connected in inseeq. The other pages still work.

## How it is built

Each page in the sidebar is a file in `dashboards/`, and each tab in it is a small server component. `dashboards/index.ts` sets the order.

| Path | What it holds |
|---|---|
| `dashboards/` | The pages and their tabs |
| `queries/` | Saved queries: one `.sql` file per question |
| `components/` | The frame, headline numbers, cards, tables and charts. Drawn on the server, no chart library |
| `app/globals.css` | Colors and sizes, light and dark |
| `lib/data.ts` | The date range, in your company's time zone, and `runQuery` |
| `lib/inseeq.ts` | The API client: paging, retries and clear errors |
| `proxy.ts`, `lib/session.ts` | The password login |
| `app/webhooks/inseeq/route.ts` | Receives inseeq's events, such as "your data was refreshed" |
| `examples/daily-digest` | A daily Slack message from one query, run by GitHub Actions |

### Saved queries

A saved query is a file in `queries/` that holds one SELECT, for example `queries/paid_media_daily.sql`:

```sql
select date_native as day, platform, sum(spend_amount) as spend
from int_ads__performance_daily
where not is_detail and date_native between @start_date and @end_date
group by day, platform
```

- **Tables are named without a dataset.** The data key already decides whose data you read.
- **`@start_date` is a parameter.** The value travels separately from the SQL, so it is never pasted into it.
- **A tab runs it by name:**

  ```tsx
  async function Spend({ period }: ViewProps) {
    const { rows } = await runQuery('paid_media_daily', dateParams(period.start, period.end));
    return <Card title="Spend per day" subtitle={period.label}>...</Card>;
  }
  ```

  `runQuery` refuses a cut-off answer, so a total is never silently short.
- **Run one from the terminal** to see its rows: `npm run query paid_media_daily`. This also takes plain SQL: `npm run query "select 1 as ok"`.
- **Answers are cached until the next refresh.** inseeq rebuilds your data several times a day, and the same query with the same values comes back from the cache until then. "Updated 2 hours ago" in the sidebar is the time of the last rebuild.

To build a new page, ask Claude. It finds the right table with the inseeq connector, writes the query, and adds the page, following `AGENTS.md`.

## Put it online

The dashboard runs on [Vercel](https://vercel.com), on its free plan. Ask Claude to "put my dashboard online", or:

```bash
npx vercel link --yes    # sign in if asked, and create a project for this folder
npm run vercel-env       # copies the key and the password from .env to Vercel, without printing them
npx vercel deploy --prod
```

Anyone with the address and the password can see the dashboard. To change the password, edit `DASHBOARD_PASSWORD` in `.env` and run `npm run vercel-env` again.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | The dashboard on http://localhost:3000 |
| `npm run setup -- --from-clipboard` | Saves a copied data key to `.env`. `npm run setup` alone asks for it instead |
| `npm run password` | Copies the dashboard password |
| `npm run query <name or SQL>` | Runs a saved query, or SQL, and prints the rows |
| `npm run vercel-env` | Sends `.env`'s values to the linked Vercel project |
| `npm run webhook register <url>` | Asks inseeq to send events to your deployed dashboard |

## Learn more

- [Data API docs](https://api.inseeq.com/llms.txt)
- [Dashboards](https://api.inseeq.com/docs/dashboards.md)
- [Automations](https://api.inseeq.com/docs/automations.md)
