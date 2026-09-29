import React, { useState } from 'react';
import { api, download, downloadUrls, type ProposalInput } from '../../lib/api';

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLATFORMS = [
  { id: 'bharati', label: 'Bharati Research Station (Larsemann Hills)' },
  { id: 'maitri', label: 'Maitri Station (Schirmacher Oasis)' },
  { id: 'himadri', label: 'Himadri Station (Ny-Ålesund, Svalbard)' },
  { id: 'himansh', label: 'Himansh Observatory (Spiti, Himalayas)' },
  { id: 'sagar-kanya', label: 'ORV Sagar Kanya cruise' },
  { id: 'sagar-nidhi', label: 'ORV Sagar Nidhi cruise' },
];

const EMPTY: ProposalInput = { title: '', piName: '', affiliation: '', email: '', platform: 'bharati', domain: '', summary: '', berths: 1 };

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-[#0b1c30] focus:outline-none focus:border-[#00b4d8] font-['Inter']";
const labelCls = "block font-['JetBrains_Mono'] text-[11px] font-bold text-slate-500 mb-1";

export const ProposalModal: React.FC<ProposalModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<'info' | 'form' | 'done'>('info');
  const [form, setForm] = useState<ProposalInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  if (!isOpen) return null;

  const words = form.summary.trim() ? form.summary.trim().split(/\s+/).length : 0;
  const set = (k: keyof ProposalInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: k === 'berths' ? (e.target.value ? Number(e.target.value) : null) : e.target.value });

  const close = () => {
    setView('info');
    setError('');
    if (view === 'done') setForm(EMPTY);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitProposal(form);
      setReference(res.reference);
      setView('done');
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#eff4ff]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#00677d] text-white">
              <span className="material-symbols-outlined text-[20px]">assignment</span>
            </span>
            <div>
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                OPEN CALL FOR PROPOSALS
              </span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] mt-0.5">
                46th ISEA & Upcoming Arctic Season
              </h3>
            </div>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-['Inter'] text-sm leading-relaxed text-[#0b1c30]">
          {view === 'info' && (
            <>
              <p>
                The National Centre for Polar and Ocean Research (NCPOR), Ministry of Earth Sciences, invites research proposals from scientists, faculty, and research scholars of Indian universities and institutions for field campaigns at Bharati, Maitri, Himadri, and Southern Ocean cruises.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-['JetBrains_Mono'] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Proposal Portal Opens:</span>
                  <span className="font-bold text-[#00677d]">To be announced</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Final Submission Deadline:</span>
                  <span className="font-bold text-red-600">To be announced</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Medical & Pre-Antarctic Training:</span>
                  <span className="font-bold">ITBP Auli (Uttarakhand) • dates TBA</span>
                </div>
              </div>

              <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase text-slate-500">Eligibility & Compliance:</h4>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                <li>Permanent faculty or regular scientific staff of recognized Indian universities or national research institutes.</li>
                <li>Adherence to Antarctic Treaty Environmental Protocol (Madrid Protocol 1991).</li>
                <li>Commitment to submit raw and processed datasets to the NCPOR Polar Data Centre.</li>
              </ul>
            </>
          )}

          {view === 'form' && (
            <form id="proposal-form" onSubmit={submit} className="space-y-3">
              <div>
                <label className={labelCls}>PROJECT TITLE *</label>
                <input required maxLength={200} value={form.title} onChange={set('title')} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>PRINCIPAL INVESTIGATOR *</label>
                  <input required maxLength={120} value={form.piName} onChange={set('piName')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>EMAIL *</label>
                  <input required type="email" maxLength={200} value={form.email} onChange={set('email')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>DESIGNATION & AFFILIATION *</label>
                <input required maxLength={200} value={form.affiliation} onChange={set('affiliation')} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>TARGET PLATFORM *</label>
                  <select value={form.platform} onChange={set('platform')} className={inputCls}>
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>BERTHS</label>
                  <input type="number" min={1} max={20} value={form.berths ?? ''} onChange={set('berths')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>SCIENCE DOMAIN</label>
                <input maxLength={80} placeholder="e.g. Glaciology, Atmospheric physics" value={form.domain} onChange={set('domain')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  EXECUTIVE SUMMARY * <span className={words > 300 ? 'text-red-600' : ''}>({words} / 300 words)</span>
                </label>
                <textarea required rows={5} maxLength={2500} value={form.summary} onChange={set('summary')} className={inputCls} />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>
          )}

          {view === 'done' && (
            <div className="py-6 text-center space-y-3">
              <span className="material-symbols-outlined text-[48px] text-emerald-500">task_alt</span>
              <h4 className="font-['Space_Grotesk'] font-bold text-lg">Proposal received</h4>
              <p className="text-sm text-slate-600">Quote this reference in all correspondence with NCPOR:</p>
              <p className="font-['JetBrains_Mono'] text-base font-bold text-[#00677d]">{reference}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => download(downloadUrls.proposalTemplate())}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Download Template (.txt)</span>
          </button>
          <div className="flex items-center gap-2">
            {view === 'info' && (
              <button
                onClick={() => setView('form')}
                className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                <span>Submit Online</span>
              </button>
            )}
            {view === 'form' && (
              <>
                <button
                  onClick={() => setView('info')}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-['JetBrains_Mono'] text-xs font-bold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="proposal-form"
                  disabled={submitting || words > 300}
                  className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] disabled:opacity-50 text-white font-['JetBrains_Mono'] text-xs font-bold shadow-md"
                >
                  {submitting ? 'Submitting…' : 'Submit Proposal'}
                </button>
              </>
            )}
            {view !== 'form' && (
              <button
                onClick={close}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-['JetBrains_Mono'] text-xs font-bold"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
