import React from 'react';
import { NavTab } from '../types/polaris';

interface FooterProps {
  onNavigate: (tab: NavTab) => void;
  onSelectStation: (stationId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onSelectStation }) => {
  return (
    <footer className="w-full bg-[#f4f7fb] dark:bg-[#070c18] border-t border-slate-200/80 dark:border-slate-800 pt-12 pb-8 transition-colors font-['Inter']">
      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-8 pb-8 border-b border-slate-200/80 dark:border-slate-800">
          {/* Organization Bio */}
          <div className="max-w-md">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="font-['Space_Grotesk'] text-xl font-bold text-[#0b1c30] dark:text-white">
                POLARIS
              </span>
              <span className="font-['Space_Grotesk'] text-[10px] px-2 py-0.5 rounded bg-[#dce9ff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-bold">
                NCPOR NODE
              </span>
            </div>
            <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              National Centre for Polar and Oceanic Research (NCPOR), Ministry of Earth Sciences, Headland Sada, Vasco-da-Gama, Goa 403804, India.
            </p>
            <div className="flex items-center gap-2 text-[#10b981] font-['JetBrains_Mono'] text-xs">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>NCPOR Telemetry & Station Uplink Online</span>
            </div>
          </div>

          {/* Links Directory */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
            <div className="flex flex-col gap-2">
              <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#0b1c30] dark:text-white uppercase tracking-wider">
                EXPLORATION
              </span>
              <button
                onClick={() => { onNavigate('stations'); onSelectStation('bharati'); }}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Bharati Station
              </button>
              <button
                onClick={() => { onNavigate('stations'); onSelectStation('maitri'); }}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Maitri Base
              </button>
              <button
                onClick={() => { onNavigate('stations'); onSelectStation('himadri'); }}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Himadri (Svalbard)
              </button>
              <button
                onClick={() => { onNavigate('stations'); onSelectStation('himansh'); }}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Himansh (Spiti)
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#0b1c30] dark:text-white uppercase tracking-wider">
                REPOSITORIES
              </span>
              <button
                onClick={() => onNavigate('knowledge')}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Ice Core Vault
              </button>
              <button
                onClick={() => onNavigate('data')}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Ocean Sediment Core
              </button>
              <button
                onClick={() => onNavigate('map')}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Polar Geodesy Data
              </button>
              <button
                onClick={() => onNavigate('data')}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Cryo-Microbiome DB
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#0b1c30] dark:text-white uppercase tracking-wider">
                POLICIES
              </span>
              <a
                href="https://www.ats.aq"
                target="_blank"
                rel="noreferrer"
                className="text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white"
              >
                Antarctic Treaty System
              </a>
              <span className="text-slate-600 dark:text-slate-400">MoES Open Data Policy</span>
              <span className="text-slate-600 dark:text-slate-400">Environmental Protocol</span>
              <span className="text-slate-600 dark:text-slate-400">Scientific Permitting</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#0b1c30] dark:text-white uppercase tracking-wider">
                COMPLIANCE
              </span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">ISO 19115 / ISO 19139</span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">FGDC Compliant</span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">WMO-GOS Linked</span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">SCAR Registered Node</span>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 font-['JetBrains_Mono'] text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span>© 2026 Team Pehchaan · SIH 2026 prototype for NCPOR, MoES. Not an official Government of India website.</span>
            <span className="hidden md:inline">|</span>
            <span className="hidden md:inline">All Datasets CC-BY 4.0 International</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-semibold text-[11px]">
              PROVENANCE: NCPOR-NDC-V4.2
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
