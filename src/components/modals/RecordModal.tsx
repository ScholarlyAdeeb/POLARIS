import React, { useEffect, useState } from 'react';
import { api, download, downloadUrls, type ArchiveItem, type LinkedRecord } from '../../lib/api';
import { Link } from 'react-router-dom';
import { OutreachPanel } from './OutreachPanel';
import { DataStatusBadge } from '../ui';
import { SeriesChart } from '../SeriesChart';
import { CitePanel } from '../CitePanel';

interface RecordModalProps {
  recordId: string | null;
  onClose: () => void;
  onOpenRecord: (id: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  expedition: 'EXPEDITION',
  report: 'EXPEDITION REPORT',
  dataset: 'DATASET',
  publication: 'PUBLICATION',
  photo: 'PHOTOGRAPH',
  video: 'VIDEO',
  activity: 'INSTITUTIONAL ACTIVITY',
};

/** Generic viewer for any archive record (reports, photos, videos, expeditions, activities). */
export const RecordModal: React.FC<RecordModalProps> = ({ recordId, onClose, onOpenRecord }) => {
  const [record, setRecord] = useState<(ArchiveItem & { links: LinkedRecord[] }) | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    setRecord(null);
    setError('');
    api
      .record(recordId)
      .then((r) => !cancelled && setRecord(r))
      .catch((err) => !cancelled && setError(err?.status === 404 ? 'Record not found.' : 'The POLARIS API is unreachable.'));
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (!recordId) return null;

  const image = record?.type === 'photo' ? record.url : record?.thumbnailUrl;
  const isVideoFile = record?.type === 'video' && record.url && /\.(mp4|webm)$/i.test(record.url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#eff4ff]">
          <div className="min-w-0">
            <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#e5eeff] text-[#00677d] font-bold">
              {record ? `${TYPE_LABEL[record.type] ?? record.type.toUpperCase()} • ${record.id}` : 'ARCHIVE RECORD'}
            </span>
            <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] mt-0.5 truncate">
              {record?.title ?? recordId}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-['Inter']">
          {error && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              {error}
            </div>
          )}
          {!record && !error && <div className="p-8 text-center text-sm text-slate-400">Loading record…</div>}

          {record && (
            <>
              {isVideoFile ? (
                <video src={record.url!} poster={record.thumbnailUrl ?? undefined} controls className="w-full max-h-80 rounded-xl bg-black" />
              ) : (
                image && (
                  <div className="relative">
                    <img src={image} alt={record.title} className="w-full max-h-80 object-cover rounded-xl" />
                    {record.type === 'video' && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white font-['JetBrains_Mono'] text-[11px]">
                        {record.meta.duration ? `${record.meta.duration} • ` : ''}video file not yet uploaded
                      </span>
                    )}
                  </div>
                )
              )}

              <div className="flex flex-wrap items-center gap-2 font-['JetBrains_Mono'] text-[11px] text-slate-500">
                {record.domain && <span className="px-2 py-0.5 rounded bg-slate-100">{record.domain}</span>}
                {record.year && <span className="px-2 py-0.5 rounded bg-slate-100">{record.year}</span>}
                {record.meta.leader && <span className="px-2 py-0.5 rounded bg-slate-100">Led by {record.meta.leader}</span>}
                {record.meta.sample && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">SAMPLE RECORD</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <DataStatusBadge status={record.dataStatus} />
                {record.meta.contributor?.name && record.ownerId ? (
                  <span className="sci-muted">
                    Shared by{' '}
                    <Link to={`/contributors/${record.ownerId}`} className="underline" onClick={onClose}>
                      {record.meta.contributor.name}
                    </Link>
                    {record.meta.contributor.institution ? `, ${record.meta.contributor.institution}` : ''}
                  </span>
                ) : (
                  record.provenance?.source && <span className="sci-muted">Source: {record.provenance.source}</span>
                )}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{record.summary}</p>
              {record.body && <p className="text-sm text-slate-600 leading-relaxed">{record.body}</p>}

              {Array.isArray(record.meta.highlights) && (
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                  {record.meta.highlights.map((h: string) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}

              {record.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {record.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-[#eff4ff] font-['JetBrains_Mono'] text-[10px] text-[#00677d]">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {record.links.length > 0 && (
                <div>
                  <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Linked Records</h4>
                  <div className="flex flex-wrap gap-2">
                    {record.links.map((l) => (
                      <button
                        key={`${l.id}-${l.relation}`}
                        onClick={() => onOpenRecord(l.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#eff4ff] font-['JetBrains_Mono'] text-[11px] text-[#00677d] hover:underline text-left"
                      >
                        {l.type}: {l.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {record.url && !isVideoFile && !image && (
                <a href={record.url} target="_blank" rel="noopener noreferrer" className="sci-btn-ghost text-xs w-fit">
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  {record.url.startsWith('/uploads/') ? 'Open the uploaded file' : record.doi ? `Open at doi.org/${record.doi}` : 'Open source link'}
                </a>
              )}

              <SeriesChart recordId={record.id} />
              <CitePanel recordId={record.id} />

              <OutreachPanel key={record.id} itemId={record.id} />
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-[#f8f9ff] border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500 truncate">NCPOR Polar Knowledge Repository</span>
          <div className="flex items-center gap-2">
            {record && (
              <button
                onClick={() => download(downloadUrls.metadata(record.id))}
                className="px-4 py-2 rounded-xl bg-[#00677d] hover:bg-[#004e5f] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">data_object</span>
                <span>Metadata</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-['JetBrains_Mono'] text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
