import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ArchiveItem, type ArchiveType, type MappingSuggestion, type OutreachChannel, type OutreachPost } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { usePolarisData } from '../context/PolarisDataContext';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

const TYPES: ArchiveType[] = ['report', 'dataset', 'publication', 'photo', 'video', 'expedition', 'activity'];
const CHANNELS: OutreachChannel[] = ['website', 'x', 'linkedin', 'instagram'];
const CHANNEL_LABEL: Record<OutreachChannel, string> = { website: 'Website article', x: 'X / Twitter', linkedin: 'LinkedIn', instagram: 'Instagram' };
const RELATION_LABEL: Record<string, string> = {
  documents: 'documents',
  collected_during: 'collected during',
  uses_data: 'uses data from',
  describes: 'describes',
  part_of: 'part of',
  related_to: 'related to',
};
const REVIEW_TONE: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  CHANGES_REQUESTED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

function typeFromUpload(kind: string, name: string): ArchiveType {
  if (kind === 'image') return 'photo';
  if (kind === 'video') return 'video';
  if (kind === 'data') return 'dataset';
  return /paper|article|journal/i.test(name) ? 'publication' : 'report';
}

const EMPTY = { type: 'report' as ArchiveType, title: '', summary: '', body: '', stationId: '', year: String(new Date().getFullYear()), tags: '', lat: '', lon: '', doi: '' };

