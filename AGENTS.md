# AGENTS.md

A Next.js app on the inseeq Data API. To set it up for a user, follow "For Claude: set it up" in `README.md`. Read <https://api.inseeq.com/llms.txt> before any data work.

- Never read, print or copy `.env`, including through a shell. The `npm run` commands load it themselves, and a script of yours can call `process.loadEnvFile('.env')`.
- Never ask for a key or a password in chat. Set up a key with `npm run setup -- --from-clipboard`, after the user says they copied it from the key page. Hand over the dashboard password with `npm run password`, which copies it. Never print either.
- To check a logged-in page, start your own server with a throwaway `DASHBOARD_PASSWORD` on the command line, bound to `127.0.0.1`.
- The key stays on the server. Never add a `NEXT_PUBLIC_` variable for it or pass it to a client component.
- Pass values through `params`. Never build SQL strings.
- Never render data as raw HTML: no `dangerouslySetInnerHTML`.
- Tables can hold personal data. Keep rows out of logs, commits and fixtures.
- New routes stay behind the login. Add to `PUBLIC_PATHS` only if the user asks for a public route.
- Check `truncated` before you trust a total.
- Webhook deliveries can repeat. Keep work in `handleEvent` safe to repeat.

## Pages and tabs

- `dashboards/index.ts` lists the pages in the sidebar. Each page is one file in `dashboards/`, and each tab in it is an async component that gets the chosen period.
- A new page is a new file plus one line in `index.ts`. A new tab is one entry in a page's `tabs`. Put each query in `queries/`, and read it with `runQuery` from `lib/data.ts`, which refuses a cut-off answer.
- Build from `components/ui.tsx` (`KpiRow`, `Card`, `DataTable`, `Numbers`, `EmptyState`) and `components/charts.tsx` (`ColumnChart`, `LineChart`, `RankedBars`). Colors are tokens in `app/globals.css`. Never write a hex value in a component.
- The three example pages are examples. Remove one when the user asks, by deleting its file and its line in `index.ts`.

## How a page reads

- Lead with the numbers for the period, compared with the period before. The chart comes after.
- Write dates for people: "Nov 8", "Oct 10 to Nov 8, 2026", "Updated 2 hours ago". Never show a raw timestamp, a time zone name, a table name or a column name on a dashboard page. `lib/format.ts` has the helpers.
- Name things in business words: "Meta Ads", not `meta_ads`; "Booked a demo", not `is_demo_booked`.
- Use the client's day: `getPeriod` takes it from `cfg_client`. Never "yesterday" on the server's clock.
- One chart per question, one y-axis per chart. Columns for amounts per day, a line for a trend, ranked bars to compare things. Give each entity one color and keep it on every tab.
- Every chart has its numbers under "Show the numbers", and every view has an empty state that says what is missing.
- Say what the numbers cannot show, in a footnote: for example, that recent leads may still book.
- Look at the page in a browser before you call it done.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
