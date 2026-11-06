import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { clientFromEnv, InseeqError, type Status, type Table } from '../lib/inseeq.ts';
import { isValidSession, SESSION_COOKIE } from '../lib/session.ts';

function Freshness({ status }: { status: Status }) {
  return (
    <dl>
      <dt>Last refresh</dt>
      <dd>{status.refreshed_at ?? 'Not recorded yet'}</dd>
      <dt>Build</dt>
      <dd>{status.build_mode ?? 'Not recorded yet'}</dd>
      <dt>Stale sources</dt>
      <dd>{status.stale_sources.join(', ') || 'None'}</dd>
      <dt>Last failure</dt>
      <dd>{status.last_failure?.failed_at ?? 'None'}</dd>
    </dl>
  );
}

function Tables({ tables }: { tables: Table[] }) {
  if (tables.length === 0) return <p>No tables are published yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Table</th>
          <th className="number">Rows</th>
          <th>Dates</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {tables.map(({ name, row_count: rows, date_from: from, date_to: to, description }) => (
          <tr key={name}>
            <td>{name}</td>
            <td className="number">{rows?.toLocaleString('en-US') ?? 'Unknown'}</td>
            <td className="nowrap">{from || to ? `${from ?? '?'} to ${to ?? '?'}` : 'No dates'}</td>
            <td>{description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function loadDashboard() {
  try {
    const client = clientFromEnv();
    const [status, tables] = await Promise.all([client.status(), client.listTables()]);
    return { status, tables };
  } catch (error) {
    if (error instanceof InseeqError) return { error };
    throw error;
  }
}

export default async function DashboardPage() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSession(session, process.env.DASHBOARD_PASSWORD)) redirect('/login');

  const { status, tables, error } = await loadDashboard();
  return (
    <main>
      <header>
        <h1>Data dashboard</h1>
        <form method="post" action="/api/logout">
          <button type="submit">Log out</button>
        </form>
      </header>
      {error ? (
        <p className="error">
          {error.message} <span className="muted">({error.code})</span>
        </p>
      ) : (
        <>
          <h2>Freshness</h2>
          <Freshness status={status} />
          <h2>Tables</h2>
          <Tables tables={tables} />
        </>
      )}
    </main>
  );
}
