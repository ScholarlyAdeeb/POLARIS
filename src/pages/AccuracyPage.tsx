import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorNote, Page, PageHeader } from '../components/ui';

interface Row {
  question: { id: string; category: string; question: string; records?: string[]; facts?: string[][]; offTopic?: boolean };
  answer: string;
  mode: string;
  sources: { ref: string; id: string; title: string; pages: number[] }[];
  verification: { supported: number; partial: number; unsupported: number } | null;
  ms: number | null;
  error: string | null;
  score: { retrieved: boolean; cited: boolean; facts: boolean; declined: boolean; pass: boolean; citedIds: string[]; missingFacts: string[] };
}
interface Results {
  ranAt: string;
  base: string;
  model: string | null;
  embedModel: string | null;
  summary: {
    total: number;
    passed: number;
    factual: { total: number; retrieved: number; cited: number; facts: number; passed: number };
    offTopic: { total: number; declined: number };
  };
  rows: Row[];
}

const Mark = ({ ok }: { ok: boolean }) => (
  <span className={`material-symbols-outlined text-[18px] ${ok ? 'text-[#2e7d32]' : 'text-[#c62828]'}`} aria-label={ok ? 'yes' : 'no'}>
    {ok ? 'check_circle' : 'cancel'}
  </span>
);

function Stat({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <div className="sci-card p-4">
      <div className="text-2xl font-bold">
        {value}
        <span className="text-base sci-muted"> / {total}</span>
      </div>
      <div className="text-xs sci-muted mt-1">{label}</div>
    </div>
  );
}

export function AccuracyPage() {
  const [data, setData] = useState<{ questions: { about: string; checkedOn: string } | null; results: Results | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/accuracy')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const r = data?.results;
  return (
    <Page>
      <PageHeader
        title="How accurate is Ask POLARIS?"
        text="We ask Ask POLARIS a fixed set of questions whose answers we checked by hand against the records, and publish every answer it gave, right or wrong."
      />
      <ErrorNote error={error} />
      {data && !r && <p className="sci-muted text-sm">No evaluation has been run on this server yet.</p>}
      {r && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="accuracy-summary">
            <Stat value={r.summary.passed} total={r.summary.total} label="Questions passed overall" />
            <Stat value={r.summary.factual.cited} total={r.summary.factual.total} label="Cited the right record" />
            <Stat value={r.summary.factual.facts} total={r.summary.factual.total} label="Stated the checked fact" />
            <Stat value={r.summary.offTopic.declined} total={r.summary.offTopic.total} label="Off-topic questions declined" />
          </div>
          <p className="text-xs sci-muted">
            Run on {new Date(r.ranAt).toLocaleString()} against {r.base} · answer model {r.model ?? 'none (quoted sentences)'} · retrieval {r.embedModel ?? 'n/a'}.{' '}
            {data?.questions?.about} Questions checked on {data?.questions?.checkedOn}. Re-run with <code className="sci-mono">npm run eval</code>.
          </p>
          <section className="sci-card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-left text-xs sci-muted">
                <tr>
                  <th className="p-3">Question</th>
                  <th className="p-3">Found</th>
                  <th className="p-3">Cited</th>
                  <th className="p-3">Fact</th>
                  <th className="p-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <Fragment key={row.question.id}>
                    <tr className="border-t sci-border cursor-pointer hover:bg-[var(--pol-surface-2)]" onClick={() => setOpen(open === row.question.id ? null : row.question.id)}>
                      <td className="p-3">
                        <div className="text-xs sci-muted">{row.question.category}</div>
                        {row.question.question}
                      </td>
                      {row.question.offTopic ? (
                        <td className="p-3 text-xs sci-muted" colSpan={3}>
                          Should decline · {row.score.declined ? 'declined' : 'answered anyway'}
                        </td>
                      ) : (
                        <>
                          <td className="p-3"><Mark ok={row.score.retrieved} /></td>
                          <td className="p-3"><Mark ok={row.score.cited} /></td>
                          <td className="p-3"><Mark ok={row.score.facts} /></td>
                        </>
                      )}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.score.pass ? 'bg-[#e8f5e9] text-[#1b5e20]' : 'bg-[#ffebee] text-[#b71c1c]'}`}>{row.score.pass ? 'Pass' : 'Fail'}</span>
                      </td>
                    </tr>
                    {open === row.question.id && (
                      <tr className="bg-[var(--pol-surface)]">
                        <td className="p-3 text-xs flex flex-col gap-2" colSpan={5}>
                          <div>
                            <b>Answer:</b> <span className="whitespace-pre-line">{row.error ? `Error: ${row.error}` : row.answer}</span>
                          </div>
                          {!row.question.offTopic && (
                            <div>
                              <b>Expected:</b> record {row.question.records?.map((id) => (
                                <a key={id} className="underline sci-mono mr-1" href={`/?record=${encodeURIComponent(id)}`}>{id}</a>
                              ))}
                              and the fact{(row.question.facts?.length ?? 0) > 1 ? 's' : ''} {row.question.facts?.map((g) => `“${g[0]}”`).join(', ')}
                              {row.score.missingFacts.length > 0 && <span className="text-[#b71c1c]"> · missing: {row.score.missingFacts.join(', ')}</span>}
                            </div>
                          )}
                          {row.sources.length > 0 && (
                            <div>
                              <b>Sources:</b> {row.sources.map((s) => `${s.ref} ${s.title}${s.pages?.length ? ` (p. ${s.pages.join(', ')})` : ''}`).join(' · ')}
                            </div>
                          )}
                          {row.verification && (
                            <div>
                              <b>Claim check:</b> {row.verification.supported} supported, {row.verification.partial} partly supported, {row.verification.unsupported} unsupported
                              {row.ms != null && <> · {(row.ms / 1000).toFixed(1)} s</>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-xs sci-muted">
            Try it yourself on <Link className="underline" to="/ask">Ask POLARIS</Link>.
          </p>
        </div>
      )}
    </Page>
  );
}
