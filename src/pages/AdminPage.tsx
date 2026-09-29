import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ArchiveItem } from '../lib/api';
import { AdminGate, DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';
import { AnalyticsPanel, SubmissionsPanel, UsersPanel } from '../components/AdminPanels';
import { useAuth } from '../lib/auth';

const DATA_STATUSES = ['OFFICIAL', 'VERIFIED', 'EXTERNAL', 'SAMPLE', 'SYNTHETIC', 'AI_GENERATED', 'UNVERIFIED'];
const REVIEW = ['PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'];
const PROPOSAL = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'DECLINED'];

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sci-well p-3">
      <p className="text-[11px] sci-muted">{label}</p>
      <p className="sci-mono font-semibold">{value}</p>
    </div>
  );
}

function Console({ logout, onOpenRecord }: { logout: () => void; onOpenRecord?: (id: string) => void }) {
  const { user } = useAuth();
  const [ov, setOv] = useState<any>(null);
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [o, a, p] = await Promise.all([api.admin.overview(), api.archive({ limit: 100 }), api.admin.proposals()]);
      setOv(o);
      setItems(a.items);
      setProposals(p);
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401) logout();
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      setInfo(ok);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!ov) return <p className="sci-muted text-sm">{error ?? 'Loading…'}</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Link to="/content/review" className="sci-btn">
          Open outreach review queue
        </Link>
        {!user && (
          <button className="sci-btn-ghost" onClick={logout}>
            Forget admin token
          </button>
        )}
      </div>

      <SubmissionsPanel onOpenRecord={onOpenRecord} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AnalyticsPanel />
        {(!user || user.role === 'admin') && <UsersPanel />}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="sci-card p-4">
          <h2 className="font-semibold mb-3">AI providers</h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Active generator" value={ov.llm.active} />
            <Stat label="Gemini key" value={ov.llm.gemini.configured ? `set · ${ov.llm.gemini.model}` : 'not set'} />
            <Stat label="Assistant queries logged" value={ov.aiQueries} />
          </div>
        </div>
        <div className="sci-card p-4">
          <h2 className="font-semibold mb-3">Semantic retrieval (ml/)</h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="ML service" value={ov.ml.available ? 'reachable' : 'offline'} />
            <Stat label="Model" value={ov.ml.model ?? '—'} />
            <Stat label="Backend" value={ov.ml.backend ?? '—'} />
            <Stat label="Stored embeddings" value={ov.embeddings} />
          </div>
          <button className="sci-btn-ghost w-full mt-3" disabled={busy || !ov.ml.available} onClick={() => act(async () => {
            const r = await api.admin.rebuildEmbeddings();
            setInfo(`Embedded ${r.embedded} records with ${r.model} (${r.dim} dims).`);
          }, 'Embeddings rebuilt.')}>
            Rebuild embeddings
          </button>
          {!ov.ml.available && <p className="text-xs sci-muted mt-2">Start it with ml/serve.ps1. Search stays BM25-only until then.</p>}
        </div>
        <div className="sci-card p-4">
          <h2 className="font-semibold mb-3">Database</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {Object.entries(ov.archiveByStatus).map(([k, n]) => (
              <Stat key={k} label={k} value={n as number} />
            ))}
          </div>
          <p className="text-xs sci-muted">Migrations: {ov.migrations.map((m: any) => m.version).join(', ')}</p>
        </div>
      </section>

      {info && <p className="text-sm" style={{ color: 'var(--pol-ok)' }}>{info}</p>}
      <ErrorNote error={error} />

      <section className="sci-card p-4 overflow-x-auto">
        <h2 className="font-semibold mb-1">Archive provenance (latest 100 records)</h2>
        <p className="text-xs sci-muted mb-3">Set the data status only after checking a record against its source. Changes are saved immediately.</p>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs sci-muted text-left">
            <tr>
              <th className="py-1.5">Record</th>
              <th>Type</th>
              <th>Data status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t sci-border">
                <td className="py-1.5 pr-3">
                  <div className="font-medium truncate max-w-[420px]">{it.title}</div>
                  <div className="text-[11px] sci-mono sci-muted">{it.id}</div>
                </td>
                <td className="capitalize text-xs">{it.type}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <DataStatusBadge status={it.dataStatus} />
                    <select
                      aria-label={`Data status for ${it.id}`}
                      value={it.dataStatus}
                      disabled={busy}
                      className="sci-input text-xs py-1"
                      onChange={(e) => act(() => api.admin.updateRecord(it.id, { dataStatus: e.target.value }), `${it.id} marked ${e.target.value}.`)}
                    >
                      {DATA_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`Review status for ${it.id}`}
                    value={it.reviewStatus}
                    disabled={busy}
                    className="sci-input text-xs py-1"
                    onChange={(e) => act(() => api.admin.updateRecord(it.id, { reviewStatus: e.target.value }), `${it.id} review set to ${e.target.value}.`)}
                  >
                    {REVIEW.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sci-card p-4">
        <h2 className="font-semibold mb-3">Research proposals ({proposals.length})</h2>
        {proposals.length === 0 && <p className="text-sm sci-muted">No proposals yet.</p>}
        <ul className="divide-y sci-border">
          {proposals.map((p) => (
            <li key={p.reference} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.title}</div>
                <div className="text-xs sci-muted">
                  <span className="sci-mono">{p.reference}</span> · {p.pi_name}, {p.affiliation} · {p.platform}
                </div>
              </div>
              <select value={p.status} className="sci-input text-xs py-1" onChange={(e) => act(() => api.admin.setProposal(p.reference, e.target.value), `${p.reference} → ${e.target.value}`)}>
                {PROPOSAL.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminPage({ onOpenRecord }: { onOpenRecord?: (id: string) => void }) {
  return (
    <Page>
      <PageHeader title="Admin" text="Review contributor submissions, manage accounts, check usage, provenance and service status." />
      <AdminGate>{(logout) => <Console logout={logout} onOpenRecord={onOpenRecord} />}</AdminGate>
    </Page>
  );
}
