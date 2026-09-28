import React from 'react';
import { ScientificPaper } from '../../types/polaris';

interface PaperModalProps {
  paper: ScientificPaper | null;
  onClose: () => void;
  onOpenDataset?: (filename: string) => void;
}

export const PaperModal: React.FC<PaperModalProps> = ({ paper, onClose, onOpenDataset }) => {
  if (!paper) return null;

  const downloadBibtex = () => {
    const bibtex = `@article{ncpor_${paper.id},
  title = {${paper.title}},
  author = {${paper.authors}},
  journal = {${paper.journal}},
  year = {2024},
  doi = {${paper.doi}},
  publisher = {Ministry of Earth Sciences, Govt of India}
}`;
    const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citation-${paper.id}.bib`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-[#0b132b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#eff4ff] dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#00677d] text-white">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </span>
            <div>
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-surface-container text-[#00677d] font-bold">
                {paper.domain} • {paper.acceptedDate}
              </span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] dark:text-white mt-0.5">
                Peer-Reviewed Scientific Study
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
          <h2 className="font-['Space_Grotesk'] font-bold text-xl text-[#0b1c30] dark:text-white leading-snug">
            {paper.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 font-['JetBrains_Mono'] text-xs text-slate-500 dark:text-slate-400">
            <span>Journal: <strong className="text-slate-700 dark:text-slate-200">{paper.journal}</strong></span>
            <span>•</span>
            <span>Authors: <strong className="text-slate-700 dark:text-slate-200">{paper.authors}</strong></span>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] flex items-center justify-between">
            <span>DOI: https://doi.org/{paper.doi}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
              OPEN ACCESS
            </span>
          </div>

          <div>
            <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
              Abstract
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-[#f8f9ff] dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              {paper.abstract}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#00b4d8] text-[24px]">folder_zip</span>
              <div>
                <span className="font-['JetBrains_Mono'] font-bold text-xs block text-[#0b1c30] dark:text-white">
                  Supplementary Dataset: {paper.dataFile}
                </span>
                <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">
                  Size: {paper.fileSize} • NetCDF/CSV Format • MoES Data Policy CC-BY 4.0
                </span>
              </div>
            </div>
            <button
              onClick={() => onOpenDataset?.(paper.dataFile)}
              className="px-3 py-1.5 rounded-lg bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold transition-colors"
            >
              Inspect Data
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={downloadBibtex}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-['JetBrains_Mono'] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export BibTeX Citation</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => alert(`Simulated downloading full text PDF for "${paper.title}"`)}
              className="px-4 py-2 rounded-xl bg-[#00677d] hover:bg-[#004e5f] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>Download PDF</span>
            </button>
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
