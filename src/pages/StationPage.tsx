import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadUrls, download, type ArchiveItem, type Hotspot } from '../lib/api';
import { usePolarisData } from '../context/PolarisDataContext';
import { DataStatusBadge, ErrorNote, Page } from '../components/ui';
import { WeatherCard } from '../components/WeatherCard';
import { ClimateCard } from '../components/ClimateCard';

const StationScene = lazy(() => import('../components/StationScene'));

type StationDetail = Awaited<ReturnType<typeof api.station>>;

export function StationsIndex() {
  const { stations } = usePolarisData();
  return (
    <Page>
      <h1 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold mb-6">Stations and platforms</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((s) => (
          <Link key={s.id} to={`/stations/${s.id}`} className="sci-card p-4 hover:border-[var(--pol-accent-2)] transition-colors">
            <span className="text-xs font-semibold sci-accent">{s.domain}</span>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold">{s.name}</h2>
            <p className="text-sm sci-muted">{s.locationName}</p>
            <p className="text-xs sci-mono sci-ink-2 mt-2">{s.coordinates}</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}

export function StationPage({ onOpenDataset, onOpenRecord }: { onOpenDataset: (ref: string) => void; onOpenRecord: (id: string) => void }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { stations } = usePolarisData();
  const [station, setStation] = useState<StationDetail | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [records, setRecords] = useState<ArchiveItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setStation(null);
    setSelected(null);
    setError(null);
    Promise.all([api.station(id), api.hotspots(id), api.archive({ station: id, limit: 50 })])
      .then(([s, h, r]) => {
        if (!live) return;
        setStation(s);
        setHotspots(h.hotspots);
        setRecords(r.items);
        setSelected(h.hotspots[0]?.key ?? null);
      })
      .catch((e) => live && setError(e.message || 'Could not load this station'));
    return () => {
      live = false;
    };
  }, [id]);

  const active = useMemo(() => hotspots.find((h) => h.key === selected) ?? null, [hotspots, selected]);

  const openItem = (h: Hotspot) => {
    if (!h.itemId) return;
    if (h.itemType === 'dataset') onOpenDataset(h.itemId);
    else onOpenRecord(h.itemId);
  };

  if (error)
    return (
      <Page>
        <p className="sci-muted">Station “{id}” could not be loaded.</p>
        <ErrorNote error={error} />
        <Link to="/stations" className="sci-btn-ghost mt-4">
          All stations
        </Link>
      </Page>
    );
  if (!station)
    return (
      <Page>
        <p className="sci-muted">Loading station…</p>
      </Page>
    );

  // Fixed stations get live model weather; the ship has no fixed position, so it keeps the labelled sample readings.
  const live = !station.id.includes('sagar');
  const readings: [string, string, string][] = [
    ['Surface temperature', station.temp, station.windChill ? `Wind chill ${station.windChill}` : ''],
    ['Wind', station.windSpeed, station.windDir],
    ['Pressure', station.pressure, ''],
    ['Solar flux', station.solarFlux, ''],
  ].filter(([, v]) => v) as [string, string, string][];

  return (
    <Page>
      {/* Header */}
      <nav className="text-xs sci-muted mb-2 flex gap-1.5">
        <Link to="/" className="hover:underline">Home</Link>/<Link to="/stations" className="hover:underline">Stations</Link>/<span className="sci-ink-2">{station.name}</span>
      </nav>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold tracking-tight">{station.name}</h1>
            <DataStatusBadge status={station.dataStatus} />
          </div>
          <p className="text-sm sci-ink-2 mt-1">{station.locationName}</p>
          <p className="text-xs sci-mono sci-muted mt-1">
            {station.coordinates} · {station.elevation} · {station.commissionYear}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0">
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/stations/${s.id}`)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm border ${
                s.id === id ? 'bg-[var(--pol-accent)] text-white border-transparent' : 'sci-border sci-ink-2'
              }`}
            >
              {s.name.replace(/ (Research )?(Station|Observatory|Base)$/, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* 3D scene */}
        <div className="xl:col-span-8">
          <div className="relative h-[380px] sm:h-[480px] lg:h-[560px] rounded-2xl overflow-hidden border sci-border bg-[#dbe9f6]">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-slate-400">Loading 3D view…</div>}>
              <StationScene stationId={station.id} stationStatus={station.status} hotspots={hotspots} selected={selected} onSelect={setSelected} />
            </Suspense>
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 text-white text-[11px] font-semibold">
              CONCEPTUAL MODEL · not to scale, not a survey model
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[11px] text-white/90">
              <span className="px-2 py-0.5 rounded bg-black/55">Drag to orbit · scroll to zoom · tap a marker</span>
              <span className="px-2 py-0.5 rounded bg-black/55">Marker colour = data status</span>
            </div>
          </div>
          <p className="text-xs sci-muted mt-2">
            {hotspots.length} hotspots from the database: curated instrument entries plus every dataset, report and publication recorded at this station.
          </p>
        </div>

        {/* Hotspot detail */}
        <aside className="xl:col-span-4 flex flex-col gap-4">
          <div className="sci-card p-4">
            <h2 className="text-sm font-semibold mb-2">Hotspots</h2>
            {hotspots.length === 0 && <p className="text-sm sci-muted">No records are linked to this station yet.</p>}
            <ol className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
              {hotspots.map((h, i) => (
                <li key={h.key}>
                  <button
                    onClick={() => setSelected(h.key)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 ${selected === h.key ? 'sci-well font-semibold' : 'hover:bg-[var(--pol-surface-2)]'}`}
                  >
                    <span className="sci-mono text-xs sci-muted w-5">{i + 1}.</span>
                    <span className="truncate flex-1">{h.title}</span>
                    <DataStatusBadge status={h.dataStatus} />
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {active && (
            <div className="sci-card p-4 flex flex-col gap-3" data-testid="hotspot-panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs sci-muted sci-mono">{active.label}</span>
                  <h3 className="font-['Space_Grotesk'] text-lg font-bold leading-snug">{active.title}</h3>
                </div>
                <DataStatusBadge status={active.dataStatus} />
              </div>

              {active.info && (
                <>
                  <p className="text-sm sci-ink-2">{active.info.what}</p>
                  <div className="sci-well p-3">
                    <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--pol-warn)' }}>
                      SYNTHETIC SAMPLE EXTRACT · illustrative values, not live telemetry
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {([1, 2, 3, 4] as const).map((n) => (
                        <div key={n}>
                          <p className="text-[11px] sci-muted">{(active.info as any)[`m${n}_label`]}</p>
                          <p className="sci-mono text-base font-semibold">{(active.info as any)[`m${n}_val`]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {!active.info && active.summary && <p className="text-sm sci-ink-2">{active.summary}</p>}

              <div className="flex flex-col gap-2">
                {active.itemId && (
                  <button className="sci-btn" onClick={() => openItem(active)}>
                    <span className="material-symbols-outlined text-[18px]">{active.itemType === 'dataset' ? 'dataset' : 'description'}</span>
                    Open {active.itemType ?? 'record'}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="sci-btn-ghost"
                    onClick={() => navigate(`/ai?q=${encodeURIComponent(`What does the archive say about ${active.title}?`)}&station=${station.id}`)}
                  >
                    Ask assistant
                  </button>
                  <button
                    className="sci-btn-ghost"
                    disabled={!active.itemId}
                    onClick={() => active.itemId && navigate(`/content/review?item=${encodeURIComponent(active.itemId)}`)}
                  >
                    Draft outreach
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Live model weather at fixed stations (a ship has no fixed position) */}
      {live && (
        <div className="mt-6">
          <WeatherCard stationId={station.id} />
        </div>
      )}
      {live && (
        <div className="mt-6">
          <ClimateCard stationId={station.id} />
        </div>
      )}

      {/* Station readings + records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        {!live && (
        <section className="sci-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Station conditions</h2>
            <DataStatusBadge status={station.readingsStatus} />
          </div>
          <p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--pol-warn)' }}>
            SYNTHETIC SAMPLE EXTRACT · not connected to station instruments
          </p>
          <dl className="grid grid-cols-2 gap-3">
            {readings.map(([k, v, sub]) => (
              <div key={k} className="sci-well p-2.5">
                <dt className="text-[11px] sci-muted">{k}</dt>
                <dd className="sci-mono font-semibold">{v}</dd>
                {sub && <dd className="text-[11px] sci-muted">{sub}</dd>}
              </div>
            ))}
          </dl>
          <button className="sci-btn-ghost w-full mt-3" onClick={() => download(downloadUrls.synoptic(station.id))}>
            Download 72 h sample CSV
          </button>
        </section>
        )}

        <section className={`sci-card p-4 ${live ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <h2 className="text-sm font-semibold mb-3">Records at this station ({records.length})</h2>
          <ul className="divide-y sci-border">
            {records.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => (r.type === 'dataset' ? onOpenDataset(r.id) : onOpenRecord(r.id))}
                  className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-[var(--pol-surface-2)] px-1 rounded"
                >
                  <span className="text-xs sci-muted capitalize w-20 shrink-0">{r.type}</span>
                  <span className="text-sm flex-1 min-w-0 truncate">{r.title}</span>
                  <span className="text-xs sci-mono sci-muted">{r.year ?? ''}</span>
                  <DataStatusBadge status={r.dataStatus} />
                </button>
              </li>
            ))}
          </ul>
          <Link to={`/knowledge-graph?station=${station.id}`} className="inline-flex mt-3 text-sm font-semibold sci-accent hover:underline">
            See how these records connect →
          </Link>
        </section>
      </div>
    </Page>
  );
}
