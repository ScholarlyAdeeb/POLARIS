import React, { useEffect, useState } from 'react';
import { api, type Role, type Submission, type User } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DataStatusBadge, ErrorNote } from './ui';
import { Mini } from './SeriesChart';

const ROLES: Role[] = ['contributor', 'reviewer', 'admin'];

/** Contributor uploads waiting for review. Approving makes the record public (atlas, graph, search, station pages). */
export function SubmissionsPanel({ onOpenRecord }: { onOpenRecord?: (id: string) => void }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Submission[] | null>(null);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [reviewer, setReviewer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.admin.submissions(filter).then(setQueue).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const act = async (s: Submission, action: 'approve' | 'request_changes' | 'reject') => {
    setBusy(s.id);
    setError(null);
    try {
      await api.admin.reviewRecord(s.id, { action, note: notes[s.id], reviewer: user ? undefined : reviewer, dataStatus: status[s.id] });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="sci-card p-4 flex flex-col gap-3" data-testid="submissions-panel">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="font-semibold">Contributor submissions {queue ? `(${queue.length})` : ''}</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="sci-input text-xs py-1" aria-label="Filter submissions">
          <option value="PENDING_REVIEW">Waiting for review</option>
          <option value="CHANGES_REQUESTED">Changes requested</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      {!user && <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="sci-input text-sm max-w-xs" placeholder="Your name (reviewing with the admin token)" aria-label="Reviewer name" />}
      <ErrorNote error={error} />
      {queue?.length === 0 && <p className="text-sm sci-muted">Nothing here.</p>}
      <ul className="flex flex-col gap-3">
        {queue?.map((s) => (
          <li key={s.id} className="sci-well p-3 flex flex-col md:flex-row gap-3" data-testid="submission-row">
            {s.thumbnailUrl ? (
              <img src={s.thumbnailUrl} alt="" className="w-full md:w-40 h-28 object-cover rounded-lg" />
            ) : s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="w-full md:w-40 h-28 rounded-lg bg-white flex items-center justify-center text-xs underline">
                Open file
              </a>
            ) : null}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <p className="font-semibold">{s.title}</p>
              <p className="text-xs sci-muted">
                {s.type} · {s.year ?? '—'} · {s.stationId ?? 'no station'} · {s.domain || 'no region'} · by <b>{s.ownerName}</b>
                {s.ownerInstitution ? `, ${s.ownerInstitution}` : ''}
                {s.meta.location ? ` · ${s.meta.location.lat}, ${s.meta.location.lon}` : ''}
              </p>
              {s.summary && <p className="text-sm">{s.summary}</p>}
              {s.links.length > 0 && (
                <p className="text-xs">
                  Links:{' '}
                  {s.links.map((l) => (
                    <button key={l.id + l.relation} className="underline mr-2" onClick={() => onOpenRecord?.(l.id)}>
                      {l.relation.replace('_', ' ')} {l.title}
                    </button>
                  ))}
                </p>
              )}
              {s.reviewNote && <p className="text-xs">Previous note: {s.reviewNote}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <input value={notes[s.id] ?? ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} className="sci-input text-xs flex-1 min-w-[12rem]" placeholder="Note to the contributor" aria-label="Review note" />
                <select value={status[s.id] ?? s.dataStatus} onChange={(e) => setStatus({ ...status, [s.id]: e.target.value })} className="sci-input text-xs py-1" aria-label="Data status on approval">
                  <option value="UNVERIFIED">Approve as Unverified</option>
                  <option value="VERIFIED">Approve as Verified (checked against source)</option>
                  <option value="OFFICIAL">Approve as Official NCPOR</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="sci-btn text-xs py-1" disabled={busy === s.id || (!user && !reviewer.trim())} onClick={() => act(s, 'approve')}>
                  Approve and publish record
                </button>
                <button className="sci-btn-ghost text-xs py-1" disabled={busy === s.id || !notes[s.id]?.trim()} onClick={() => act(s, 'request_changes')}>
                  Request changes
                </button>
                <button className="sci-btn-ghost text-xs py-1" disabled={busy === s.id || !notes[s.id]?.trim()} onClick={() => act(s, 'reject')}>
                  Reject
                </button>
                <DataStatusBadge status={s.dataStatus} className="self-center" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UsersPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<(User & { created_at: string; records: number })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.admin.users().then(setUsers).catch((e) => setError(e.status === 403 ? 'Only admins can manage accounts.' : e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="sci-card p-4 overflow-x-auto" data-testid="users-panel">
      <h2 className="font-semibold mb-2">Accounts {users ? `(${users.length})` : ''}</h2>
      <ErrorNote error={error} />
      {users && (
        <table className="w-full text-sm min-w-[560px]">
          <thead className="text-xs sci-muted text-left">
            <tr>
              <th className="py-1.5">Name</th>
              <th>Institution</th>
              <th>Records</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t sci-border">
                <td className="py-1.5">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-[11px] sci-muted">{u.email}</div>
                </td>
                <td className="text-xs">{u.institution || '—'}</td>
                <td className="sci-mono text-xs">{u.records}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === user?.id}
                    className="sci-input text-xs py-1"
                    aria-label={`Role for ${u.name}`}
                    onChange={(e) =>
                      api.admin
                        .setRole(u.id, e.target.value as Role)
                        .then(load)
                        .catch((err) => setError(err.message))
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TopList({ title, rows }: { title: string; rows: { key: string; n: number }[] }) {
  return (
    <div className="sci-well p-3">
      <h3 className="text-xs font-semibold mb-2">{title}</h3>
      {rows.length === 0 && <p className="text-xs sci-muted">No data yet.</p>}
      <ol className="flex flex-col gap-1 text-xs">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-2">
            <span className="truncate flex-1 sci-mono">{r.key}</span>
            <span className="sci-mono font-semibold">{r.n}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AnalyticsPanel() {
  const [a, setA] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.admin.analytics(days).then(setA).catch((e) => setError(e.message));
  }, [days]);

  const series = (() => {
    if (!a) return { xs: [] as string[], ys: [] as number[] };
    const views: Record<string, number> = {};
    for (const d of a.daily) if (d.kind === 'page') views[d.day] = d.n;
    const xs: string[] = [];
    for (let i = days - 1; i >= 0; i--) xs.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
    return { xs, ys: xs.map((d) => views[d] ?? 0) };
  })();

  return (
    <section className="sci-card p-4 flex flex-col gap-3" data-testid="analytics-panel">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Usage</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="sci-input text-xs py-1" aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      <ErrorNote error={error} />
      {a && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Page views', a.totals.page ?? 0],
              ['Searches', a.totals.search ?? 0],
              ['Downloads', a.totals.download ?? 0],
            ].map(([k, v]) => (
              <div key={k} className="sci-well p-3">
                <p className="text-[11px] sci-muted">{k}</p>
                <p className="sci-mono text-xl font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <Mini name="Page views per day" xs={series.xs} ys={series.ys} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <TopList title="Top pages" rows={a.topPages} />
            <TopList title="Top searches" rows={a.topSearches} />
            <TopList title="Top downloads" rows={a.topDownloads} />
          </div>
          {a.contributors.length > 0 && (
            <TopList title="Contributors (approved records)" rows={a.contributors.map((c: any) => ({ key: `${c.name}${c.institution ? `, ${c.institution}` : ''}${c.pending ? ` (+${c.pending} pending)` : ''}`, n: c.approved }))} />
          )}
          <p className="text-[11px] sci-muted">Counts only (day, page path, search text, record id). No IP addresses, cookies or user identities are stored.</p>
        </>
      )}
    </section>
  );
}
