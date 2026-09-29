import React, { useEffect, useState } from 'react';
import { api, download, downloadUrls, type DatasetDetail } from '../../lib/api';
import { OutreachPanel } from './OutreachPanel';
import { DataStatusBadge } from '../ui';
import { SeriesChart } from '../SeriesChart';
import { CitePanel } from '../CitePanel';

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

  const external = !!dataset && !dataset.meta.sample;
  const stats = !dataset
    ? []
    : external
    ? [
        { label: 'REGISTRY', value: dataset.meta.registry || dataset.provenance?.source || 'Contributor upload', accent: true },
        { label: 'DOI', value: dataset.doi || '—' },
        { label: 'COVERAGE', value: dataset.meta.temporalCoverage ? String(dataset.meta.temporalCoverage).replace('/', ' → ').replace(/T00:00:00/g, '') : String(dataset.year ?? '—') },
        { label: 'LICENSE', value: String(dataset.meta.license || dataset.provenance?.licence || '—').replace('https://creativecommons.org/licenses/', 'CC ').replace(/\/$/, ''), green: true },
      ]
    : [
        { label: 'FORMAT', value: dataset.meta.format || '—', accent: true },
        { label: 'SIZE (FULL PRODUCT)', value: dataset.meta.size || '—' },
        { label: 'DOWNLOADS', value: String(dataset.downloads) },
        { label: 'LICENSE', value: dataset.meta.license || 'CC-BY 4.0', green: true },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col bg-white rounded-none sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#eff4ff]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-[#00b4d8] text-white">
              <span className="material-symbols-outlined text-[20px]">dataset</span>
            </span>
            <div className="min-w-0">
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                POLARIS ARCHIVE{dataset ? ` • ${dataset.id}` : ''}
              </span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] mt-0.5 truncate">
                {dataset?.title ?? datasetName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-['Inter']">
          {error && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              {error}
            </div>
          )}
          {!dataset && !error && <div className="p-8 text-center text-sm text-slate-400">Loading dataset record…</div>}

          {dataset && (
            <>
              {dataset.summary && <p className="text-sm text-slate-700 leading-relaxed">{dataset.summary}</p>}

              <div className="flex flex-wrap items-center gap-2">
                <DataStatusBadge status={dataset.dataStatus} />
                {dataset.provenance?.source && <span className="text-xs text-slate-500">Source: {dataset.provenance.source}</span>}
              </div>
              {dataset.meta.sample && (
                <p className="text-xs text-amber-700">
                  SYNTHETIC SAMPLE EXTRACT. The download is generated from this record’s metadata and is not an NCPOR data product.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-['JetBrains_Mono'] text-xs">
                {stats.map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">{s.label}</span>
                    <span
                      className={`font-bold ${
                        s.green ? 'text-emerald-600' : s.accent ? 'text-[#00677d]' : 'text-slate-800'
                      }`}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              <SeriesChart recordId={dataset.id} />

              {dataset.header && (
                <div>
                  <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                    CF-1.8 NetCDF Metadata Header Structure
                  </h4>
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-['JetBrains_Mono'] text-xs leading-relaxed overflow-x-auto border border-slate-800">
                    {dataset.header}
                  </pre>
                </div>
              )}

              {dataset.links.length > 0 && (
                <div>
                  <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Linked Records</h4>
                  <div className="flex flex-wrap gap-2">
                    {dataset.links.map((l) => (
                      <button
                        key={`${l.id}-${l.relation}`}
                        onClick={() => onOpenRecord?.(l.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#eff4ff] font-['JetBrains_Mono'] text-[11px] text-[#00677d] hover:underline text-left"
                      >
                        {l.type}: {l.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <CitePanel recordId={dataset.id} />

              <OutreachPanel itemId={dataset.id} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
            {dataset?.dataStatus === 'OFFICIAL' || dataset?.dataStatus === 'VERIFIED'
              ? 'Checked against its source by a POLARIS reviewer'
              : dataset?.dataStatus === 'EXTERNAL'
              ? `Metadata from ${dataset.meta.registry ?? 'an open registry'}; data stays with the publisher`
              : 'Not an official NCPOR data product'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (!dataset) return;
                if (external && dataset.url && !dataset.url.startsWith('/uploads/')) window.open(dataset.url, '_blank', 'noopener');
                else download(downloadUrls.dataset(dataset.id));
                setDataset({ ...dataset, downloads: dataset.downloads + 1 });
              }}
              disabled={!dataset || (external && !dataset.url)}
              className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] disabled:opacity-50 text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">{external && dataset?.url && !dataset.url.startsWith('/uploads/') ? 'open_in_new' : 'download'}</span>
              <span>{external && dataset?.url && !dataset.url.startsWith('/uploads/') ? 'Get the data' : 'Download dataset'}</span>
            </button>
            {dataset && onAsk && (
              <button onClick={() => onAsk(`What does the archive say about ${dataset.title}?`)} className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold">
                Ask assistant
              </button>
            )}
            {dataset && onDraft && (
              <button onClick={() => onDraft(dataset.id)} className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold">
                Draft outreach
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
