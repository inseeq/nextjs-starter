import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { dashboards } from '../dashboards/index.ts';
import { getSettings, getStatus } from '../lib/data.ts';
import { fullTime, timeAgo } from '../lib/format.ts';
import { InseeqError, type Status } from '../lib/inseeq.ts';
import { isValidSession, SESSION_COOKIE } from '../lib/session.ts';

const ICONS = {
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  funnel: 'M3 4h18l-7 8v6l-4 2v-8L3 4Z',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

async function loadStatus(): Promise<Status | null> {
  try {
    return await getStatus();
  } catch (error) {
    if (error instanceof InseeqError) return null;
    throw error;
  }
}

function Freshness({ status, timezone }: { status: Status | null; timezone: string }) {
  if (!status?.refreshed_at) return <p className="freshness">Waiting for the first refresh</p>;
  const behind = status.stale_sources.length;
  const failed = Boolean(status.last_failure && status.last_failure.failed_at > status.refreshed_at);
  return (
    <p className={`freshness${behind || failed ? ' warn' : ''}`} title={fullTime(status.refreshed_at, timezone)}>
      <span className="dot" aria-hidden />
      {`Updated ${timeAgo(status.refreshed_at)}`}
      {failed ? <small>The last refresh failed</small> : null}
      {behind ? <small>{behind === 1 ? '1 source is' : `${behind} sources are`} behind</small> : null}
    </p>
  );
}

/** The frame around every page: the page list, the freshness line and the log-out button. */
export async function Shell({ active, children }: { active: string; children: ReactNode }) {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSession(session, process.env.DASHBOARD_PASSWORD)) redirect('/login');
  const [status, { timezone }] = await Promise.all([loadStatus(), getSettings()]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden />
          {process.env.DASHBOARD_TITLE || 'Dashboards'}
        </Link>
        <nav aria-label="Pages">
          {dashboards.map((dashboard) => (
            <Link key={dashboard.slug} href={`/${dashboard.slug}`} aria-current={dashboard.slug === active ? 'page' : undefined}>
              <Icon name={dashboard.icon} />
              {dashboard.title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Freshness status={status} timezone={timezone} />
          <form method="post" action="/api/logout">
            <button type="submit" className="quiet">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </header>
  );
}
