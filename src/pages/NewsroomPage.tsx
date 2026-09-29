import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ArchiveItem, type OutreachChannel, type PublishedPost } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

const CHANNEL_LABEL: Record<OutreachChannel, string> = { website: 'Website', x: 'X', linkedin: 'LinkedIn', instagram: 'Instagram' };

/** Minimal markdown for website articles: headings, emphasis, bullet lists, links. Text is escaped by React. */
function Article({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string, key: number) => {
    const parts: React.ReactNode[] = [];
    const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      parts.push(s.slice(last, m.index));
      if (m[1]) {
        const href = /^(https?:\/\/|\/)/.test(m[2]) ? m[2] : '#';
        parts.push(
          <a key={`${key}-${m.index}`} href={href} className="underline sci-accent" rel="noopener noreferrer">
            {m[1]}
          </a>
        );
      } else parts.push(<em key={`${key}-${m.index}`}>{m[3]}</em>);
      last = m.index + m[0].length;
    }
    parts.push(s.slice(last));
    return parts;
  };
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        if (b.startsWith('# ')) return <h3 key={i} className="font-['Space_Grotesk'] text-lg font-bold">{b.slice(2)}</h3>;
        if (b.startsWith('## ')) return <h4 key={i} className="font-semibold">{b.slice(3)}</h4>;
        if (/^- /m.test(b))
          return (
            <ul key={i} className="list-disc pl-5">
              {b.split('\n').map((l, j) => (
                <li key={j}>{inline(l.replace(/^- /, ''), j)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(b, i)}
          </p>
        );
      })}
    </div>
  );
}

function PostCard({ p }: { p: PublishedPost }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const shareX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.content.slice(0, 280))}`;
  const shareLinkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${location.origin}/?record=${p.item_id}`)}`;
  return (
    <article className={`sci-card overflow-hidden flex flex-col ${p.channel === 'website' ? 'md:col-span-2' : ''}`} data-testid="news-post">
      {p.item_thumbnail && <img src={p.item_thumbnail} alt="" className="w-full h-44 object-cover" loading="lazy" />}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-md bg-[#e5eeff] text-[#00677d] font-semibold">{CHANNEL_LABEL[p.channel]}</span>
          <DataStatusBadge status={p.data_status} />
          <span className="sci-muted ml-auto">{new Date(p.published_at ?? p.updated_at).toLocaleDateString()}</span>
        </div>
        {p.channel === 'website' ? <Article text={p.content} /> : <p className="text-sm whitespace-pre-line leading-relaxed">{p.content}</p>}
        <div className="mt-auto pt-2 border-t sci-border flex flex-wrap items-center gap-2 text-xs">
          {p.author_name ? (
            <span className="sci-muted">
              {t('newsroom.by')}{' '}
              <Link className="underline" to={`/contributors/${p.author_id}`}>
                {p.author_name}
              </Link>
              {p.author_institution ? `, ${p.author_institution}` : ''}
            </span>
          ) : (
            <span className="sci-muted">POLARIS archive</span>
          )}
          {p.reviewer && <span className="sci-muted">· approved by {p.reviewer}</span>}
          <span className="ml-auto flex gap-1.5">
            <a className="sci-btn-ghost py-1 px-2" href={`/?record=${encodeURIComponent(p.item_id)}`}>
              Source
            </a>
            <button
              className="sci-btn-ghost py-1 px-2"
              onClick={() =>
                navigator.clipboard?.writeText(p.content).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? t('common.copied') : t('common.copy')}
            </button>
            {p.channel === 'x' && (
              <a className="sci-btn-ghost py-1 px-2" href={shareX} target="_blank" rel="noopener noreferrer">
                Post on X
              </a>
            )}
            {p.channel === 'linkedin' && (
              <a className="sci-btn-ghost py-1 px-2" href={shareLinkedIn} target="_blank" rel="noopener noreferrer">
                Share on LinkedIn
              </a>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

export function NewsroomPage() {
  const { t } = useT();
  const [channel, setChannel] = useState('');
  const [posts, setPosts] = useState<PublishedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPosts(null);
    api.published({ channel: channel || undefined }).then(setPosts).catch((e) => setError(e.message));
  }, [channel]);

  return (
    <Page>
      <PageHeader title={t('newsroom.title')} text={t('newsroom.text')}>
        <div className="flex rounded-lg sci-well p-1 text-xs" role="group" aria-label="Channel">
          {['', 'website', 'x', 'linkedin', 'instagram'].map((c) => (
            <button key={c} onClick={() => setChannel(c)} aria-pressed={channel === c} className={`px-2.5 py-1 rounded ${channel === c ? 'bg-white font-semibold' : 'sci-muted'}`}>
              {c ? CHANNEL_LABEL[c as OutreachChannel] : t('common.all')}
            </button>
          ))}
        </div>
      </PageHeader>
      <ErrorNote error={error} />
      {!posts && !error && <p className="sci-muted text-sm">{t('common.loading')}</p>}
      {posts?.length === 0 && <p className="sci-muted text-sm">{t('newsroom.empty')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {posts?.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
    </Page>
  );
}

export function ContributorPage({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const { t } = useT();
  const { id } = useParams();
  const [c, setC] = useState<Awaited<ReturnType<typeof api.contributor>> | null>(null);
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const n = Number(id);
    setC(null);
    api.contributor(n).then(setC).catch((e) => setError(e.message));
    api.published({ user: n }).then(setPosts).catch(() => setPosts([]));
  }, [id]);

  if (error) return <Page><ErrorNote error={error} /></Page>;
  if (!c) return <Page><p className="sci-muted text-sm">{t('common.loading')}</p></Page>;

  const byType = c.records.reduce<Record<string, ArchiveItem[]>>((acc, r) => ((acc[r.type] ??= []).push(r), acc), {});
  return (
    <Page>
      <PageHeader title={c.name} text={[c.institution, `${c.records.length} ${t('contributor.records').toLowerCase()} · ${c.publishedPosts} ${t('contributor.posts')}`].filter(Boolean).join(' · ')} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 flex flex-col gap-4">
          <h2 className="font-semibold">{t('contributor.records')}</h2>
          {c.records.length === 0 && <p className="text-sm sci-muted">No approved work yet.</p>}
          {Object.entries(byType).map(([type, rs]) => (
            <div key={type}>
              <h3 className="text-xs sci-muted uppercase tracking-wide mb-1">{t(`type.${type}`)}</h3>
              <ul className="flex flex-col gap-1.5">
                {rs.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => onOpenRecord(r.id)} className="w-full text-left sci-card p-2.5 flex gap-3 items-center hover:shadow-md">
                      {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{r.title}</span>
                        <span className="text-xs sci-muted">{r.year ?? ''} {r.stationId ? `· ${r.stationId}` : ''}</span>
                      </span>
                      <DataStatusBadge status={r.dataStatus} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section className="lg:col-span-7">
          <h2 className="font-semibold mb-3">
            {t('nav.newsroom')} ({posts.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((p) => (
              <PostCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
