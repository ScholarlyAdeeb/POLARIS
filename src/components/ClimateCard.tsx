import React, { useEffect, useState } from 'react';
import { api, download, downloadUrls, type StationClimate } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge } from './ui';

/**
 * Annual mean air temperature since 1981 (ERA5 reanalysis) with the 1981–2010 baseline and a
 * least-squares trend. One series, one axis; the baseline is a reference line, not a second series.
 */

const W = 640;
const H = 220;
const PAD = { l: 44, r: 16, t: 14, b: 26 };
const LINE = '#2a78d6';

export function ClimateCard({ stationId }: { stationId: string }) {
  const { t } = useT();
  const [c, setC] = useState<StationClimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    setC(null);
    setError(null);
    api.climate(stationId).then(setC).catch((e) => setError(e.message));
  }, [stationId]);

  const header = (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h3 className="font-semibold">{t('station.climate')}</h3>
      <DataStatusBadge status="EXTERNAL" />
    </div>
  );
  if (error)
    return (
      <section className="sci-card p-4 flex flex-col gap-2">
        {header}
        <p className="text-sm sci-muted">Climate history unavailable right now ({error}).</p>
      </section>
    );
  if (!c)
    return (
      <section className="sci-card p-4 flex flex-col gap-2" data-testid="climate-card">
        {header}
        <p className="text-sm sci-muted">{t('common.loading')} (first load fetches 45 years of daily data)</p>
      </section>
    );

  const ys = c.annual.map((a) => a.tempMean);
  const min = Math.min(...ys, c.baseline.tempMean) - 0.3;
  const max = Math.max(...ys, c.baseline.tempMean) + 0.3;
  const x = (i: number) => PAD.l + (i / Math.max(ys.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const d = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const first = c.annual[0];
  const last = c.annual[c.annual.length - 1];
  const sign = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2);

  return (
    <section className="sci-card p-4 flex flex-col gap-3" data-testid="climate-card">
      {header}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="sci-well p-2">
          <p className="text-[11px] sci-muted">Trend {first.year}–{last.year}</p>
          <p className="sci-mono font-semibold">{sign(c.trendPerDecade)} °C / decade</p>
        </div>
        <div className="sci-well p-2">
          <p className="text-[11px] sci-muted">{last.year} vs {c.baseline.period}</p>
          <p className="sci-mono font-semibold">{c.anomaly === null ? '—' : `${sign(c.anomaly)} °C`}</p>
        </div>
        <div className="sci-well p-2">
          <p className="text-[11px] sci-muted">{c.baseline.period} mean</p>
          <p className="sci-mono font-semibold">{c.baseline.tempMean.toFixed(1)} °C</p>
        </div>
        <div className="sci-well p-2">
          <p className="text-[11px] sci-muted">Coldest day, {last.year}</p>
          <p className="sci-mono font-semibold">{last.tempMin.toFixed(1)} °C</p>
        </div>
      </div>
      <figure className="sci-well p-3">
        <figcaption className="text-xs font-semibold mb-1">Annual mean air temperature (°C)</figcaption>
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block"
            role="img"
            aria-label={`Annual mean temperature ${first.year} to ${last.year}, from ${first.tempMean} to ${last.tempMean} °C`}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round((((e.clientX - r.left) / r.width) * W - PAD.l) / ((W - PAD.l - PAD.r) / Math.max(ys.length - 1, 1)));
              setHover(i >= 0 && i < ys.length ? i : null);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {[min + 0.3, (min + max) / 2, max - 0.3].map((v, i) => (
              <g key={i}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#d7e0ec" />
                <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#64748b">
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={y(c.baseline.tempMean)} y2={y(c.baseline.tempMean)} stroke="#64748b" strokeDasharray="4 4" />
            <text x={W - PAD.r} y={y(c.baseline.tempMean) - 4} textAnchor="end" fontSize={10} fill="#52514e">
              {c.baseline.period} mean
            </text>
            {c.annual.filter((_, i) => i % 5 === 0).map((a) => (
              <text key={a.year} x={x(c.annual.indexOf(a))} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">
                {a.year}
              </text>
            ))}
            <path d={d} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" />
                <circle cx={x(hover)} cy={y(ys[hover])} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
              </g>
            )}
          </svg>
          {hover !== null && (
            <div className="absolute top-0 pointer-events-none sci-card px-2 py-1 text-[11px]" style={{ left: `${Math.min((x(hover) / W) * 100, 72)}%` }}>
              <b>{c.annual[hover].year}</b> · <span className="sci-mono">{c.annual[hover].tempMean.toFixed(2)} °C</span>
            </div>
          )}
        </div>
      </figure>
      <div className="flex flex-wrap items-center gap-2">
        <button className="sci-btn-ghost text-xs py-1" onClick={() => download(downloadUrls.dataset(`CLIMATE-${stationId.toUpperCase()}`))}>
          <span className="material-symbols-outlined text-[16px]">download</span>
          Daily data 1981–{c.to.slice(0, 4)} (CSV)
        </button>
        <p className="text-[11px] sci-muted flex-1 min-w-[12rem]">
          {c.source}. {c.note}
        </p>
      </div>
    </section>
  );
}
