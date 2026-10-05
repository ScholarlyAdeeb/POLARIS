import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type ClaimCheck, type Facets, type RagAnswer, type RagSource, type RagStatus } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

const EXAMPLES = [
  'What atmospheric studies were conducted at Maitri?',
  'Which datasets cover Himalayan glaciers?',
  'What did researchers share from the winter-over at Bharati?',
  'Which publications use data from the Southern Ocean expeditions?',
];

const TYPE_ICON: Record<string, string> = {
  expedition: 'sailing',
  report: 'description',
  dataset: 'dataset',
  publication: 'menu_book',
  photo: 'photo_camera',
  video: 'movie',
  activity: 'groups',
};

const CLAIM_STYLE: Record<ClaimCheck['status'], { label: string; cls: string; icon: string }> = {
  supported: { label: 'Supported by the cited records', cls: 'text-emerald-700', icon: 'check_circle' },
  partial: { label: 'Partly supported', cls: 'text-amber-700', icon: 'error' },
  unsupported: { label: 'Not found in the cited records', cls: 'text-rose-700', icon: 'cancel' },
  no_claim: { label: 'Not a factual claim', cls: 'sci-muted', icon: 'remove' },
};

/** Answer text with [S1] markers turned into buttons that jump to the source card. */
function AnswerText({ text, onCite }: { text: string; onCite: (ref: string) => void }) {
  const parts = text.split(/(\[S\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[(S\d+)\]$/.exec(p);
        if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
        return (
          <button
            key={i}
            onClick={() => onCite(m[1])}
            className="inline-flex items-center px-1.5 mx-0.5 rounded-md bg-[#e5eeff] text-[#00677d] text-[11px] font-semibold align-baseline hover:bg-[#d3e4fe]"
            aria-label={`Source ${m[1]}`}
          >
            {m[1]}
          </button>
        );
      })}
    </>
  );
}

