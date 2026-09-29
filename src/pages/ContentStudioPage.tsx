import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type OutreachChannel, type OutreachPost, type SearchResult } from '../lib/api';
import { AdminGate, DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';
import { useAuth } from '../lib/auth';

const CHANNELS: OutreachChannel[] = ['website', 'x', 'linkedin', 'instagram'];
const REVIEW_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'Waiting for review',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
  REJECTED: 'Rejected',
};

function ClaimList({ post }: { post: OutreachPost }) {
  const c = post.claim_check;
  if (!c?.claims?.length) return <p className="text-xs sci-muted">No claim check recorded.</p>;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs">
        Claim check against the source record: <span style={{ color: 'var(--pol-ok)' }}>{c.supported} supported</span> ·{' '}
        <span style={{ color: 'var(--pol-warn)' }}>{c.partial} partly</span> · <span style={{ color: 'var(--pol-bad)' }}>{c.unsupported} unsupported</span>
      </p>
      {c.claims
        .filter((x) => x.status !== 'no_claim')
        .map((x, i) => (
          <p key={i} className={`text-xs rounded px-1.5 py-0.5 claim-${x.status}`}>
            {x.sentence}
            {x.missingNumbers.length > 0 && <span className="font-semibold"> (numbers not in source: {x.missingNumbers.join(', ')})</span>}
          </p>
        ))}
    </div>
  );
}

