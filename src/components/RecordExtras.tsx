import React, { useState } from 'react';
import { api, type ArchiveItem, type AuditEntry, type HindiText, type LinkedRecord, type Trace } from '../lib/api';

const RELATION_LABEL: Record<string, string> = {
  documents: 'documents',
  collected_during: 'collected during',
  uses_data: 'uses data from',
  describes: 'describes',
  part_of: 'part of',
  related_to: 'related to',
};

const ACTION_LABEL: Record<string, string> = {
  submit: 'Submitted for review',
  resubmit: 'Edited and resubmitted',
  withdraw: 'Withdrawn by the contributor',
  create: 'Added to the archive',
  edit: 'Edited',
  access_change: 'File access changed',
  approve: 'Approved',
  request_changes: 'Changes requested',
  reject: 'Rejected',
  delete: 'Removed',
  draft: 'Outreach draft written',
  publish: 'Published',
  issue: 'Certificate issued',
};

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Why a record's file is not downloadable, and how to get it. */
export function AccessNotice({ item }: { item: ArchiveItem }) {
  const a = item.access;
  if (!a || !a.held) return null;
  const embargo = a.level === 'embargoed';
  return (
    <div className="p-3 rounded-xl border text-xs flex gap-2 items-start bg-rose-50 border-rose-200 text-rose-900" data-testid="access-notice">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{embargo ? 'schedule' : 'lock'}</span>
      <div>
        <p className="font-semibold">{embargo ? `File under embargo until ${a.until}` : 'Restricted file'}</p>
        <p>
          {embargo
            ? 'The catalogue entry is public now; the file opens automatically on that date.'
            : `The catalogue entry is public; the file is shared on request. Write to NCPOR Data Management quoting ${item.id}.`}
          {a.reason ? ` Reason: ${a.reason}.` : ''}
        </p>
      </div>
    </div>
  );
}

/** Hindi title and summary, with an honest label for machine translation. */
export function HindiSummary({ hi }: { hi?: HindiText }) {
  const [open, setOpen] = useState(false);
  if (!hi?.summary) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-3" lang="hi">
      <button type="button" className="text-xs font-semibold text-[#00677d] flex items-center gap-1" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">translate</span>
        हिन्दी में पढ़ें
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {hi.title && <p className="text-sm font-semibold text-slate-800">{hi.title}</p>}
          <p className="text-sm text-slate-700 leading-relaxed">{hi.summary}</p>
          <p className="text-[11px] text-slate-500" lang="en">
            {hi.reviewed ? 'Checked by a reviewer.' : `Machine translation (${(hi.by ?? 'open model').split('/').pop()}), not yet checked by a person.`}
          </p>
        </div>
      )}
    </div>
  );
}

