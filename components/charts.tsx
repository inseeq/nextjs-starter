import type { CSSProperties } from 'react';

import { shortDay } from '../lib/format.ts';

/** Series colors in a fixed order, checked for color blindness. Give each entity one slot and keep it. */
export const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'] as const;
export const MUTED = 'var(--series-muted)';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

type Format = (value: number) => string;

function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((step) => step * power >= raw) ?? 10) * power;
}

function yTicks(max: number): number[] {
  if (max <= 0) return [0];
  const step = niceStep(max, 4);
  const ticks = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick);
  return ticks;
}

function xLabelIndexes(length: number): Set<number> {
  const every = Math.max(1, Math.ceil(length / 6));
  const shown = new Set<number>();
  for (let i = length - 1; i >= 0; i -= every) shown.add(i);
  return shown;
}

const pct = (value: number, max: number) => `${max > 0 ? (value / max) * 100 : 0}%`;

export function Legend({ series }: { series: Pick<Series, 'key' | 'label' | 'color'>[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="legend">
      {series.map(({ key, label, color }) => (
        <li key={key}>
          <span className="swatch" style={{ background: color }} />
          {label}
        </li>
      ))}
    </ul>
  );
}

function Grid({ ticks, top, format }: { ticks: number[]; top: number; format: Format }) {
  return (
    <div className="grid" aria-hidden>
      {ticks.map((tick) => (
        <div key={tick} className="gridline" style={{ bottom: pct(tick, top) }}>
          <span>{format(tick)}</span>
        </div>
      ))}
    </div>
  );
}

function Tooltip({ day, series, index, format, total }: { day: string; series: Series[]; index: number; format: Format; total?: boolean }) {
  return (
    <div className="tip" role="tooltip">
      <strong>{shortDay(day)}</strong>
      {series.map((s) => (
        <span key={s.key} className="tip-row">
          <span className="swatch" style={{ background: s.color }} />
          {s.label}
          <b>{format(s.values[index] ?? 0)}</b>
        </span>
      ))}
      {total && series.length > 1 ? (
        <span className="tip-row tip-total">
          Total<b>{format(series.reduce((sum, s) => sum + (s.values[index] ?? 0), 0))}</b>
        </span>
      ) : null}
    </div>
  );
}

/** Columns per day, stacked when there is more than one series. Hover a day for its numbers. */
export function ColumnChart({ days, series, format, axisFormat = format, label }: { days: string[]; series: Series[]; format: Format; axisFormat?: Format; label: string }) {
  const totals = days.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const ticks = yTicks(Math.max(...totals, 0));
  const top = ticks[ticks.length - 1] || 1;
  const labelled = xLabelIndexes(days.length);
  return (
    <figure className="chart" aria-label={label}>
      <Legend series={series} />
      <div className="plot">
        <Grid ticks={ticks} top={top} format={axisFormat} />
        <div className="cols" style={{ '--n': days.length } as CSSProperties}>
          {days.map((day, i) => (
            <div key={day} className={`col${i >= days.length / 2 ? ' flip' : ''}`}>
              <div className="stack" style={{ height: pct(totals[i], top) }}>
                {series.map((s) => (s.values[i] > 0 ? <div key={s.key} className="seg" style={{ flexGrow: s.values[i], background: s.color }} /> : null))}
              </div>
              {labelled.has(i) ? <span className="xlabel">{shortDay(day)}</span> : null}
              <Tooltip day={day} series={series} index={i} format={format} total />
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** One line per series over days, with a light wash under a single line. Hover for a crosshair and the numbers. */
export function LineChart({ days, series, format, axisFormat = format, label }: { days: string[]; series: Series[]; format: Format; axisFormat?: Format; label: string }) {
  const ticks = yTicks(Math.max(...series.flatMap((s) => s.values), 0));
  const top = ticks[ticks.length - 1] || 1;
  const labelled = xLabelIndexes(days.length);
  const point = (value: number, i: number) => `${i + 0.5},${100 - (value / top) * 100}`;
  return (
    <figure className="chart" aria-label={label}>
      <Legend series={series} />
      <div className="plot">
        <Grid ticks={ticks} top={top} format={axisFormat} />
        <div className="lines">
          <svg viewBox={`0 0 ${days.length} 100`} preserveAspectRatio="none" aria-hidden>
            {series.length === 1 ? (
              <polygon
                points={`0.5,100 ${series[0].values.map(point).join(' ')} ${days.length - 0.5},100`}
                style={{ fill: series[0].color }}
                className="wash"
              />
            ) : null}
            {series.map((s) => (
              <polyline key={s.key} points={s.values.map(point).join(' ')} style={{ stroke: s.color }} />
            ))}
          </svg>
          {series.map((s) => (
            <span
              key={s.key}
              className="end-dot"
              style={{ background: s.color, left: `calc(100% - 100% / ${days.length} / 2)`, bottom: pct(s.values[s.values.length - 1] ?? 0, top) }}
            />
          ))}
        </div>
        <div className="cols hover-only" style={{ '--n': days.length } as CSSProperties}>
          {days.map((day, i) => (
            <div key={day} className={`col crosshair${i >= days.length / 2 ? ' flip' : ''}`}>
              {labelled.has(i) ? <span className="xlabel">{shortDay(day)}</span> : null}
              <Tooltip day={day} series={series} index={i} format={format} />
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

export interface RankedRow {
  key: string;
  label: string;
  value: number;
  color?: string;
  note?: string;
}

/** Horizontal bars, largest first, the value at the tip. For comparing a handful of things. */
export function RankedBars({ rows, format, label }: { rows: RankedRow[]; format: Format; label: string }) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  return (
    <ol className="ranked" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className="ranked-label" title={row.label}>
            {row.label}
            {row.note ? <small>{row.note}</small> : null}
          </span>
          <span className="ranked-track">
            <span className="ranked-bar" style={{ width: pct(row.value, max), background: row.color ?? COLORS[0] }} />
            <b>{format(row.value)}</b>
          </span>
        </li>
      ))}
    </ol>
  );
}