function ReviewPill({ status }: { status: string }) {
  const { t } = useT();
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${REVIEW_TONE[status] ?? 'bg-slate-200'}`}>{t(`review.${status}`)}</span>;
}

function ShareForm({ onCreated }: { onCreated: (r: ArchiveItem) => void }) {
  const { t } = useT();
  const { stations } = usePolarisData();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<{ url: string; kind: string; originalName: string; bytes: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [suggest, setSuggest] = useState<MappingSuggestion | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const location = form.lat !== '' && form.lon !== '' ? { lat: Number(form.lat), lon: Number(form.lon) } : null;

  const upload = async (f: File) => {
    setUploading(true);
    setError(null);
    try {
      const up = await api.me.upload(f);
      setFile(up);
      setForm((cur) => ({
        ...cur,
        type: typeFromUpload(up.kind, up.originalName),
        title: cur.title || up.originalName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  // Auto-mapping: re-suggest when the description, station or coordinates settle.
  useEffect(() => {
    if (form.title.trim().length < 4) {
      setSuggest(null);
      return;
    }
    const h = setTimeout(() => {
      api.me
        .suggest({
          type: form.type,
          title: form.title,
          summary: form.summary,
          tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
          stationId: form.stationId || null,
          location,
        })
        .then((s) => {
          setSuggest(s);
          setPicked((p) => {
            const next: Record<string, string> = {};
            for (const r of s.related) if (p[r.id]) next[r.id] = p[r.id];
            return next;
          });
        })
        .catch(() => undefined);
    }, 600);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.title, form.summary, form.tags, form.stationId, form.lat, form.lon]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.me.create({
        type: form.type,
        title: form.title,
        summary: form.summary,
        body: form.body,
        stationId: form.stationId || suggest?.station?.id || null,
        year: form.year ? Number(form.year) : null,
        tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
        url: file?.url ?? null,
        doi: form.doi || null,
        location,
        links: Object.entries(picked).map(([id, relation]) => ({ id, relation })),
      });
      setForm(EMPTY);
      setFile(null);
      setSuggest(null);
      setPicked({});
      onCreated(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="sci-card p-4 md:p-5 flex flex-col gap-4" data-testid="share-form">
      <h2 className="font-semibold">{t('ws.upload')}</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${dragOver ? 'border-[#00b4d8] bg-[#eff9fc]' : 'sci-border hover:border-[#00b4d8]'}`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf,.txt,.csv,.nc,.json"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          data-testid="file-input"
        />
        <span className="material-symbols-outlined text-[28px] sci-accent">cloud_upload</span>
        <p className="text-sm font-semibold">{uploading ? t('common.loading') : file ? file.originalName : t('ws.drop')}</p>
        <p className="text-[11px] sci-muted">{file ? `${file.kind} · ${(file.bytes / 1024).toFixed(0)} KB · uploaded` : t('ws.allowed')}</p>
      </div>
      {file?.kind === 'image' && <img src={file.url} alt="" className="max-h-48 rounded-lg object-cover w-full" />}
      {file?.kind === 'video' && <video src={file.url} controls className="max-h-48 rounded-lg w-full bg-black" />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs sci-muted flex flex-col gap-1">
          {t('ws.kind')}
          <select value={form.type} onChange={set('type')} className="sci-input">
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`type.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1">
          {t('ws.titleField')}
          <input required maxLength={300} value={form.title} onChange={set('title')} className="sci-input" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1 md:col-span-2">
          {t('ws.summary')}
          <textarea rows={2} maxLength={5000} value={form.summary} onChange={set('summary')} className="sci-input" placeholder="What is it, where and when was it made, what does it show?" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1 md:col-span-2">
          {t('ws.details')}
          <textarea rows={3} maxLength={50000} value={form.body} onChange={set('body')} className="sci-input" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1">
          {t('ws.station')}
          <select value={form.stationId} onChange={set('stationId')} className="sci-input">
            <option value="">{t('ws.noStation')}</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1">
          {t('ws.year')}
          <input type="number" min={1900} max={2100} value={form.year} onChange={set('year')} className="sci-input" />
        </label>
        <label className="text-xs sci-muted flex flex-col gap-1 md:col-span-2">
          {t('ws.tags')}
          <input value={form.tags} onChange={set('tags')} className="sci-input" placeholder="glacier, aerosol, winter-over" />
        </label>
        <fieldset className="md:col-span-2 grid grid-cols-2 gap-3">
          <legend className="text-xs sci-muted mb-1">{t('ws.location')}</legend>
          <input type="number" step="any" min={-90} max={90} value={form.lat} onChange={set('lat')} className="sci-input" placeholder={`${t('ws.lat')} (−70.77)`} aria-label={t('ws.lat')} />
          <input type="number" step="any" min={-180} max={180} value={form.lon} onChange={set('lon')} className="sci-input" placeholder={`${t('ws.lon')} (11.73)`} aria-label={t('ws.lon')} />
        </fieldset>
        {(form.type === 'publication' || form.type === 'dataset') && (
          <label className="text-xs sci-muted flex flex-col gap-1 md:col-span-2">
            {t('ws.doi')}
            <input value={form.doi} onChange={set('doi')} className="sci-input sci-mono" placeholder="10.xxxx/xxxxx" />
          </label>
        )}
      </div>

      <section className="sci-well p-3 flex flex-col gap-2" data-testid="mapping-panel">
        <h3 className="text-sm font-semibold">{t('ws.mapping')}</h3>
        <p className="text-xs sci-muted">{t('ws.mappingText')}</p>
        {!suggest && <p className="text-xs sci-muted">Type a title to get suggestions.</p>}
        {suggest && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {suggest.station ? (
                <span className="px-2 py-1 rounded bg-white">
                  📍 <b>{suggest.station.name}</b> · {suggest.station.reason}
                  {!form.stationId && (
                    <button type="button" className="ml-2 underline sci-accent" onClick={() => setForm((f) => ({ ...f, stationId: suggest.station!.id }))}>
                      use
                    </button>
                  )}
                </span>
              ) : (
                <span className="px-2 py-1 rounded bg-white sci-muted">No station matched. Add coordinates or pick a station.</span>
              )}
              {suggest.region && <span className="px-2 py-1 rounded bg-white">🧭 {suggest.region}</span>}
            </div>
            <ul className="flex flex-col gap-1">
              {suggest.related.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={!!picked[r.id]}
                    onChange={(e) => setPicked((p) => (e.target.checked ? { ...p, [r.id]: r.relation } : Object.fromEntries(Object.entries(p).filter(([k]) => k !== r.id))))}
                    aria-label={`Link to ${r.title}`}
                  />
                  <select
                    value={picked[r.id] ?? r.relation}
                    onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="sci-input py-0.5 text-[11px] w-32 shrink-0"
                    aria-label="Relation"
                  >
                    {Object.entries(RELATION_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <span className="truncate flex-1" title={r.reason}>
                    <span className="sci-muted capitalize">{r.type}</span> · {r.title}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button className="sci-btn" disabled={busy || uploading || !form.title.trim()}>
          {busy ? t('common.loading') : t('common.submit')}
        </button>
        <p className="text-[11px] sci-muted">Stays private until a reviewer approves it.</p>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}

function PostEditor({ post, onSaved }: { post: OutreachPost; onSaved: () => void }) {
  const { t } = useT();
  const [text, setText] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const c = post.claim_check;
  const published = post.status === 'PUBLISHED';
  return (
    <li className="sci-well p-3 flex flex-col gap-2" data-testid="my-post">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold">{CHANNEL_LABEL[post.channel]}</span>
        <span className="sci-muted truncate max-w-[16rem]">· {post.item_title}</span>
        <span className="ml-auto flex gap-1.5">
          <DataStatusBadge status={post.data_status} />
          {published ? <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 text-sky-800">Published</span> : <ReviewPill status={post.review_status} />}
        </span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={post.channel === 'website' ? 8 : 5} readOnly={published} className="sci-input text-xs leading-relaxed" aria-label="Post text" />
      {c?.checked !== undefined && (
        <p className="text-[11px]">
          Fact check: <span style={{ color: 'var(--pol-ok)' }}>{c.supported} supported</span> · <span style={{ color: 'var(--pol-warn)' }}>{c.partial} partly</span> ·{' '}
          <span style={{ color: 'var(--pol-bad)' }}>{c.unsupported} not in your record</span>
        </p>
      )}
      {post.review_note && (
        <p className="text-[11px]">
          <b>{t('ws.reviewerNote')}:</b> {post.review_note}
        </p>
      )}
      <div className="flex gap-2">
        {!published && (
          <button
            className="sci-btn-ghost text-xs py-1"
            disabled={busy || text === post.content}
            onClick={async () => {
              setBusy(true);
              await api.me.editContent(post.id, text).catch(() => undefined);
              setBusy(false);
              onSaved();
            }}
          >
            {t('common.save')}
          </button>
        )}
        <button
          className="sci-btn-ghost text-xs py-1"
          onClick={() =>
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? t('common.copied') : t('common.copy')}
        </button>
        {published && (
          <Link to="/newsroom" className="sci-btn-ghost text-xs py-1">
            {t('nav.newsroom')}
          </Link>
        )}
      </div>
    </li>
  );
}

function Submission({ r, onChanged, onPosts }: { r: ArchiveItem; onChanged: () => void; onPosts: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<OutreachChannel[]>(CHANNELS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="sci-card p-3 flex flex-col gap-2" data-testid="submission">
      <div className="flex gap-3">
        {r.thumbnailUrl ? (
          <img src={r.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
        ) : (
          <span className="w-16 h-16 rounded-lg sci-well flex items-center justify-center shrink-0 material-symbols-outlined sci-muted">
            {{ dataset: 'dataset', publication: 'article', report: 'description', video: 'movie', photo: 'image', expedition: 'explore', activity: 'campaign' }[r.type]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{r.title}</p>
          <p className="text-xs sci-muted">
            {t(`type.${r.type}`)} · {r.year ?? '—'} {r.stationId ? `· ${r.stationId}` : ''} · <span className="sci-mono">{r.id}</span>
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <ReviewPill status={r.reviewStatus} />
            <DataStatusBadge status={r.dataStatus} />
          </div>
        </div>
      </div>
      {r.reviewNote && (
        <p className="text-xs">
          <b>{t('ws.reviewerNote')}:</b> {r.reviewNote}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="sci-btn-ghost text-xs py-1" onClick={() => setOpen(!open)} aria-expanded={open}>
          {t('ws.makeContent')}
        </button>
        {r.reviewStatus === 'APPROVED' && (
          <Link className="sci-btn-ghost text-xs py-1" to={`/?record=${encodeURIComponent(r.id)}`} reloadDocument>
            {t('common.open')}
          </Link>
        )}
        {r.reviewStatus !== 'APPROVED' && (
          <button
            className="sci-btn-ghost text-xs py-1"
            onClick={async () => {
              if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
              await api.me.remove(r.id).catch((e) => setError(e.message));
              onChanged();
            }}
          >
            Delete
          </button>
        )}
      </div>
      {open && (
        <div className="sci-well p-3 flex flex-col gap-2">
          <p className="text-xs sci-muted">{t('ws.channels')}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" checked={channels.includes(c)} onChange={(e) => setChannels(e.target.checked ? [...channels, c] : channels.filter((x) => x !== c))} />
                {CHANNEL_LABEL[c]}
              </label>
            ))}
          </div>
          <button
            className="sci-btn text-xs w-fit"
            disabled={busy || !channels.length}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.me.generate(r.id, channels, 'ai');
                setOpen(false);
                onPosts();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t('common.loading') : `${t('ws.makeContent')} (${channels.length})`}
          </button>
          <p className="text-[11px] sci-muted">Each post is checked against this record and credited to you. A reviewer approves it before it is published{r.reviewStatus !== 'APPROVED' ? ', after the record itself is approved' : ''}.</p>
        </div>
      )}
      <ErrorNote error={error} />
    </li>
  );
}

export function WorkspacePage() {
  const { user, loading } = useAuth();
  const { t } = useT();
  const [records, setRecords] = useState<ArchiveItem[] | null>(null);
  const [posts, setPosts] = useState<OutreachPost[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const postsRef = useRef<HTMLElement>(null);

  const load = () => {
    api.me.records().then(setRecords).catch(() => setRecords([]));
    api.me.content().then(setPosts).catch(() => setPosts([]));
  };
  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return <Page>{t('common.loading')}</Page>;
  if (!user)
    return (
      <Page>
        <PageHeader title={t('ws.title')} text={t('ws.text')} />
        <div className="sci-card p-6 max-w-md flex flex-col gap-3">
          <p className="text-sm">{t('ws.signInFirst')}</p>
          <div className="flex gap-2">
            <Link to="/login?next=/workspace" className="sci-btn">
              {t('auth.signIn')}
            </Link>
            <Link to="/login?mode=register&next=/workspace" className="sci-btn-ghost">
              {t('auth.register')}
            </Link>
          </div>
        </div>
      </Page>
    );

  return (
    <Page>
      <PageHeader title={t('ws.title')} text={t('ws.text')}>
        <Link to={`/contributors/${user.id}`} className="sci-btn-ghost text-sm">
          Public profile
        </Link>
      </PageHeader>
      {info && (
        <p className="text-sm mb-4 sci-card px-4 py-2" style={{ color: 'var(--pol-ok)' }} role="status">
          {info}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <ShareForm
            onCreated={(r) => {
              setInfo(`“${r.title}” was submitted. It will appear on the atlas, graph and search once a reviewer approves it.`);
              load();
            }}
          />
        </div>
        <div className="xl:col-span-5 flex flex-col gap-5">
          <section>
            <h2 className="font-semibold mb-2">
              {t('ws.mine')} {records ? `(${records.length})` : ''}
            </h2>
            {records?.length === 0 && <p className="text-sm sci-muted">{t('ws.none')}</p>}
            <ul className="flex flex-col gap-3">
              {records?.map((r) => (
                <Submission
                  key={r.id}
                  r={r}
                  onChanged={load}
                  onPosts={() => {
                    load();
                    setInfo('Posts drafted and sent for review. Edit them below if needed.');
                    setTimeout(() => postsRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
                  }}
                />
              ))}
            </ul>
          </section>
          <section ref={postsRef}>
            <h2 className="font-semibold mb-2">
              {t('ws.myPosts')} ({posts.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {posts.map((p) => (
                <PostEditor key={`${p.id}-${p.updated_at}`} post={p} onSaved={load} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Page>
  );
}