function SourceCard({ s, active, onOpenRecord }: { s: RagSource; active: boolean; onOpenRecord: (id: string) => void }) {
  return (
    <li id={`src-${s.ref}`} className={`sci-card p-4 flex flex-col gap-2 transition-shadow ${active ? 'ring-2 ring-[#00b4d8]' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-[#e5eeff] text-[#00677d] text-xs font-bold flex items-center justify-center">{s.ref}</span>
        <div className="min-w-0 flex-1">
          <button className="text-left font-semibold leading-snug hover:underline" onClick={() => onOpenRecord(s.id)}>
            {s.title}
          </button>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs sci-muted">
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">{TYPE_ICON[s.type] ?? 'article'}</span>
              {s.type}
            </span>
            {s.year && <span>{s.year}</span>}
            {s.stationId && <span className="capitalize">{s.stationId.replace(/-/g, ' ')}</span>}
            <DataStatusBadge status={s.dataStatus} />
          </div>
        </div>
      </div>
      {s.contributor && (
        <p className="text-xs">
          <span className="sci-muted">Shared by </span>
          {s.contributor.id ? (
            <Link to={`/contributors/${s.contributor.id}`} className="font-semibold text-[#00677d] hover:underline">
              {s.contributor.name}
            </Link>
          ) : (
            <span className="font-semibold">{s.contributor.name}</span>
          )}
          {s.contributor.institution && <span className="sci-muted">, {s.contributor.institution}</span>}
        </p>
      )}
      <p className="text-sm sci-muted line-clamp-4 whitespace-pre-line">{s.excerpt}</p>
    </li>
  );
}

export function AskPage({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [domain, setDomain] = useState('');
  const [station, setStation] = useState('');
  const [facets, setFacets] = useState<Facets | null>(null);
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [asked, setAsked] = useState('');
  const [streamed, setStreamed] = useState('');
  const [sources, setSources] = useState<RagSource[]>([]);
  const [result, setResult] = useState<RagAnswer | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    api.facets().then(setFacets).catch(() => undefined);
    api.rag.status().then(setStatus).catch(() => undefined);
    const q = params.get('q');
    if (q) run(q);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(q = question) {
    const text = q.trim();
    if (!text || busy) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setParams({ q: text }, { replace: true });
    setAsked(text);
    setStreamed('');
    setSources([]);
    setResult(null);
    setNote(null);
    setError(null);
    setShowCheck(false);
    setBusy(true);
    try {
      const r = await api.rag.ask(
        text,
        { domain: domain || undefined, station: station || undefined },
        {
          onSources: setSources,
          onToken: (tok) => setStreamed((s) => s + tok),
          onReset: (n) => {
            setStreamed('');
            setNote(n);
          },
        },
        ctrl.signal
      );
      setResult(r);
      setNote(r.note);
      api.rag.status().then(setStatus).catch(() => undefined);
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const cite = (ref: string) => {
    setActiveRef(ref);
    document.getElementById(`src-${ref}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const answer = result?.answer ?? streamed;
  const v = result?.verification;

  return (
    <Page>
      <PageHeader title={t('ask.title')} text={t('ask.subtitle')} />

      <form
        className="sci-card p-4 md:p-5 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label htmlFor="ask-q" className="sr-only">
          {t('ask.placeholder')}
        </label>
        <textarea
          id="ask-q"
          rows={2}
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              run();
            }
          }}
          placeholder={t('ask.placeholder')}
          className="sci-input w-full resize-none text-base"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select className="sci-input sm:w-48" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Region">
            <option value="">All regions</option>
            {facets?.domains.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select className="sci-input sm:w-56" value={station} onChange={(e) => setStation(e.target.value)} aria-label="Station">
            <option value="">All stations</option>
            {facets?.stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          {busy ? (
            <button type="button" className="sci-btn-ghost" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : null}
          <button type="submit" className="sci-btn inline-flex items-center justify-center gap-1" disabled={busy || !question.trim()}>
            <span className="material-symbols-outlined text-[18px]">{busy ? 'progress_activity' : 'send'}</span>
            {t('ask.button')}
          </button>
        </div>
        {status && (
          <p className="text-xs sci-muted">
            {status.index.ready ? (
              <>
                {status.index.records} of {status.index.approved} approved records indexed
                {status.index.contributorRecords > 0 && <> · {status.index.contributorRecords} shared by researchers</>}
                {status.index.fileChunks > 0 && <> · includes text from uploaded files</>}
                {status.llm && (
                  <>
                    {' '}
                    · open model <span className="sci-mono">{status.llm}</span> {status.backend === 'local' ? 'running on this server' : 'via Hugging Face'}
                  </>
                )}
              </>
            ) : (
              status.index.problem
            )}
          </p>
        )}
      </form>

      {!asked && (
        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              className="text-sm px-3 py-2 rounded-full border sci-border bg-white hover:bg-[#eff4ff] text-left"
              onClick={() => {
                setQuestion(q);
                run(q);
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <ErrorNote error={error} />

      {asked && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
          <section className="sci-card p-5 flex flex-col gap-3" aria-live="polite" aria-busy={busy}>
            <h2 className="font-semibold">{asked}</h2>
            {note && <p className="text-xs rounded-lg bg-amber-50 text-amber-800 p-2">{note}</p>}
            {!answer && busy && (
              <p className="text-sm sci-muted inline-flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                {sources.length ? `Reading ${sources.length} records…` : 'Searching the archive…'}
              </p>
            )}
            {answer && (
              <p className="leading-relaxed whitespace-pre-line">
                <AnswerText text={answer} onCite={cite} />
                {busy && <span className="inline-block w-2 h-4 align-middle bg-[#00677d] animate-pulse ml-0.5" />}
              </p>
            )}

            {v && v.checked > 0 && (
              <div className="border-t sci-border pt-3 flex flex-col gap-2">
                <button className="text-sm text-left inline-flex items-center gap-2" onClick={() => setShowCheck((x) => !x)} aria-expanded={showCheck}>
                  <span className={`material-symbols-outlined text-[18px] ${v.unsupported ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {v.unsupported ? 'rule' : 'verified'}
                  </span>
                  <span>
                    Fact check: <b>{v.supported}</b> of {v.checked} sentences supported by the cited records
                    {v.unsupported > 0 && <>, {v.unsupported} not found in them</>}
                  </span>
                  <span className="material-symbols-outlined text-[18px] sci-muted">{showCheck ? 'expand_less' : 'expand_more'}</span>
                </button>
                {showCheck && (
                  <ul className="flex flex-col gap-1.5">
                    {v.claims
                      .filter((c) => c.status !== 'no_claim')
                      .map((c, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className={`material-symbols-outlined text-[16px] mt-0.5 ${CLAIM_STYLE[c.status].cls}`} title={CLAIM_STYLE[c.status].label}>
                            {CLAIM_STYLE[c.status].icon}
                          </span>
                          <span>
                            {c.sentence.replace(/\s*\[S\d+\]/g, '')}
                            <span className={`block text-xs ${CLAIM_STYLE[c.status].cls}`}>
                              {CLAIM_STYLE[c.status].label}
                              {c.missingNumbers.length > 0 && ` (numbers not in the records: ${c.missingNumbers.join(', ')})`}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
                {v.nonAuthoritativeSources.length > 0 && (
                  <p className="text-xs sci-muted">
                    {v.nonAuthoritativeSources.join(', ')} {v.nonAuthoritativeSources.length === 1 ? 'is' : 'are'} not an official or verified record; check
                    the original before citing.
                  </p>
                )}
              </div>
            )}

            {result && (
              <p className="text-[11px] sci-muted sci-mono">
                {result.mode === 'generative' && result.model ? `${result.model} · ` : result.mode === 'extractive' ? 'extractive answer · ' : ''}
                {result.cached ? (
                  'answered earlier · from cache'
                ) : (
                  <>
                    retrieval {result.timings.retrievalMs} ms
                    {result.mode === 'generative' && ` · generation ${(result.timings.generationMs / 1000).toFixed(1)} s`}
                  </>
                )}
              </p>
            )}
          </section>

          <section>
            <h2 className="font-semibold mb-3">{t('ask.sources')}</h2>
            {sources.length ? (
              <ol className="flex flex-col gap-3">
                {sources.map((s) => (
                  <SourceCard key={s.ref} s={s} active={activeRef === s.ref} onOpenRecord={onOpenRecord} />
                ))}
              </ol>
            ) : (
              !busy && <p className="text-sm sci-muted">No matching records.</p>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
