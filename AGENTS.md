# AGENTS.md

A Next.js app on the inseeq Data API. Read <https://api.inseeq.com/llms.txt> before any data work.

- Never read, print or copy `.env`, including through a shell. The `npm run` commands load it themselves, and a script of yours can call `process.loadEnvFile('.env')`.
- `npm run setup` needs the user's own terminal. Never run it for them, and never ask for a key or password in chat.
- To check a logged-in page, start your own server with a throwaway `DASHBOARD_PASSWORD` on the command line, bound to `127.0.0.1`.
- The key stays on the server. Never add a `NEXT_PUBLIC_` variable for it or pass it to a client component.
- Pass values through `params`. Never build SQL strings.
- Never render data as raw HTML: no `dangerouslySetInnerHTML`.
- Tables can hold personal data. Keep rows out of logs, commits and fixtures.
- New routes stay behind the login. Add to `PUBLIC_PATHS` only if the user asks for a public route.
- Check `truncated` before you trust a total.
- Webhook deliveries can repeat. Keep work in `handleEvent` safe to repeat.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
