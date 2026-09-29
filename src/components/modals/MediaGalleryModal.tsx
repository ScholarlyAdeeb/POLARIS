import React, { useEffect, useState } from 'react';
import { api, type ArchiveItem } from '../../lib/api';

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRecord: (id: string) => void;
}

type Filter = 'photo,video' | 'photo' | 'video';

/** Browsable photo & video archive backed by /api/archive. */
export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({ isOpen, onClose, onOpenRecord }) => {
  const [filter, setFilter] = useState<Filter>('photo,video');
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setItems(null);
    setError('');
    api
      .archive({ type: filter, limit: 60 })
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setError('The POLARIS API is unreachable.'));
    return () => {
      cancelled = true;
    };
  }, [isOpen, filter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[88vh] flex flex-col bg-white rounded-none sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-[#eff4ff]">
          <div>
            <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#00b4d8] text-white font-bold">
              NCPOR PHOTO & VIDEO VAULT
            </span>
            <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] mt-0.5">
              Expedition Media Archive{items ? ` • ${items.length} item${items.length === 1 ? '' : 's'}` : ''}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white font-['JetBrains_Mono'] text-xs">
              {(
                [
                  ['photo,video', 'All'],
                  ['photo', 'Photos'],
                  ['video', 'Videos'],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    filter === f ? 'bg-[#00677d] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <p className="text-sm text-amber-700">{error}</p>}
          {!items && !error && <p className="p-8 text-center text-sm text-slate-400">Loading media…</p>}
          {items && items.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No media in this collection yet.</p>}
          {items && items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onOpenRecord(m.id)}
                  className="group text-left rounded-2xl overflow-hidden bg-white border border-slate-200 hover:border-[#00b4d8] transition-all"
                >
                  <div className="relative h-40 bg-slate-200 overflow-hidden">
                    {(m.thumbnailUrl || m.url) && (
                      <img
                        src={(m.thumbnailUrl || m.url)!}
                        alt={m.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                    {m.type === 'video' && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center text-[#00677d] shadow-lg">
                          <span className="material-symbols-outlined text-[26px] ml-0.5">play_arrow</span>
                        </span>
                      </span>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white font-['JetBrains_Mono'] text-[10px] font-bold uppercase">
                      {m.type}
                      {m.year ? ` • ${m.year}` : ''}
                    </span>
                  </div>
                  <div className="p-3">
                    <span className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] block truncate">{m.title}</span>
                    <span className="font-['Inter'] text-xs text-slate-500 line-clamp-2">{m.summary}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
