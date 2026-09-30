import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Facets, type SearchResponse } from '../lib/api';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

const FILTER_KEYS = ['domain', 'station', 'yearFrom', 'yearTo', 'theme', 'type', 'status'] as const;

function Snippet({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]*\])/g).map((p, i) =>
        p.startsWith('[') && p.endsWith(']') ? (
          <mark key={i} className="bg-[#00b4d8]/25 text-inherit rounded px-0.5">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}

export function ExplorePage({ onOpenDataset, onOpenRecord }: { onOpenDataset: (ref: string) => void; onOpenRecord: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const [facets, setFacets] = useState<Facets | null>(null);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.facets().then(setFacets).catch(() => setFacets(null));
  }, []);

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>;
  const query = params.get('q') ?? '';

  useEffect(() => {
    let live = true;
    setError(null);
    if (!query) {
      // No query: browse the archive with the same filters (newest first).
      setBusy(true);
      api
        .archive({ ...filters, limit: 40 })
        .then((r) => live && setRes({ query: '', matchedAllTerms: true, total: r.total, results: r.items.map((i) => ({ ...i, snippet: i.summary })), stations: [] }))
        .catch((e) => live && setError(e.message))
        .finally(() => live && setBusy(false));
      return () => {
        live = false;
      };
    }
    setBusy(true);
    api
      .search(query, 30, filters)
      .then((r) => live && setRes(r))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const select = (k: (typeof FILTER_KEYS)[number], label: string, options: { value: string; label: string }[]) => (
    <label className="flex flex-col gap-1 text-xs sci-muted min-w-0">
      {label}
      <select value={filters[k]} onChange={(e) => setParam(k, e.target.value)} className="sci-input text-sm">
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const years = facets?.years.min && facets.years.max ? Array.from({ length: facets.years.max - facets.years.min + 1 }, (_, i) => String(facets.years.min! + i)) : [];
  const active = FILTER_KEYS.filter((k) => filters[k]).length;
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Page>
      <PageHeader
        title="Explore the archive"
        text="Full-text search over every approved record, ranked by relevance. Filter by region, station, year, theme, type and data status."
      />

      <form
        className="sci-card p-3 flex items-center gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setParam('q', q.trim());
        }}
      >
        <span className="material-symbols-outlined sci-muted">search</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “ozone Maitri 2023”, “glacier mass balance”, “lidar”"
          aria-label="Search the archive"
          className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-sm"
        />
        <button className="sci-btn shrink-0" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      <button
        type="button"
        className="md:hidden sci-btn-ghost w-full mb-3 justify-between"
        aria-expanded={showFilters}
        onClick={() => setShowFilters(!showFilters)}
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Filters{active ? ` (${active})` : ''}
        </span>
        <span className="material-symbols-outlined text-[18px]">{showFilters ? 'expand_less' : 'expand_more'}</span>
      </button>
      <div className={`sci-card p-3 mb-5 grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 ${showFilters ? 'grid' : 'hidden md:grid'}`}>
        {select('domain', 'Region', (facets?.domains ?? []).map((d) => ({ value: d, label: d.charAt(0) + d.slice(1).toLowerCase() })))}
        {select('station', 'Station', (facets?.stations ?? []).map((s) => ({ value: s.id, label: s.name })))}
        {select('yearFrom', 'From year', years.map((y) => ({ value: y, label: y })))}
        {select('yearTo', 'To year', years.map((y) => ({ value: y, label: y })))}
        {select('theme', 'Science theme', (facets?.themes ?? []).map((t) => ({ value: t, label: t })))}
        {select('type', 'Media / record type', (facets?.types ?? []).map((t) => ({ value: t, label: t })))}
        {select('status', 'Data status', (facets?.dataStatuses ?? []).map((t) => ({ value: t, label: t.replace('_', ' ').toLowerCase() })))}
      </div>

      <ErrorNote error={error} />

      {res && (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <span className="font-semibold">
            {res.total} {res.total === 1 ? 'record' : 'records'}
            {query ? ` for “${query}”` : ''}
          </span>
          {active > 0 && (
            <button
              className="text-xs sci-accent hover:underline"
              onClick={() => {
                const next = new URLSearchParams();
                if (query) next.set('q', query);
                setParams(next, { replace: true });
              }}
            >
              Clear {active} filter{active > 1 ? 's' : ''}
            </button>
          )}
          {query && !res.matchedAllTerms && res.total > 0 && <span className="text-xs sci-muted basis-full">No record matched every term; showing the closest matches.</span>}
        </div>
      )}

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {res?.results.map((r) => (
          <li key={r.id}>
            <button onClick={() => (r.type === 'dataset' ? onOpenDataset(r.id) : onOpenRecord(r.id))} className="sci-card p-4 w-full text-left hover:border-[var(--pol-accent-2)] transition-colors">
              <div className="flex items-center gap-2 text-xs sci-muted mb-1">
                <span className="capitalize">{r.type}</span>
                {r.year && <span className="sci-mono">· {r.year}</span>}
                {r.stationId && <span>· {r.stationId}</span>}
                <span className="ml-auto">
                  <DataStatusBadge status={r.dataStatus} />
                </span>
              </div>
              <h2 className="font-semibold leading-snug">{r.title}</h2>
              <p className="text-sm sci-ink-2 mt-1 line-clamp-2">
                <Snippet text={r.snippet || r.summary} />
              </p>
            </button>
          </li>
        ))}
      </ul>
      {res && res.total === 0 && <p className="sci-muted text-sm mt-4">No records found. Try fewer words, or clear the filters.</p>}
    </Page>
  );
}
