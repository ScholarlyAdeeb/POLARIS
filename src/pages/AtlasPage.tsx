import React, { useEffect, useMemo, useState } from 'react';
import { geoAzimuthalEqualArea, geoEqualEarth, geoGraticule10, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import land50 from 'world-atlas/land-50m.json';
import { api, type ArchiveType, type AtlasPoint } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

/**
 * Data atlas: approved records on real coastlines (Natural Earth 1:50m via world-atlas).
 * Colour = record family (3 hues, the most a scatter can separate for colour-blind readers);
 * the type filter and the list give the finer breakdown. Records sharing a place are grouped
 * into one marker with a count.
 */

const LAND = feature(land50 as any, (land50 as any).objects.land) as unknown as FeatureCollection;
const W = 900;
const H = 640;

type View = 'south' | 'north' | 'himalaya' | 'world';
const VIEWS: { id: View; label: string }[] = [
  { id: 'south', label: 'Antarctica & Southern Ocean' },
  { id: 'north', label: 'Arctic' },
  { id: 'himalaya', label: 'Himalaya' },
  { id: 'world', label: 'World' },
];

const FAMILY: Record<ArchiveType, 'field' | 'science' | 'media'> = {
  expedition: 'field',
  report: 'field',
  activity: 'field',
  dataset: 'science',
  publication: 'science',
  photo: 'media',
  video: 'media',
};
const FAMILY_STYLE = {
  field: { color: '#2a78d6', label: 'Expeditions, reports, activities' },
  science: { color: '#eb6834', label: 'Datasets & publications' },
  media: { color: '#1baf7a', label: 'Photographs & videos' },
} as const;
const TYPES: ArchiveType[] = ['expedition', 'report', 'activity', 'dataset', 'publication', 'photo', 'video'];

function projectionFor(view: View, zoom: number): GeoProjection {
  const pad = 16;
  const extent: [[number, number], [number, number]] = [
    [pad, pad],
    [W - pad, H - pad],
  ];
  if (view === 'south' || view === 'north') {
    const p = geoAzimuthalEqualArea()
      .rotate([view === 'south' ? -75 : 0, view === 'south' ? 90 : -90])
      .clipAngle(view === 'south' ? 42 : 34);
    p.fitExtent(extent, { type: 'Sphere' } as any);
    return p.scale(p.scale() * zoom);
  }
  if (view === 'himalaya') {
    const p = geoMercator().fitExtent(extent, {
      type: 'Polygon',
      coordinates: [[[68, 25], [101, 25], [101, 41], [68, 41], [68, 25]]],
    } as any);
    return p.scale(p.scale() * zoom);
  }
  const p = geoEqualEarth().fitExtent(extent, { type: 'Sphere' } as any);
  return p.scale(p.scale() * zoom);
}

interface Group {
  key: string;
  lat: number;
  lon: number;
  points: AtlasPoint[];
}

export function AtlasPage({ onOpenRecord, onOpenDataset }: { onOpenRecord: (id: string) => void; onOpenDataset: (id: string) => void }) {
  const { t } = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.atlas>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('south');
  const [zoom, setZoom] = useState(1);
  const [types, setTypes] = useState<Set<ArchiveType>>(new Set(TYPES));
  const [contributedOnly, setContributedOnly] = useState(false);
  const [hover, setHover] = useState<{ g: Group; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);

  useEffect(() => {
    api.atlas().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setZoom(1);
    setSelected(null);
  }, [view]);

  const projection = useMemo(() => projectionFor(view, zoom), [view, zoom]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const landPath = useMemo(() => path(LAND) ?? '', [path]);
  const gratPath = useMemo(() => path(geoGraticule10()) ?? '', [path]);
  const spherePath = useMemo(() => path({ type: 'Sphere' } as any) ?? '', [path]);

  const visible = useMemo(
    () => (data?.points ?? []).filter((p) => types.has(p.type) && (!contributedOnly || p.contributor)),
    [data, types, contributedOnly]
  );

  const inView = (lon: number, lat: number) => {
    if (view === 'south' && lat > -40) return null;
    if (view === 'north' && lat < 55) return null;
    const xy = projection([lon, lat]);
    if (!xy || xy[0] < 0 || xy[0] > W || xy[1] < 0 || xy[1] > H) return null;
    return xy;
  };

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const p of visible) {
      const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
      const g = m.get(key) ?? { key, lat: p.lat, lon: p.lon, points: [] };
      g.points.push(p);
      m.set(key, g);
    }
    return [...m.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const placed = groups
    .map((g) => ({ g, xy: inView(g.lon, g.lat) }))
    .filter((x): x is { g: Group; xy: [number, number] } => !!x.xy)
    .sort((a, b) => b.g.points.length - a.g.points.length);
  const shownCount = placed.reduce((n, p) => n + p.g.points.length, 0);

  const dominant = (g: Group) => {
    const c: Record<string, number> = {};
    for (const p of g.points) c[FAMILY[p.type]] = (c[FAMILY[p.type]] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof FAMILY_STYLE;
  };

  const open = (p: AtlasPoint) => (p.type === 'dataset' ? onOpenDataset(p.id) : onOpenRecord(p.id));
  const list = selected ? selected.points : placed.flatMap((x) => x.g.points).slice(0, 60);

  return (
    <Page>
      <PageHeader title={t('atlas.title')} text={t('atlas.text')} />
      <ErrorNote error={error} />

      <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="Filters">
        <div className="flex rounded-lg sci-well p-1 text-xs">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} aria-pressed={view === v.id} className={`px-2.5 py-1 rounded ${view === v.id ? 'bg-white font-semibold' : 'sci-muted'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {TYPES.map((ty) => {
            const on = types.has(ty);
            return (
              <button
                key={ty}
                aria-pressed={on}
                onClick={() => setTypes((s) => {
                  const n = new Set(s);
                  on ? n.delete(ty) : n.add(ty);
                  return n;
                })}
                className={`px-2 py-1 rounded-full border flex items-center gap-1.5 ${on ? 'bg-white sci-border' : 'border-transparent sci-muted line-through'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: FAMILY_STYLE[FAMILY[ty]].color }} />
                {t(`type.${ty}`)}
              </button>
            );
          })}
        </div>
        <label className="text-xs flex items-center gap-1.5 ml-auto">
          <input type="checkbox" checked={contributedOnly} onChange={(e) => setContributedOnly(e.target.checked)} />
          Contributor uploads only
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 sci-card p-2 relative" data-testid="atlas-map">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`${t('atlas.title')}: ${shownCount} records shown`}>
            <path d={spherePath} fill="#e8f1fa" />
            <path d={gratPath} fill="none" stroke="#c9d8e8" strokeWidth={0.6} />
            <path d={landPath} fill="#fbfdff" stroke="#9fb3c8" strokeWidth={0.7} />
            {placed.map(({ g, xy }) => {
              const n = g.points.length;
              const r = 5 + Math.min(Math.sqrt(n) * 2.2, 14);
              const color = FAMILY_STYLE[dominant(g)].color;
              const active = selected?.key === g.key;
              return (
                <g
                  key={g.key}
                  transform={`translate(${xy[0]},${xy[1]})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover({ g, x: xy[0], y: xy[1] })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected(active ? null : g)}
                  data-testid="atlas-marker"
                >
                  <circle r={r + 6} fill="transparent" />
                  <circle r={r} fill={color} fillOpacity={0.85} stroke={active ? '#0b1c30' : '#fff'} strokeWidth={active ? 3 : 2} />
                  {n > 1 && (
                    <text textAnchor="middle" dy={4} fontSize={11} fontWeight={700} fill="#fff" pointerEvents="none">
                      {n}
                    </text>
                  )}
                </g>
              );
            })}
            {data?.stations.map((s) => {
              const xy = inView(s.lon, s.lat);
              if (!xy) return null;
              return (
                <g key={s.id} transform={`translate(${xy[0]},${xy[1]})`} pointerEvents="none">
                  <path d="M0,-7 L6,4 L-6,4 Z" fill="#0b1c30" stroke="#fff" strokeWidth={1.5} />
                  <text x={11} y={-8} fontSize={12} fontWeight={600} fill="#0b1c30" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                    {s.name.replace(/ (Research )?Station$/, '')}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover && (
            <div
              className="absolute pointer-events-none sci-card px-3 py-2 text-xs max-w-[16rem]"
              style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: 'translate(12px, -50%)' }}
            >
              {hover.g.points.length === 1 ? (
                <>
                  <p className="font-semibold">{hover.g.points[0].title}</p>
                  <p className="sci-muted">
                    {t(`type.${hover.g.points[0].type}`)} · {hover.g.points[0].year ?? ''} · {hover.g.points[0].basis === 'record' ? t('atlas.basisRecord') : t('atlas.basisStation')}
                  </p>
                </>
              ) : (
                <p className="font-semibold">{hover.g.points.length} records here · click to list</p>
              )}
            </div>
          )}
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            <button className="w-8 h-8 sci-card text-lg leading-none" onClick={() => setZoom((z) => Math.min(z * 1.5, 12))} aria-label="Zoom in">
              +
            </button>
            <button className="w-8 h-8 sci-card text-lg leading-none" onClick={() => setZoom((z) => Math.max(z / 1.5, 1))} aria-label="Zoom out">
              −
            </button>
          </div>
          <div className="flex flex-wrap gap-3 px-2 py-2 text-xs">
            {Object.values(FAMILY_STYLE).map((f) => (
              <span key={f.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: f.color }} />
                {f.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="-7 -8 14 13">
                <path d="M0,-7 L6,4 L-6,4 Z" fill="#0b1c30" />
              </svg>
              Station
            </span>
            <span className="sci-muted ml-auto">
              {shownCount} records in this view{data ? ` · ${data.unmapped} records have no location yet` : ''} · Coastlines: Natural Earth
            </span>
          </div>
        </div>

        <aside className="xl:col-span-4 sci-card p-3 flex flex-col gap-2 max-h-[80vh]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">{selected ? `${selected.points.length} records at ${selected.lat.toFixed(2)}°, ${selected.lon.toFixed(2)}°` : 'Records in this view'}</h2>
            {selected && (
              <button className="text-xs underline sci-muted" onClick={() => setSelected(null)}>
                Show all
              </button>
            )}
          </div>
          <ul className="overflow-y-auto flex flex-col divide-y sci-border" data-testid="atlas-list">
            {list.map((p) => (
              <li key={p.id}>
                <button onClick={() => open(p)} className="w-full text-left py-2 px-1 hover:bg-[var(--pol-surface-2)] rounded flex gap-2 items-start">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: FAMILY_STYLE[FAMILY[p.type]].color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{p.title}</span>
                    <span className="text-[11px] sci-muted">
                      {t(`type.${p.type}`)} · {p.year ?? '—'}
                      {p.contributor ? ` · ${p.contributor}` : ''}
                    </span>
                  </span>
                  <DataStatusBadge status={p.dataStatus} />
                </button>
              </li>
            ))}
            {!list.length && <li className="text-sm sci-muted py-3">No records match these filters here.</li>}
          </ul>
        </aside>
      </div>
    </Page>
  );
}

export default AtlasPage;