function Studio({ logout }: { logout: () => void }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [itemId, setItemId] = useState(params.get('item') ?? '');
  const [itemQuery, setItemQuery] = useState('');
  const [itemHits, setItemHits] = useState<SearchResult[]>([]);
  const [channel, setChannel] = useState<OutreachChannel>('website');
  const [mode, setMode] = useState<'ai' | 'template'>('ai');
  const [queue, setQueue] = useState<OutreachPost[]>([]);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [edit, setEdit] = useState('');
  const [reviewer, setReviewer] = useState(() => {
    if (user) return user.name;
    try {
      return localStorage.getItem('polaris-reviewer') || '';
    } catch {
      return '';
    }
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = () =>
    api.admin
      .outreach(filter || undefined)
      .then(setQueue)
      .catch((e) => {
        setError(e.message);
        if (e.status === 401) logout();
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!itemQuery.trim()) {
      setItemHits([]);
      return;
    }
    const t = setTimeout(() => api.search(itemQuery, 8).then((r) => setItemHits(r.results)).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [itemQuery]);

  const open = queue.find((p) => p.id === openId) ?? null;
  useEffect(() => setEdit(open?.content ?? ''), [openId, open?.content]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      await load();
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401) logout();
    } finally {
      setBusy(false);
    }
  };

  const saveReviewer = (v: string) => {
    setReviewer(v);
    try {
      localStorage.setItem('polaris-reviewer', v);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* 1. Draft */}
      <section className="sci-card p-4 xl:col-span-4 flex flex-col gap-3 self-start">
        <h2 className="font-semibold">1 · Draft from a record</h2>
        <label className="text-xs sci-muted flex flex-col gap-1">
          Source record ID
          <input value={itemId} onChange={(e) => setItemId(e.target.value)} className="sci-input sci-mono" placeholder="e.g. NCPOR-MET-2023-042" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1">
          …or find one
          <input value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} className="sci-input" placeholder="Search the archive" />
        </label>
        {itemHits.length > 0 && (
          <ul className="sci-well p-1 max-h-44 overflow-y-auto">
            {itemHits.map((h) => (
              <li key={h.id}>
                <button
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-[var(--pol-surface)] flex gap-2 items-center"
                  onClick={() => {
                    setItemId(h.id);
                    setItemQuery('');
                  }}
                >
                  <span className="truncate flex-1">{h.title}</span>
                  <DataStatusBadge status={h.dataStatus} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs sci-muted flex flex-col gap-1">
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as OutreachChannel)} className="sci-input">
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs sci-muted flex flex-col gap-1">
            Writer
            <select value={mode} onChange={(e) => setMode(e.target.value as 'ai' | 'template')} className="sci-input">
              <option value="ai">AI draft (falls back to template)</option>
              <option value="template">Template only</option>
            </select>
          </label>
        </div>
        <button
          className="sci-btn"
          disabled={busy || !itemId.trim()}
          onClick={() =>
            run(async () => {
              const p = await api.admin.draft(itemId.trim(), channel, mode);
              setOpenId(p.id);
              setInfo(p.aiRequested && !p.aiUsed ? 'No LLM available, so the deterministic template wrote this draft.' : null);
            })
          }
        >
          {busy ? 'Working…' : 'Generate draft'}
        </button>
        <p className="text-xs sci-muted">Drafts are never published automatically. Every draft is claim-checked against its source record and waits for a named reviewer.</p>
      </section>

      {/* 2. Queue */}
      <section className="sci-card p-4 xl:col-span-3 self-start">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">2 · Review queue</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="sci-input text-xs py-1" aria-label="Filter queue">
            <option value="">All</option>
            {Object.entries(REVIEW_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {queue.length === 0 && <p className="text-sm sci-muted">Nothing here yet.</p>}
        <ul className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
          {queue.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} className={`w-full text-left p-2 rounded-lg text-xs ${openId === p.id ? 'sci-well' : 'hover:bg-[var(--pol-surface-2)]'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="sci-mono sci-muted">#{p.id}</span>
                  <span className="capitalize">{p.channel}</span>
                  <DataStatusBadge status={p.data_status} className="ml-auto" />
                </div>
                <div className="truncate font-semibold">{p.item_title}</div>
                {p.author_name && <div className="truncate sci-muted">by {p.author_name}</div>}
                <div className="sci-muted">
                  {REVIEW_LABEL[p.review_status]}
                  {p.status === 'PUBLISHED' ? ' · published' : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Review */}
      <section className="sci-card p-4 xl:col-span-5 flex flex-col gap-3 self-start" data-testid="review-panel">
        <h2 className="font-semibold">3 · Human review</h2>
        {!open && <p className="text-sm sci-muted">Pick a draft from the queue.</p>}
        {open && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <DataStatusBadge status={open.data_status} />
              <span className="sci-mono sci-muted">{open.provider}</span>
              <span className="sci-muted">· source</span>
              <span className="sci-mono">{open.item_id}</span>
              <DataStatusBadge status={open.item_data_status} />
              <span className="ml-auto font-semibold">{REVIEW_LABEL[open.review_status]}</span>
            </div>
            {open.author_name && (
              <p className="text-xs sci-muted">
                Contributed by {open.author_name}
                {open.author_institution ? `, ${open.author_institution}` : ''}
              </p>
            )}
            {open.item_review_status && open.item_review_status !== 'APPROVED' && (
              <p className="text-xs" style={{ color: 'var(--pol-warn)' }}>
                The source record is not approved yet. Approve it under Admin → Contributor submissions before publishing.
              </p>
            )}
            <textarea value={edit} onChange={(e) => setEdit(e.target.value)} rows={9} className="sci-input text-sm leading-relaxed" aria-label="Draft text" />
            <ClaimList post={open} />
            {open.reviewer && (
              <p className="text-xs sci-muted">
                Last review by {open.reviewer}
                {open.review_note ? `: “${open.review_note}”` : ''}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input value={reviewer} onChange={(e) => saveReviewer(e.target.value)} readOnly={!!user} className="sci-input" placeholder="Reviewer name" aria-label="Reviewer name" />
              <input value={note} onChange={(e) => setNote(e.target.value)} className="sci-input" placeholder="Review note (optional)" aria-label="Review note" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="sci-btn-ghost" disabled={busy || edit === open.content} onClick={() => run(() => api.admin.review(open.id, { action: 'edit', content: edit }), 'Saved and re-checked. Back in the review queue.')}>
                Save edit
              </button>
              <button className="sci-btn" disabled={busy || !reviewer.trim() || edit !== open.content} onClick={() => run(() => api.admin.review(open.id, { action: 'approve', reviewer, note }), 'Approved.')}>
                Approve
              </button>
              <button className="sci-btn-ghost" disabled={busy || !reviewer.trim()} onClick={() => run(() => api.admin.review(open.id, { action: 'request_changes', reviewer, note }), 'Changes requested.')}>
                Request changes
              </button>
              <button className="sci-btn-ghost" disabled={busy || !reviewer.trim()} onClick={() => run(() => api.admin.review(open.id, { action: 'reject', reviewer, note }), 'Rejected.')}>
                Reject
              </button>
              <button
                className="sci-btn-ghost"
                disabled={busy || open.review_status !== 'APPROVED' || open.status === 'PUBLISHED' || (open.item_review_status !== undefined && open.item_review_status !== 'APPROVED')}
                onClick={() => run(() => api.admin.review(open.id, { action: 'publish' }), 'Published.')}
              >
                Publish
              </button>
            </div>
            {edit !== open.content && <p className="text-xs sci-muted">Save your edit before approving; saving re-runs the claim check.</p>}
          </>
        )}
        {info && <p className="text-sm" style={{ color: 'var(--pol-ok)' }}>{info}</p>}
        <ErrorNote error={error} />
      </section>
    </div>
  );
}

export function ContentStudioPage() {
  return (
    <Page>
      <PageHeader title="Outreach studio" text="AI or template drafts → automatic claim check → human review → publish. Publishing is blocked until a named reviewer approves." />
      <AdminGate>{(logout) => <Studio logout={logout} />}</AdminGate>
    </Page>
  );
}
