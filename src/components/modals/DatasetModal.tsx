import React, { useEffect, useState } from 'react';
import { api, download, downloadUrls, type DatasetDetail } from '../../lib/api';
import { OutreachPanel } from './OutreachPanel';
import { DataStatusBadge } from '../ui';

interface DatasetModalProps {
  datasetName: string | null;
  onClose: () => void;
  onOpenRecord?: (id: string) => void;
  onAsk?: (question: string) => void;
  onDraft?: (itemId: string) => void;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({ datasetName, onClose, onOpenRecord, onAsk, onDraft }) => {
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!datasetName) return;
    let cancelled = false;
    setDataset(null);
    setError('');
    api
      .dataset(datasetName)
      .then((d) => !cancelled && setDataset(d))
      .catch((err) => !cancelled && setError(err?.status === 404 ? 'This dataset is not in the archive yet.' : 'The POLARIS API is unreachable.'));
    return () => {
      cancelled = true;
    };
  }, [datasetName]);

  if (!datasetName) return null;

  const stats = dataset
    ? [
        { label: 'FORMAT', value: dataset.meta.format || '—', accent: true },
        { label: 'SIZE (FULL PRODUCT)', value: dataset.meta.size || '—' },
        { label: 'DOWNLOADS', value: String(dataset.downloads) },
        { label: 'LICENSE', value: dataset.meta.license || 'CC-BY 4.0', green: true },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-[#0b132b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#eff4ff] dark:bg-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-[#00b4d8] text-white">
              <span className="material-symbols-outlined text-[20px]">dataset</span>
            </span>
            <div className="min-w-0">
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                POLARIS ARCHIVE{dataset ? ` • ${dataset.id}` : ''}
              </span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] dark:text-white mt-0.5 truncate">
                {dataset?.title ?? datasetName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-['Inter']">
          {error && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-200">
              {error}
            </div>
          )}
          {!dataset && !error && <div className="p-8 text-center text-sm text-slate-400">Loading dataset record…</div>}

          {dataset && (
            <>
              {dataset.summary && <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{dataset.summary}</p>}

              <div className="flex flex-wrap items-center gap-2">
                <DataStatusBadge status={dataset.dataStatus} />
                {dataset.provenance?.source && <span className="text-xs text-slate-500">Source: {dataset.provenance.source}</span>}
              </div>
              {dataset.meta.sample && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  SYNTHETIC SAMPLE EXTRACT. The download is generated from this record’s metadata and is not an NCPOR data product.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-['JetBrains_Mono'] text-xs">
                {stats.map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px]">{s.label}</span>
                    <span
                      className={`font-bold ${
                        s.green ? 'text-emerald-600' : s.accent ? 'text-[#00677d] dark:text-[#4cd6fb]' : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                  CF-1.8 NetCDF Metadata Header Structure
                </h4>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-['JetBrains_Mono'] text-xs leading-relaxed overflow-x-auto border border-slate-800">
                  {dataset.header}
                </pre>
              </div>

              {dataset.links.length > 0 && (
                <div>
                  <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Linked Records</h4>
                  <div className="flex flex-wrap gap-2">
                    {dataset.links.map((l) => (
                      <button
                        key={`${l.id}-${l.relation}`}
                        onClick={() => onOpenRecord?.(l.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#eff4ff] dark:bg-slate-800 font-['JetBrains_Mono'] text-[11px] text-[#00677d] dark:text-[#4cd6fb] hover:underline text-left"
                      >
                        {l.type}: {l.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <OutreachPanel itemId={dataset.id} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
            {dataset?.dataStatus === 'OFFICIAL' || dataset?.dataStatus === 'VERIFIED' ? 'Checked against its source by a POLARIS reviewer' : 'Not an official NCPOR data product'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!dataset) return;
                download(downloadUrls.dataset(dataset.id));
                setDataset({ ...dataset, downloads: dataset.downloads + 1 });
              }}
              disabled={!dataset}
              className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] disabled:opacity-50 text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download Dataset</span>
            </button>
            {dataset && onAsk && (
              <button onClick={() => onAsk(`What does the archive say about ${dataset.title}?`)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold">
                Ask assistant
              </button>
            )}
            {dataset && onDraft && (
              <button onClick={() => onDraft(dataset.id)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold">
                Draft outreach
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-['JetBrains_Mono'] text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
