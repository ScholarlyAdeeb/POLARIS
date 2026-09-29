import React, { useEffect, useMemo, useState } from 'react';
import { api, type Series } from '../lib/api';

/**
 * Line charts for a record's numeric columns. Columns have different units, so each gets
 * its own small chart (one y-axis each, never a dual axis). Hover shows a crosshair + value;
 * a table view lists the same numbers.
 */

const W = 520;
const H = 150;
const PAD = { l: 44, r: 12, t: 12, b: 24 };
const LINE = '#2a78d6';

function fmt(v: number) {
  const a = Math.abs(v);
  return a >= 1000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function shortX(x: string) {
  const d = Date.parse(x);
  return Number.isFinite(d) && /\d{4}-\d{2}-\d{2}/.test(x) ? new Date(d).toISOString().slice(5, 16).replace('T', ' ') : x;
}

export function Mini({ name, xs, ys }: { name: string; xs: string[]; ys: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const finite = ys.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const x = (i: number) => PAD.l + (i / Math.max(ys.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);
  const d = ys
    .map((v, i) => {
      if (!Number.isFinite(v)) return '';
      const cmd = i === 0 || !Number.isFinite(ys[i - 1]) ? 'M' : 'L';
      return `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    })
    .join('');
  const ticks = [min, min + span / 2, max];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (ys.length - 1));
    setHover(i >= 0 && i < ys.length ? i : null);
  };

  return (
    <figure className="sci-well p-3">
      <figcaption className="text-xs font-semibold mb-1">{name}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${name}: ${ys.length} values from ${fmt(min)} to ${fmt(max)}`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#d7e0ec" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#64748b">
                {fmt(t)}
              </text>
            </g>
          ))}
          <text x={PAD.l} y={H - 6} fontSize={10} fill="#64748b">
            {shortX(xs[0] ?? '')}
          </text>
          <text x={W - PAD.r} y={H - 6} fontSize={10} fill="#64748b" textAnchor="end">
            {shortX(xs[xs.length - 1] ?? '')}
          </text>
          <path d={d} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && Number.isFinite(ys[hover]) && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(ys[hover])} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent" />
        </svg>
        {hover !== null && Number.isFinite(ys[hover]) && (
          <div
            className="absolute top-0 pointer-events-none sci-card px-2 py-1 text-[11px] whitespace-nowrap"
            style={{ left: `${Math.min((x(hover) / W) * 100, 70)}%` }}
          >
            <span className="sci-mono font-semibold">{fmt(ys[hover])}</span> <span className="sci-muted">{shortX(xs[hover])}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

export function SeriesChart({ recordId }: { recordId: string }) {
  const [data, setData] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    setData(null);
    setError(null);
    api.series(recordId).then(setData).catch((e) => setError(e.status === 404 ? null : e.message));
  }, [recordId]);

  const xs = useMemo(() => data?.rows.map((r) => r.x) ?? [], [data]);
  if (error) return <p className="text-xs sci-muted">Chart unavailable: {error}</p>;
  if (!data) return null;

  return (
    <section className="flex flex-col gap-2" data-testid="series-chart">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Data preview</h4>
        <button className="text-xs underline sci-muted" onClick={() => setTable(!table)}>
          {table ? 'Show charts' : 'Show table'}
        </button>
      </div>
      <p className="text-[11px] sci-muted">
        {data.source} · {data.rows.length} rows{data.truncated ? ' (first 1,000 shown)' : ''}
      </p>
      {table ? (
        <div className="overflow-auto max-h-64 sci-well">
          <table className="text-xs sci-mono w-full">
            <thead>
              <tr>
                <th className="text-left p-1.5">{data.x}</th>
                {data.columns.map((c) => (
                  <th key={c} className="text-right p-1.5">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 200).map((r, i) => (
                <tr key={i} className="border-t sci-border">
                  <td className="p-1.5">{r.x}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className="text-right p-1.5">
                      {Number.isFinite(v) ? fmt(v) : '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.columns.map((c, j) => (
            <Mini key={c} name={c} xs={xs} ys={data.rows.map((r) => r.values[j])} />
          ))}
        </div>
      )}
    </section>
  );
}
