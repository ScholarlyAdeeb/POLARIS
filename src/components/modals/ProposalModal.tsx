import React from 'react';

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProposalModal: React.FC<ProposalModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const downloadTemplate = () => {
    const templateContent = `================================================================================
MINISTRY OF EARTH SCIENCES (MoES) - GOVERNMENT OF INDIA
NATIONAL CENTRE FOR POLAR AND OCEANIC RESEARCH (NCPOR), GOA
RESEARCH PROPOSAL TEMPLATE - 45TH ISEA & 19TH ARCTIC EXPEDITION
================================================================================

1. PROJECT TITLE:
2. PRINCIPAL INVESTIGATOR (PI) DETAILS:
   - Full Name:
   - Designation & Affiliation:
   - Email & Mobile:
   - Institutional Endorsement Certificate Ref:

3. TARGET OBSERVATIONAL PLATFORM:
   [ ] Bharati Research Station (Larsemann Hills)
   [ ] Maitri Base (Schirmacher Oasis)
   [ ] Himadri Station (Ny-Alesund, Svalbard)
   [ ] Himansh Observatory (Spiti Valley, Himalayas)
   [ ] ORV Sagar Nidhi / Sagar Kanya Oceanic Cruise

4. SCIENTIFIC OBJECTIVES & RELEVANCE TO NATIONAL POLAR PRIORITIES:
   - Executive Summary (max 300 words):
   - Teleconnections to Indian Monsoon / Climate Change:
   - Madrid Protocol Environmental Impact Assessment:

5. LOGISTICAL REQUIREMENTS:
   - Number of berthing berths requested:
   - Hazardous chemicals or radio-isotopes (if any):
   - Power & cargo weight allocation (kg):

6. DATA SHARING DECLARATION:
   Under MoES Open Data Policy, all curated datasets will be archived in the
   NCPOR Polar Data Centre within 12 months of voyage completion.
================================================================================`;
    const blob = new Blob([templateContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NCPOR_45th_ISEA_Proposal_Template.txt';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0b132b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#eff4ff] dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#00677d] text-white">
              <span className="material-symbols-outlined text-[20px]">assignment</span>
            </span>
            <div>
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                OPEN CALL FOR PROPOSALS
              </span>
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#0b1c30] dark:text-white mt-0.5">
                45th ISEA & 19th Arctic Expedition
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
        <div className="p-6 space-y-4 font-['Inter'] text-sm leading-relaxed text-[#0b1c30] dark:text-slate-200">
          <p>
            The National Centre for Polar and Oceanic Research (NCPOR), Ministry of Earth Sciences, invites research proposals from scientists, faculty, and research scholars of Indian universities and institutions for field campaigns at Bharati, Maitri, Himadri, and Southern Ocean cruises.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-['JetBrains_Mono'] text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Proposal Portal Opens:</span>
              <span className="font-bold text-[#00677d] dark:text-[#4cd6fb]">01 January 2025</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Final Submission Deadline:</span>
              <span className="font-bold text-red-600 dark:text-red-400">30 June 2025 (23:59 IST)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Medical & Pre-Antarctic Training:</span>
              <span className="font-bold">ITBP Auli (Uttarakhand) • September 2025</span>
            </div>
          </div>

          <h4 className="font-['Space_Grotesk'] font-bold text-xs uppercase text-slate-500">
            Eligibility & Compliance:
          </h4>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <li>Permanent faculty or regular scientific staff of recognized Indian universities or national research institutes.</li>
            <li>Adherence to Antarctic Treaty Environmental Protocol (Madrid Protocol 1991).</li>
            <li>Commitment to submit raw and processed datasets to the NCPOR Polar Data Centre.</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Download Template (.txt / .doc)</span>
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
  );
};