/** Linked records, each with a "why?" that explains the connection from the database. */
export function LinkedRecords({ item, links, onOpenRecord }: { item: ArchiveItem; links: LinkedRecord[]; onOpenRecord: (id: string) => void }) {
  const [why, setWhy] = useState<Record<string, string[] | 'loading' | 'error'>>({});
  if (!links.length) return null;
  const explain = async (l: LinkedRecord) => {
    const key = `${l.id}-${l.relation}`;
    if (why[key]) return setWhy(({ [key]: _, ...rest }) => rest);
    setWhy((w) => ({ ...w, [key]: 'loading' }));
    try {
      const r = await api.explainLink(item.id, l.id);
      setWhy((w) => ({ ...w, [key]: r.reasons }));
    } catch {
      setWhy((w) => ({ ...w, [key]: 'error' }));
    }
  };
  return (
    <div>
      <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Linked records</h4>
      <ul className="flex flex-col gap-2">
        {links.map((l) => {
          const key = `${l.id}-${l.relation}`;
          const w = why[key];
          return (
            <li key={key} className="rounded-lg bg-[#eff4ff] px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onOpenRecord(l.id)} className="font-['JetBrains_Mono'] text-[11px] text-[#00677d] hover:underline text-left">
                  <span className="text-slate-500">{l.direction === 'out' ? `${RELATION_LABEL[l.relation] ?? l.relation} → ` : `← ${RELATION_LABEL[l.relation] ?? l.relation} · `}</span>
                  {l.type}: {l.title}
                </button>
                <button onClick={() => explain(l)} className="text-[11px] underline text-[#00677d] shrink-0" aria-expanded={!!w}>
                  Why connected?
                </button>
              </div>
              {w === 'loading' && <p className="text-[11px] text-slate-500 mt-1">Checking…</p>}
              {w === 'error' && <p className="text-[11px] text-amber-700 mt-1">Could not explain this link.</p>}
              {Array.isArray(w) && (
                <ul className="list-disc pl-5 mt-1 text-[11px] text-slate-700 space-y-0.5">
                  {w.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Walks the record back to its evidence: data, expedition, station and instruments. */
export function TracePanel({ recordId, onOpenRecord }: { recordId: string; onOpenRecord: (id: string) => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const load = async () => {
    if (trace) return setTrace(null);
    setState('loading');
    try {
      setTrace(await api.trace(recordId));
      setState('idle');
    } catch {
      setState('error');
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 p-3" data-testid="trace-panel">
      <button type="button" onClick={load} className="text-xs font-semibold text-[#00677d] flex items-center gap-1" aria-expanded={!!trace}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">account_tree</span>
        Trace this finding to its source
      </button>
      {state === 'loading' && <p className="text-xs text-slate-500 mt-2">Following the links…</p>}
      {state === 'error' && <p className="text-xs text-amber-700 mt-2">The trace could not be loaded.</p>}
      {trace && (
        <ol className="mt-3 space-y-2 text-xs">
          <li className="font-semibold text-slate-800">{trace.root.title}</li>
          {trace.steps.map((s) => (
            <li key={`${s.from.id}>${s.to.id}`} className="border-l-2 border-[#00b4d8] pl-3" style={{ marginLeft: (s.depth - 1) * 12 }}>
              <span className="text-slate-500">{RELATION_LABEL[s.relation] ?? s.relation} → </span>
              <button className="underline text-[#00677d] text-left" onClick={() => onOpenRecord(s.to.id)}>
                {s.to.type}: {s.to.title}
                {s.to.year ? ` (${s.to.year})` : ''}
              </button>
              <ul className="list-disc pl-5 mt-0.5 text-[11px] text-slate-600">
                {s.reasons.slice(1).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </li>
          ))}
          {trace.stations.map((st) => (
            <li key={st.id} className="border-l-2 border-emerald-500 pl-3">
              <span className="text-slate-500">recorded at → </span>
              <b>{st.name}</b>
              {st.coordinates ? ` · ${st.coordinates}` : ''}
              {st.instruments.length > 0 && (
                <p className="text-[11px] text-slate-600 mt-0.5">Instruments there: {st.instruments.map((i) => i.title).join('; ')}</p>
              )}
            </li>
          ))}
          {!trace.steps.length && !trace.stations.length && <li className="text-slate-500">This record has no upstream links yet.</li>}
        </ol>
      )}
    </section>
  );
}

/** Every decision on this record and its published posts: who, what, when. */
export function HistoryPanel({ recordId }: { recordId: string }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const load = async () => {
    if (rows) return setRows(null);
    setState('loading');
    try {
      setRows(await api.history(recordId));
      setState('idle');
    } catch {
      setState('error');
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 p-3" data-testid="history-panel">
      <button type="button" onClick={load} className="text-xs font-semibold text-[#00677d] flex items-center gap-1" aria-expanded={!!rows}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">history</span>
        Review history
      </button>
      {state === 'loading' && <p className="text-xs text-slate-500 mt-2">Loading…</p>}
      {state === 'error' && <p className="text-xs text-amber-700 mt-2">The history could not be loaded.</p>}
      {rows && (
        <AuditList rows={rows} empty="No decisions recorded yet. Records imported from open catalogues have no review history on HIMAKSHA." />
      )}
    </section>
  );
}

export function AuditList({ rows, empty, showTarget = false }: { rows: AuditEntry[]; empty: string; showTarget?: boolean }) {
  if (!rows.length) return <p className="text-xs text-slate-500 mt-2">{empty}</p>;
  return (
    <ol className="mt-2 space-y-1.5 text-xs">
      {rows.map((e) => (
        <li key={e.id} className="flex flex-wrap gap-x-2">
          <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">{when(e.at)}</span>
          <span className="font-semibold">{ACTION_LABEL[e.action] ?? e.action.replace(/_/g, ' ')}</span>
          {e.target_type === 'post' && !showTarget && <span className="text-slate-500">(post #{e.target_id}{e.detail.channel ? `, ${e.detail.channel}` : ''})</span>}
          {showTarget && (
            <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">
              {e.target_type} {e.target_id}
            </span>
          )}
          <span className="text-slate-600">
            by {e.actor}
            {e.role !== 'public' ? ` (${e.role})` : ''}
          </span>
          {e.detail.note && <span className="text-slate-600 italic">“{e.detail.note}”</span>}
        </li>
      ))}
    </ol>
  );
}
