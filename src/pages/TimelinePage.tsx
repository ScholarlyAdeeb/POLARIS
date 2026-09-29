import React, { useEffect, useMemo, useState } from 'react';
import { api, type ArchiveItem } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

/** Expeditions and institutional milestones by year, each with the records that point to it. */
export function TimelinePage({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const { t } = useT();
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'milestones' | 'all'>('milestones');

  useEffect(() => {
    Promise.all([
      api.archive({ type: 'expedition', sort: 'oldest', limit: 100 }),
      api.archive({ type: 'activity,report', sort: 'oldest', limit: 100 }),
    ])
      .then(([exp, act]) => setItems([...exp.items, ...act.items].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))))
      .catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => (items ?? []).filter((i) => scope === 'all' || i.type === 'expedition'), [items, scope]);
  const byYear = useMemo(() => {
    const m = new Map<number, ArchiveItem[]>();
    for (const i of shown) if (i.year) m.set(i.year, [...(m.get(i.year) ?? []), i]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);

  return (
    <Page>
      <PageHeader title={t('timeline.title')} text={t('timeline.text')}>
        <div className="flex rounded-lg sci-well p-1 text-xs">
          {(['milestones', 'all'] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} aria-pressed={scope === s} className={`px-2.5 py-1 rounded ${scope === s ? 'bg-white font-semibold' : 'sci-muted'}`}>
              {s === 'milestones' ? t('type.expedition') : `${t('type.expedition')} + ${t('type.report')} + ${t('type.activity')}`}
            </button>
          ))}
        </div>
      </PageHeader>
      <ErrorNote error={error} />
      {!items && !error && <p className="sci-muted text-sm">{t('common.loading')}</p>}
      <ol className="relative border-l-2 border-[#b3ebff] ml-3 md:ml-24 flex flex-col gap-6" data-testid="timeline">
        {byYear.map(([year, rs]) => (
          <li key={year} className="pl-6 relative">
            <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-[#00677d] ring-4 ring-[#e5eeff]" />
            <p className="md:absolute md:-left-28 md:w-20 md:text-right font-['Space_Grotesk'] font-bold text-lg sci-accent">{year}</p>
            <div className="flex flex-col gap-2">
              {rs.map((r) => (
                <button key={r.id} onClick={() => onOpenRecord(r.id)} className="sci-card p-3 text-left hover:shadow-md flex gap-3">
                  {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="w-20 h-16 object-cover rounded-lg shrink-0 hidden sm:block" loading="lazy" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-[11px] sci-muted uppercase tracking-wide">{t(`type.${r.type}`)}</span>
                      <DataStatusBadge status={r.dataStatus} />
                    </span>
                    <span className="block font-semibold text-sm">{r.title}</span>
                    <span className="block text-xs sci-muted line-clamp-2">{r.summary}</span>
                  </span>
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </Page>
  );
}
