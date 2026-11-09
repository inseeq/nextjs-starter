import Link from 'next/link';
import type { ReactNode } from 'react';

import { RANGES, type RangeKey } from '../lib/data.ts';
import { percent } from '../lib/format.ts';
import { InseeqError } from '../lib/inseeq.ts';

export function Card({ title, subtitle, children, footnote, wide = true }: { title: string; subtitle?: string; children: ReactNode; footnote?: ReactNode; wide?: boolean }) {
  return (
    <section className={`card${wide ? ' wide' : ''}`}>
      <header>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
      {footnote ? <p className="footnote">{footnote}</p> : null}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="cards">{children}</div>;
}

export interface Kpi {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
  /** Whether a rise is good news. Spend going up is neither, so pass null. */
  upIsGood?: boolean | null;
  compareLabel: string;
}

export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="kpis">
      {kpis.map((kpi) => (
        <KpiTile key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

function KpiTile({ label, value, current, previous, upIsGood = true, compareLabel }: Kpi) {
  const change = current !== null && previous ? (current - previous) / previous : null;
  const direction = change === null || Math.abs(change) < 0.005 ? 'flat' : change > 0 ? 'up' : 'down';
  const tone = direction === 'flat' || upIsGood === null ? 'neutral' : (direction === 'up') === upIsGood ? 'good' : 'bad';
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {change === null ? (
        <span className="kpi-delta neutral">No earlier data to compare</span>
      ) : (
        <span className={`kpi-delta ${tone}`}>
          <span aria-hidden>{direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}</span> {percent(Math.abs(change))} {compareLabel}
        </span>
      )}
    </div>
  );
}

export interface Column<Row> {
  label: string;
  value: (row: Row) => ReactNode;
  numeric?: boolean;
}

export function DataTable<Row>({ columns, rows, rowKey, total }: { columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; total?: Row }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} className={column.numeric ? 'num' : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.label} className={column.numeric ? 'num' : undefined}>
                  {column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total ? (
          <tfoot>
            <tr>
              {columns.map((column) => (
                <td key={column.label} className={column.numeric ? 'num' : undefined}>
                  {column.value(total)}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** The numbers behind a chart, folded away until asked for. */
export function Numbers({ children }: { children: ReactNode }) {
  return (
    <details className="numbers">
      <summary>Show the numbers</summary>
      {children}
    </details>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ background: color }} />;
}

export function Tabs({ base, tabs, active, range }: { base: string; tabs: { slug: string; title: string }[]; active: string; range: RangeKey }) {
  if (tabs.length < 2) return <span />;
  return (
    <nav className="tabs" aria-label="Views">
      {tabs.map((tab) => (
        <Link key={tab.slug} href={`${base}/${tab.slug}?range=${range}`} aria-current={tab.slug === active ? 'page' : undefined}>
          {tab.title}
        </Link>
      ))}
    </nav>
  );
}

export function RangePicker({ path, range }: { path: string; range: RangeKey }) {
  return (
    <nav className="segmented" aria-label="Date range">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => (
        <Link key={key} href={`${path}?range=${key}`} aria-current={key === range ? 'page' : undefined}>
          {`${RANGES[key]} days`}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** What a reader sees when a view cannot load. The code is for whoever fixes it. */
export function ErrorState({ error }: { error: InseeqError }) {
  const missing = /not found: table|was not found/i.test(error.message);
  return (
    <div className="callout bad" role="alert">
      <strong>{missing ? 'This view needs data your organization does not have yet.' : 'This view could not load.'}</strong>
      <p>{error.message}</p>
      <code>{error.code}</code>
    </div>
  );
}
