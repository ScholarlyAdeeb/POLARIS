import React, { useState, useEffect } from 'react';
import { NavTab, ScientificPaper, SimulationMission } from '../types/polaris';
import { STATIONS_DATA, EXPEDITION_MILESTONES, SCIENTIFIC_PAPERS, SIMULATION_MISSIONS, VALUE_GRAPH_STEPS } from '../data/polarisData';

interface ExploreViewProps {
  onNavigate: (tab: NavTab) => void;
  onSelectStation: (stationId: string) => void;
  onOpenSimulation: (mission: SimulationMission) => void;
  onOpenPaper: (paper: ScientificPaper) => void;
  onOpenSkycam: () => void;
  onOpenProposal: () => void;
  onOpenDataset: (name: string) => void;
  onShowToast?: (message: string, title?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onNavigate,
  onSelectStation,
  onOpenSimulation,
  onOpenPaper,
  onOpenSkycam,
  onOpenProposal,
  onOpenDataset,
  onShowToast,
}) => {
  const [utcTime, setUtcTime] = useState('11:42:09 UTC');
  const [searchQuery, setSearchQuery] = useState('What atmospheric studies were conducted at Maitri in 2023?');
  const [activeGradeFilter, setActiveGradeFilter] = useState('All Tracks');
  const [activeLayer, setActiveLayer] = useState<'stations' | 'expeditions' | 'datasets' | 'atmospheric'>('stations');
  const [selectedMilestone, setSelectedMilestone] = useState(2026);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const samplePrompts = [
    'Bharati station architectural heat-recovery efficiency',
    'Himadri glacier ablation rate trends 2015-2024',
    'Southern Ocean microplastic concentration transects',
    'Maitri Lake Priyadarshini water chemistry variations',
  ];

  return (
    <div className="w-full flex flex-col font-['Inter']">
      {/* SECTION 1: CINEMATIC POLAR HERO */}
      <section className="relative w-full overflow-hidden bg-[#eff4ff] dark:bg-[#0c162c] pb-10 transition-colors">
        {/* Ambient cartographic linework overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg className="w-full h-full stroke-slate-300 dark:stroke-slate-700 fill-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="auroraGlow" cx="65%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.18" />
                <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.08" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#auroraGlow)" />
            <circle cx="82%" cy="40%" r="180" strokeDasharray="4 8" strokeWidth="1" />
            <circle cx="82%" cy="40%" r="320" strokeDasharray="3 6" strokeWidth="1" />
            <circle cx="82%" cy="40%" r="480" strokeDasharray="2 10" strokeWidth="0.8" />
            <line x1="82%" y1="0%" x2="82%" y2="100%" strokeDasharray="4 6" strokeWidth="0.8" />
            <line x1="40%" y1="40%" x2="100%" y2="40%" strokeDasharray="4 6" strokeWidth="0.8" />
          </svg>
        </div>

        <div className="relative w-full max-w-[1440px] mx-auto px-4 md:px-8 pt-6">
          {/* Top Institutional Provenance Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-800 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(148,163,184,0.18)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-ping"></span>
              <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#1c2541] dark:text-slate-200 tracking-wider">
                NCPOR OFFICIAL SCIENTIFIC KNOWLEDGE REPOSITORY • MoES GOVT OF INDIA
              </span>
            </div>

            <div className="hidden md:flex items-center gap-4 font-['JetBrains_Mono'] text-xs text-slate-500 dark:text-slate-400">
              <span>UTC TIME: <strong className="text-[#0b1c30] dark:text-white">{utcTime}</strong></span>
              <span>•</span>
              <span>ANTARCTIC SUN: <strong className="text-[#0b1c30] dark:text-white">24h POLAR DAY (SUMMER)</strong></span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-semibold">
                ISO 19115 COMPLIANT
              </span>
            </div>
          </div>

          {/* Hero Grid: Narrative (7 cols) + Visual Telemetry Stack (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Narrative Column */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-4 rounded-md bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-['JetBrains_Mono'] text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px]">public</span>
                ARCTIC • ANTARCTICA • HIMALAYAS • SOUTHERN OCEAN
              </div>

              <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-[#0b132b] dark:text-white tracking-tight mb-4 font-bold leading-tight">
                Explore India’s Science at the <span className="text-[#00677d] dark:text-[#00b4d8]">Ends of the Earth.</span>
              </h1>

              <p className="font-['Inter'] text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mb-8 leading-relaxed">
                Discover expeditions, research stations, scientific datasets, publications and stories from India’s polar missions across Antarctica, the Arctic, the Himalayas/Third Pole, and the Southern Ocean.
              </p>

              {/* Primary CTAs */}
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto mb-8">
                <button
                  onClick={() => onNavigate('map')}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold shadow-md hover:shadow-lg transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">explore</span>
                  <span>EXPLORE THE POLAR MAP</span>
                </button>

                <button
                  onClick={() => {
                    onNavigate('stations');
                    onSelectStation('bharati');
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.95),4px_4px_12px_rgba(148,163,184,0.22)] hover:bg-[#eff4ff] dark:hover:bg-slate-700 text-[#0b132b] dark:text-white font-['JetBrains_Mono'] text-xs font-bold transition-all"
                >
                  <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[20px]">travel_explore</span>
                  <span>START A VIRTUAL EXPEDITION</span>
                </button>

              </div>

              {/* Live Coordinate Footprint Badges */}
              <div className="w-full pt-2">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">
                  PERMANENT OBSERVATIONAL SITES • REAL-TIME EPHEMERIS
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div
                    onClick={() => { onNavigate('stations'); onSelectStation('maitri'); }}
                    className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-sm cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                  >
                    <span className="block font-['Space_Grotesk'] text-[10px] font-bold text-[#00677d] dark:text-[#4cd6fb]">
                      MAITRI (ANTARCTICA)
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[11px] text-slate-700 dark:text-slate-300 block truncate">
                      70°45′57″S 11°44′09″E
                    </span>
                  </div>

                  <div
                    onClick={() => { onNavigate('stations'); onSelectStation('bharati'); }}
                    className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-sm cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                  >
                    <span className="block font-['Space_Grotesk'] text-[10px] font-bold text-[#00677d] dark:text-[#4cd6fb]">
                      BHARATI (ANTARCTICA)
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[11px] text-slate-700 dark:text-slate-300 block truncate">
                      69°24′29″S 76°11′14″E
                    </span>
                  </div>

                  <div
                    onClick={() => { onNavigate('stations'); onSelectStation('himadri'); }}
                    className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-sm cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                  >
                    <span className="block font-['Space_Grotesk'] text-[10px] font-bold text-[#00677d] dark:text-[#4cd6fb]">
                      HIMADRI (ARCTIC)
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[11px] text-slate-700 dark:text-slate-300 block truncate">
                      78°55′N 11°56′E
                    </span>
                  </div>

                  <div
                    onClick={() => { onNavigate('stations'); onSelectStation('himansh'); }}
                    className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-sm cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                  >
                    <span className="block font-['Space_Grotesk'] text-[10px] font-bold text-[#00677d] dark:text-[#4cd6fb]">
                      HIMANSH (HIMALAYAS)
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[11px] text-slate-700 dark:text-slate-300 block truncate">
                      32°24′N 77°42′E
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Column: Bharati Station & Floating Telemetry */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0">
              <div className="relative rounded-3xl overflow-hidden shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),8px_8px_24px_rgba(148,163,184,0.3)] bg-white dark:bg-slate-800 p-2">
                <div className="relative w-full h-[380px] sm:h-[420px] rounded-2xl overflow-hidden group">
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt="Bharati Antarctic Research Station in Larsemann Hills"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCh5gLUawjsStKcJIsNpQekm481MPzFnwd28EOAiV27WkCZLGHbXb9DB5C2KlKsntiosguAhz0er_fmHv3H9uu-LT9RQOOEMGTElk1aCX4vo6uZsbOdFX6_KxnZaDGrVZ28drBnNIoVZi_wp67bCzsGWnp51ERvVdSmo2HtdtO5Eua8BtXG_mgXUYMC-f3Vevj4TZEGpyPogBO-PW5AnWTezpIZcYvUJz7bC5PAdVj-ZnkVU7ihud_1CA"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b132b]/85 via-transparent to-transparent"></div>

                  {/* Overlaid HUD Top Tag */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <button
                      onClick={onOpenSkycam}
                      className="px-3 py-1 rounded-full bg-[#0b132b]/80 backdrop-blur-md text-white font-['JetBrains_Mono'] text-xs flex items-center gap-1.5 hover:bg-[#0b132b]"
                    >
                      <span className="material-symbols-outlined text-[#10b981] text-[15px]">videocam</span>
                      <span>LIVE SKYCAM • BHARATI BASE</span>
                    </button>
                    <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 text-[#0b132b] dark:text-white font-['JetBrains_Mono'] text-xs font-bold">
                      45th ISEA WINTER TEAM
                    </span>
                  </div>

                  {/* Overlaid Bottom Telemetry Card */}
                  <div className="absolute bottom-3 left-3 right-3 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#00b4d8] text-[20px]">satellite_alt</span>
                        <span className="font-['Space_Grotesk'] text-sm font-bold text-[#0b132b] dark:text-white">
                          Bharati Station Telemetry
                        </span>
                      </div>
                      <span className="font-['Space_Grotesk'] text-[10px] px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] font-bold">
                        UPLINK NOMINAL
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-['JetBrains_Mono'] text-xs">
                      <div className="p-2 rounded-lg bg-[#f4f7fb] dark:bg-slate-800">
                        <span className="text-slate-400 block text-[10px]">TEMP</span>
                        <span className="font-bold text-[#00677d] dark:text-[#4cd6fb]">-14.2°C</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#f4f7fb] dark:bg-slate-800">
                        <span className="text-slate-400 block text-[10px]">WIND SP</span>
                        <span className="font-bold text-slate-800 dark:text-white">24.6 kt</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#f4f7fb] dark:bg-slate-800">
                        <span className="text-slate-400 block text-[10px]">BARO</span>
                        <span className="font-bold text-slate-800 dark:text-white">987 hPa</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Floating Card: Research Vessel Track */}
              <div className="absolute -bottom-6 -left-6 hidden sm:flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),6px_6px_18px_rgba(148,163,184,0.22)] max-w-xs border border-slate-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl bg-[#e5eeff] dark:bg-slate-700 flex items-center justify-center text-[#00677d] dark:text-[#4cd6fb]">
                  <span className="material-symbols-outlined text-[24px]">directions_boat</span>
                </div>
                <div>
                  <span className="font-['Space_Grotesk'] text-[10px] text-slate-400 block uppercase font-bold">
                    RESEARCH VESSEL TRACK
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-slate-800 dark:text-white block">
                    ORV Sagar Nidhi / Cruise 148
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[11px] text-[#00b4d8] block">
                    Lat 54°12'S • Long 57°40'E
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FOUR POLAR FRONTIERS STATUS MATRIX */}
      <section className="w-full py-10 bg-white dark:bg-[#0b132b] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[22px]">sensors</span>
              <h2 className="font-['Space_Grotesk'] text-lg md:text-xl text-[#0b132b] dark:text-white font-bold">
                Four Polar Frontiers Status Matrix
              </h2>
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-bold">
                [LIVE TELEMETRY]
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 font-['JetBrains_Mono'] text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>4 / 4 Observational Stations Synchronized</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Antarctica */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-3px_-3px_10px_rgba(255,255,255,0.9),3px_3px_12px_rgba(148,163,184,0.15)] hover:shadow-[-4px_-4px_14px_rgba(255,255,255,1),4px_4px_16px_rgba(0,180,216,0.2)] transition-all flex flex-col justify-between border border-slate-200/60 dark:border-slate-700/80">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-['Space_Grotesk'] text-[11px] text-[#00677d] dark:text-[#4cd6fb] font-bold tracking-wider">
                    ANTARCTICA
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> ACTIVE
                  </span>
                </div>
                <h3 className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-1.5">
                  Maitri & Bharati
                </h3>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed line-clamp-2">
                  45th Indian Scientific Expedition to Antarctica (ISEA) underway. Paleoclimatology & geomagnetic surveys.
                </p>
              </div>

              <div>
                <div className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900/80 mb-3 font-['JetBrains_Mono'] text-xs flex items-center justify-between border border-slate-200/50 dark:border-slate-800">
                  <span className="text-slate-500">Temp: <strong className="text-[#0b1c30] dark:text-white">-14.2°C</strong></span>
                  <span className="text-slate-500">Wind: <strong className="text-[#0b1c30] dark:text-white">18 kts</strong></span>
                  <span className="text-[#00677d] dark:text-[#4cd6fb] font-bold">1,420 DS</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">Schirmacher & Larsemann</span>
                  <button
                    onClick={() => { onNavigate('stations'); onSelectStation('bharati'); }}
                    className="font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    Inspect <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Arctic Realm */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-3px_-3px_10px_rgba(255,255,255,0.9),3px_3px_12px_rgba(148,163,184,0.15)] hover:shadow-[-4px_-4px_14px_rgba(255,255,255,1),4px_4px_16px_rgba(0,180,216,0.2)] transition-all flex flex-col justify-between border border-slate-200/60 dark:border-slate-700/80">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-['Space_Grotesk'] text-[11px] text-[#00b4d8] font-bold tracking-wider">
                    ARCTIC REALM
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> ACTIVE
                  </span>
                </div>
                <h3 className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-1.5">
                  Himadri Base
                </h3>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed line-clamp-2">
                  Ny-Ålesund, Svalbard. Arctic expeditions investigating fjord hydrography & atmospheric aerosol loading.
                </p>
              </div>

              <div>
                <div className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900/80 mb-3 font-['JetBrains_Mono'] text-xs flex items-center justify-between border border-slate-200/50 dark:border-slate-800">
                  <span className="text-slate-500">Temp: <strong className="text-[#0b1c30] dark:text-white">-7.8°C</strong></span>
                  <span className="text-slate-500">Array: <strong className="text-[#0b1c30] dark:text-white">ONLINE</strong></span>
                  <span className="text-[#00677d] dark:text-[#4cd6fb] font-bold">580 DS</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">Kongsfjorden Array</span>
                  <button
                    onClick={() => { onNavigate('stations'); onSelectStation('himadri'); }}
                    className="font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    Inspect <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Himalayas / Third Pole */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_12px_rgba(255,255,255,0.9),4px_4px_14px_rgba(148,163,184,0.18)] hover:shadow-[-5px_-5px_15px_rgba(255,255,255,1),5px_5px_18px_rgba(0,180,216,0.2)] transition-all flex flex-col justify-between border border-slate-100 dark:border-slate-700">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-['Space_Grotesk'] text-[11px] text-[#545d7c] dark:text-slate-300 font-bold tracking-wider">
                    HIMALAYAS / THIRD POLE
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> ACTIVE
                  </span>
                </div>
                <h3 className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-1">
                  Himansh Observatory
                </h3>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                  Spiti Valley (4,080m MSL). Cryosphere dynamics, Chandra basin glacier mass budget, and hydrological runoffs.
                </p>
              </div>

              <div>
                <div className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900 mb-3 font-['JetBrains_Mono'] text-xs flex items-center justify-between">
                  <span className="text-slate-500">Temp: <strong className="text-[#0b1c30] dark:text-white">-3.1°C</strong></span>
                  <span className="text-slate-500">Melt: <strong className="text-[#0b1c30] dark:text-white">0.02 m/d</strong></span>
                  <span className="text-[#00677d] dark:text-[#4cd6fb] font-bold">390 Datasets</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">Himachal Pradesh</span>
                  <button
                    onClick={() => { onNavigate('stations'); onSelectStation('himansh'); }}
                    className="font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    Inspect <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Southern Ocean */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_12px_rgba(255,255,255,0.9),4px_4px_14px_rgba(148,163,184,0.18)] hover:shadow-[-5px_-5px_15px_rgba(255,255,255,1),5px_5px_18px_rgba(0,180,216,0.2)] transition-all flex flex-col justify-between border border-slate-100 dark:border-slate-700">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-['Space_Grotesk'] text-[11px] text-[#1c2541] dark:text-slate-300 font-bold tracking-wider">
                    SOUTHERN OCEAN
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> TRANSECT
                  </span>
                </div>
                <h3 className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-1">
                  ORV Sagar Kanya
                </h3>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                  Deep-sea biogeochemistry transect between 40°S and 65°S. Phytoplankton blooms and oceanic CO2 sequestration.
                </p>
              </div>

              <div>
                <div className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900 mb-3 font-['JetBrains_Mono'] text-xs flex items-center justify-between">
                  <span className="text-slate-500">SST: <strong className="text-[#0b1c30] dark:text-white">1.8°C</strong></span>
                  <span className="text-slate-500">Salinity: <strong className="text-[#0b1c30] dark:text-white">34 PSU</strong></span>
                  <span className="text-[#00677d] dark:text-[#4cd6fb] font-bold">820 Datasets</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">Subtropical Front</span>
                  <button
                    onClick={() => { onNavigate('stations'); onSelectStation('sagar-kanya'); }}
                    className="font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    Inspect <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: FLAGSHIP INTERACTIVE POLAR MAP TEASER */}
      <section className="w-full bg-[#eff4ff] dark:bg-[#0c162c] py-12 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 font-['Space_Grotesk'] text-[11px] text-[#00677d] dark:text-[#4cd6fb] font-bold mb-1">
                <span className="material-symbols-outlined text-[16px]">public</span>
                GEOSPATIAL OBSERVATORY
              </div>
              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl text-[#0b132b] dark:text-white font-bold tracking-tight">
                Polar Stereographic Knowledge Map
              </h2>
              <p className="font-['Inter'] text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                Simultaneous multi-spectral layer explorer integrating telemetry, station twins, expedition paths, and oceanic CTD casts.
              </p>
            </div>

            {/* Layer Toggles Control Ribbon */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveLayer('stations')}
                className={`px-3 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeLayer === 'stations' ? 'bg-[#00677d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">home_pin</span> Stations
              </button>
              <button
                onClick={() => setActiveLayer('expeditions')}
                className={`px-3 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeLayer === 'expeditions' ? 'bg-[#00677d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">route</span> Expeditions
              </button>
              <button
                onClick={() => setActiveLayer('datasets')}
                className={`px-3 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeLayer === 'datasets' ? 'bg-[#00677d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">dataset</span> Datasets
              </button>
              <button
                onClick={() => setActiveLayer('atmospheric')}
                className={`px-3 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeLayer === 'atmospheric' ? 'bg-[#00677d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">cloud</span> Atmospheric
              </button>
            </div>
          </div>

          {/* Map Viewport Container */}
          <div className="relative w-full rounded-3xl overflow-hidden shadow-[-6px_-6px_20px_rgba(255,255,255,0.95),6px_6px_24px_rgba(148,163,184,0.25)] bg-white dark:bg-slate-800 p-2 mb-8">
            <div
              className="relative w-full h-[480px] rounded-2xl bg-cover bg-center overflow-hidden"
              style={{
                backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuD-aIGElDvyHjpx5r_hSeOMrjKng7LPVituzuFzSbl-AUCrcJLhfSqjnAz7j2VUTTB9YB6abLP2qC5ULnrRvctH65uBSDrEIDQi0LdBYtENVvEoM8-hYUJM4W9tJV53JtDJA9yKuxV5tbivf0WCFydexZGEl5cIiFYQObbrF_OPlcAzousJckBEGDR8-zbKwQ_KpfcY4Ff1oDzmxayRMxGGIGxYfBqqVlHfMxwIKbrh6onkozxUXlpKIQ')`,
              }}
            >
              {/* Map Internal HUD Header */}
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-10">
                <div className="px-3.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md text-[#0b132b] dark:text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[18px]">adjust</span>
                  <span>POLAR STEREOGRAPHIC (EPSG: 3031)</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-500 font-['JetBrains_Mono'] text-xs">
                  GRID SCALE: 1 : 25,000,000
                </div>
              </div>

              {/* Overlaid SVG Flight & Cruise Paths */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none fill-none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 850 40 Q 720 180 620 320 T 480 390" stroke="#00b4d8" strokeDasharray="6 6" strokeWidth="2.5" />
                <path d="M 340 370 Q 420 340 480 390" stroke="#8b5cf6" strokeDasharray="3 3" strokeWidth="2" />
              </svg>

              {/* Marker 1: Bharati */}
              <div
                onClick={() => { onNavigate('stations'); onSelectStation('bharati'); }}
                className="absolute top-[68%] left-[48%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full bg-[#00677d]/30 animate-ping absolute"></span>
                  <span className="w-5 h-5 rounded-full bg-[#00677d] text-white flex items-center justify-center shadow-lg border-2 border-white">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                  </span>
                </div>
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl text-[#0b132b] dark:text-white border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-['Space_Grotesk'] text-sm font-bold">Bharati Station</span>
                    <span className="font-['Space_Grotesk'] text-[9px] px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div className="font-['JetBrains_Mono'] text-[11px] text-slate-500 mb-2">
                    69°24′29″S 76°11′14″E • Larsemann Hills
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] mb-2 font-['JetBrains_Mono']">
                    <span>Elev: <strong>35 m</strong></span>
                    <span>Crew: <strong>24 / 47</strong></span>
                  </div>
                  <div className="text-center font-['JetBrains_Mono'] text-xs font-bold text-[#00b4d8]">
                    Launch 3D Virtual Twin →
                  </div>
                </div>
              </div>

              {/* Marker 2: Maitri */}
              <div
                onClick={() => { onNavigate('stations'); onSelectStation('maitri'); }}
                className="absolute top-[64%] left-[34%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full bg-[#00b4d8]/30 animate-pulse absolute"></span>
                  <span className="w-5 h-5 rounded-full bg-[#00b4d8] text-white flex items-center justify-center shadow-lg border-2 border-white">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                  </span>
                </div>
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl text-[#0b132b] dark:text-white border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-['Space_Grotesk'] text-sm font-bold">Maitri Station</span>
                    <span className="font-['Space_Grotesk'] text-[9px] px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div className="font-['JetBrains_Mono'] text-[11px] text-slate-500 mb-2">
                    70°45′57″S 11°44′09″E • Schirmacher Oasis
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] mb-2 font-['JetBrains_Mono']">
                    <span>Lake Priyadarshini: <strong>Online</strong></span>
                    <span>Crew: <strong>25</strong></span>
                  </div>
                  <div className="text-center font-['JetBrains_Mono'] text-xs font-bold text-[#00b4d8]">
                    Inspect Sensor Stream →
                  </div>
                </div>
              </div>

              {/* Marker 3: Dakshin Gangotri */}
              <div
                onClick={() => { onNavigate('stations'); onSelectStation('dakshin-gangotri'); }}
                className="absolute top-[58%] left-[31%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
              >
                <span className="w-4 h-4 rounded-full bg-slate-500 text-white flex items-center justify-center shadow-md border border-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                </span>
              </div>

              {/* Fullscreen Map CTA Button */}
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => onNavigate('map')}
                  className="px-4 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md hover:bg-white text-[#00677d] dark:text-[#4cd6fb] font-['JetBrains_Mono'] text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <span>Open Full Geospatial Suite</span>
                  <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                </button>
              </div>
            </div>

            {/* Historical Expedition Scrubber / Timeline Strip */}
            <div className="mt-3 p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <span className="font-['Space_Grotesk'] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  FOUR DECADES OF INDIAN POLAR DISCOVERY TIMELINE
                </span>
                <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#00677d] dark:text-[#4cd6fb]">
                  1981 — 2026 (45 Antarctic Expeditions)
                </span>
              </div>

              {/* Timeline Rail */}
              <div className="relative w-full flex items-center justify-between pt-1">
                <div className="absolute left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 -z-0"></div>
                {EXPEDITION_MILESTONES.map((m) => {
                  const isSelected = selectedMilestone === m.year;
                  return (
                    <button
                      key={m.year}
                      onClick={() => setSelectedMilestone(m.year)}
                      className="relative z-10 flex flex-col items-center group focus:outline-none"
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-transform ${
                          isSelected
                            ? 'bg-[#10b981] scale-125 ring-4 ring-[#10b981]/25'
                            : 'bg-white dark:bg-slate-800 border-2 border-[#00677d] group-hover:scale-110'
                        }`}
                      ></div>
                      <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-[#0b132b] dark:text-white mt-1">
                        {m.year}
                      </span>
                      <span className="font-['Space_Grotesk'] text-[9px] text-slate-500 hidden sm:block">
                        {m.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE POLARIS VALUE GRAPH PIPELINE */}
      <section className="w-full py-12 bg-white dark:bg-[#0b132b] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="font-['Space_Grotesk'] text-xs font-bold text-[#00677d] dark:text-[#4cd6fb] tracking-widest block mb-2 uppercase">
              THE POLARIS VALUE GRAPH
            </span>
            <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl text-[#0b132b] dark:text-white font-bold tracking-tight mb-2">
              Connected Scientific Knowledge Architecture
            </h2>
            <p className="font-['Inter'] text-sm text-slate-600 dark:text-slate-300">
              See how a raw photographic expedition observation cascades seamlessly into open scientific datasets, peer-reviewed literature, and educational simulations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {VALUE_GRAPH_STEPS.map((step) => (
              <div
                key={step.step}
                className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-3px_-3px_10px_rgba(255,255,255,0.9),3px_3px_10px_rgba(148,163,184,0.15)] flex flex-col justify-between border border-slate-100 dark:border-slate-700"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-[#e5eeff] dark:bg-slate-700 flex items-center justify-center text-[#00677d] dark:text-[#4cd6fb] mb-3 font-['JetBrains_Mono'] font-bold text-xs">
                    {step.step}
                  </div>
                  <span className={`font-['Space_Grotesk'] text-[10px] font-bold block ${step.color}`}>
                    {step.phase}
                  </span>
                  <h4 className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-1">
                    {step.title}
                  </h4>
                  <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 leading-normal mb-3">
                    {step.desc}
                  </p>
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-slate-500 bg-[#f4f7fb] dark:bg-slate-900 p-1.5 rounded-lg text-center block">
                  {step.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: POLAR ARCHIVE SEARCH */}
      <section className="w-full bg-[#eff4ff] dark:bg-[#0c162c] py-12 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-slate-800 shadow-[-8px_-8px_24px_rgba(255,255,255,0.95),8px_8px_24px_rgba(148,163,184,0.22)] border border-slate-100 dark:border-slate-700">
            <div className="max-w-2xl mb-6">
              <div className="inline-flex items-center gap-1.5 font-['Space_Grotesk'] text-[11px] text-[#8b5cf6] font-bold mb-1">
                <span className="material-symbols-outlined text-[16px]">manage_search</span>
                POLAR ARCHIVE SEARCH
              </div>
              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl text-[#0b132b] dark:text-white font-bold">
                Search Across 40+ Years of Polar Data
              </h2>
              <p className="font-['Inter'] text-sm text-slate-600 dark:text-slate-300">
                Search meteorological records, sediment cores, satellite imagery, expedition journals, and station logs by keyword, place, or year.
              </p>
            </div>

            {/* Recessed Search Terminal */}
            <div className="p-2 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 shadow-[inset_2px_2px_6px_rgba(148,163,184,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.85)] mb-4">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="flex items-center gap-2 w-full px-3 py-2">
                  <span className="material-symbols-outlined text-slate-400 text-[22px]">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by keyword, coordinates, ice core sample ID, or expedition..."
                    className="bg-transparent w-full text-[#0b132b] dark:text-white font-['Inter'] text-sm focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end px-2">
                  <button
                    onClick={() => onShowToast?.('Multispectral GeoTIFF and remote sensing sample upload staging area initialized.', 'TIFF SATELLITE INGEST', 'info')}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-slate-400 hover:text-[#00b4d8] transition-colors"
                    title="Upload Satellite TIFF"
                  >
                    <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                  </button>
                  <button
                    onClick={() => onNavigate('map')}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-slate-400 hover:text-[#00b4d8]"
                    title="Input Lat/Long Coordinates"
                  >
                    <span className="material-symbols-outlined text-[20px]">pin_drop</span>
                  </button>
                  <button
                    onClick={() => onNavigate('knowledge')}
                    className="px-5 py-2.5 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>SEARCH</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sample Prompts */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="font-['Space_Grotesk'] text-[10px] text-slate-400 uppercase font-bold mr-1">
                SUGGESTED SEARCHES:
              </span>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchQuery(p)}
                  className="px-3 py-1 rounded-full bg-white dark:bg-slate-700 hover:bg-[#e5eeff] dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-['JetBrains_Mono'] text-[11px] shadow-sm flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8]"></span>
                  "{p}"
                </button>
              ))}
            </div>

            {/* Linked Records Preview */}
            <div className="p-5 rounded-2xl bg-[#eff4ff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[18px]">link</span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#00677d] dark:text-[#4cd6fb]">
                    LINKED RECORDS • MAITRI STATION • 2023
                  </span>
                </div>
                <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">
                  SAMPLE RECORDS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  onClick={() => onOpenPaper(SCIENTIFIC_PAPERS[0])}
                  className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-start gap-2.5 cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                >
                  <span className="material-symbols-outlined text-[#00677d] text-[20px]">description</span>
                  <div className="min-w-0">
                    <span className="font-['Space_Grotesk'] text-[9px] text-slate-400 uppercase font-bold block">
                      EXPEDITION REPORT
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-slate-800 dark:text-white block truncate">
                      ISEA-42 Atmospheric Bulletin
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#00b4d8]">
                      Sample record
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => onOpenDataset('NCPOR-MET-2023-042')}
                  className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-start gap-2.5 cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                >
                  <span className="material-symbols-outlined text-[#00b4d8] text-[20px]">database</span>
                  <div className="min-w-0">
                    <span className="font-['Space_Grotesk'] text-[9px] text-slate-400 uppercase font-bold block">
                      NCPOR DATASET
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-slate-800 dark:text-white block truncate">
                      Maitri AOD Radiometry 2023
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#00b4d8]">
                      NCPOR-MET-2023-042
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => onShowToast?.('Archival expedition logbook opened: 42nd ISEA voyage manifests (sample record).', 'ARCHIVAL EXPEDITION LOG', 'success')}
                  className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-start gap-2.5 cursor-pointer hover:border-[#00b4d8] border border-transparent transition-all"
                >
                  <span className="material-symbols-outlined text-[#545d7c] text-[20px]">photo_library</span>
                  <div className="min-w-0">
                    <span className="font-['Space_Grotesk'] text-[9px] text-slate-400 uppercase font-bold block">
                      ARCHIVAL EXPEDITION LOG
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-slate-800 dark:text-white block truncate">
                      42nd ISEA Voyage Logbook
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">
                      MoES Expedition Vault
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: POLAR ACADEMY & INTERACTIVE SIMULATIONS */}
      <section className="w-full py-12 bg-white dark:bg-[#0b132b] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="font-['Space_Grotesk'] text-xs font-bold text-[#00677d] dark:text-[#4cd6fb] tracking-widest block mb-1 uppercase">
                POLAR ACADEMY & CITIZEN GLACIOLOGY
              </span>
              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl text-[#0b132b] dark:text-white font-bold">
                Interactive Simulations & Student Missions
              </h2>
              <p className="font-['Inter'] text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                Immersive challenges designed by NCPOR researchers to bridge textbook science with real polar survival, logistics, and climate discovery.
              </p>
            </div>

            {/* Grade Filters */}
            <div className="flex flex-wrap items-center gap-1.5 font-['JetBrains_Mono'] text-xs">
              {['All Tracks', 'Grades 6–8', 'Grades 9–10', 'Grades 11–12', 'Undergrad / Research'].map((grade) => (
                <button
                  key={grade}
                  onClick={() => setActiveGradeFilter(grade)}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                    activeGradeFilter === grade
                      ? 'bg-[#00677d] text-white shadow-xs'
                      : 'bg-[#eff4ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SIMULATION_MISSIONS.map((mission) => (
              <div
                key={mission.id}
                className="group rounded-3xl overflow-hidden bg-white dark:bg-slate-800 shadow-[-5px_-5px_15px_rgba(255,255,255,0.9),5px_5px_15px_rgba(148,163,184,0.18)] flex flex-col justify-between border border-slate-100 dark:border-slate-700 transition-all hover:scale-[1.01]"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={mission.imageUrl}
                    alt={mission.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-[#00677d] dark:text-[#4cd6fb] font-['Space_Grotesk'] text-[10px] font-bold">
                    {mission.category}
                  </span>
                  <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-[#0b132b]/80 backdrop-blur-md text-white font-['JetBrains_Mono'] text-[10px]">
                    {mission.duration}
                  </span>
                </div>

                <div className="p-5 flex flex-col flex-grow justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 font-['JetBrains_Mono'] text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb] font-semibold">
                        {mission.grades}
                      </span>
                      <span className="text-slate-400">• {mission.subtopic}</span>
                    </div>

                    <h3 className="font-['Space_Grotesk'] text-base font-bold text-[#0b132b] dark:text-white mb-2">
                      {mission.title}
                    </h3>

                    <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                      {mission.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="font-['JetBrains_Mono'] text-xs text-[#00b4d8] font-bold">
                      {mission.rating} • {mission.studentsCount}
                    </span>
                    <button
                      onClick={() => onOpenSimulation(mission)}
                      className="px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold transition-colors shadow-sm"
                    >
                      Launch Mission
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7: DATA PUBLICATION VAULT & EXPEDITION MEDIA */}
      <section className="w-full bg-[#eff4ff] dark:bg-[#0c162c] py-12 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="font-['Space_Grotesk'] text-xs font-bold text-[#00677d] dark:text-[#4cd6fb] tracking-widest block mb-1 uppercase">
                DATA PUBLICATION VAULT
              </span>
              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl text-[#0b132b] dark:text-white font-bold">
                Recent Publications & Expedition Media
              </h2>
              <p className="font-['Inter'] text-sm text-slate-600 dark:text-slate-300">
                Validated scientific contributions released under the Ministry of Earth Sciences Open Data Policy.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 font-['JetBrains_Mono'] text-xs shadow-sm">
              SOURCE: NCPOR POLAR DATA CENTRE • OPEN ACCESS
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Papers (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {SCIENTIFIC_PAPERS.slice(0, 3).map((paper) => (
                <div
                  key={paper.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-[-3px_-3px_10px_rgba(255,255,255,0.9),3px_3px_10px_rgba(148,163,184,0.18)] hover:shadow-[-4px_-4px_12px_rgba(255,255,255,1),4px_4px_14px_rgba(0,180,216,0.18)] transition-all border border-slate-100 dark:border-slate-700 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-['Space_Grotesk'] text-[10px] px-2 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb] font-bold">
                        {paper.domain}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[11px] text-slate-400">
                        {paper.acceptedDate}
                      </span>
                    </div>

                    <h4
                      onClick={() => onOpenPaper(paper)}
                      className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-2 leading-snug cursor-pointer hover:text-[#00b4d8]"
                    >
                      {paper.title}
                    </h4>

                    <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                      {paper.abstract}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 font-['JetBrains_Mono'] text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-500">
                      Authors: <strong className="text-slate-700 dark:text-slate-200">{paper.authors}</strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onOpenPaper(paper)}
                        className="text-[#00b4d8] font-bold hover:underline"
                      >
                        {paper.doi ? `doi:${paper.doi}` : 'View record'}
                      </button>
                      <button
                        onClick={() => onOpenDataset(paper.dataFile)}
                        className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Data ({paper.fileSize})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Media (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Photo Vault */}
              <div className="rounded-3xl overflow-hidden bg-white dark:bg-slate-800 shadow-[-5px_-5px_15px_rgba(255,255,255,0.9),5px_5px_15px_rgba(148,163,184,0.18)] p-2 border border-slate-100 dark:border-slate-700">
                <div className="relative h-56 rounded-2xl overflow-hidden group">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXLC_eTbIu7Pp6cXtgYdVVRLdi3D4fXKLmLMTu_otxXuCnaDa46kRdx2H9u_be79beIIbd2dQVtYeFu-MyvRHiLrF_OvXGEn2K4Iz8J_n8jgcbr6iH_mkyOJEgluSHNtEYjKy01iqHIvXJN9uSv0BEEJijltzFBspCa6duRX89z-nv0hyk1mhRsk1_eJypkfiS2osDO1GG9ioODBat3Wwx0cvrkeTGot1wx_sTogtK3WKbtOXTdclbHA"
                    alt="South Pole Traverse"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b132b]/85 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="font-['Space_Grotesk'] text-[9px] px-2 py-0.5 rounded bg-[#00b4d8] text-white font-bold inline-block mb-1">
                      HISTORICAL PHOTO VAULT
                    </span>
                    <h5 className="font-['Space_Grotesk'] text-sm font-bold">South Pole Scientific Traverse 2010</h5>
                    <p className="font-['Inter'] text-[11px] text-slate-300">
                      NCPOR 8-member convoy reaching 90°S geographic pole under leader Dr. Rasik Ravindra.
                    </p>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                  <span className="text-slate-400">1,840 Archival Photos Online</span>
                  <button
                    onClick={() => onShowToast?.('NCPOR Archival Photo Vault: 1,840 digitized high-resolution photographic plates from 1981–2026 loaded.', 'NCPOR PHOTO VAULT', 'info')}
                    className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline"
                  >
                    Browse Gallery →
                  </button>
                </div>
              </div>

              {/* Video Log */}
              <div className="rounded-3xl overflow-hidden bg-white dark:bg-slate-800 shadow-[-5px_-5px_15px_rgba(255,255,255,0.9),5px_5px_15px_rgba(148,163,184,0.18)] p-2 border border-slate-100 dark:border-slate-700">
                <div className="relative h-56 rounded-2xl overflow-hidden group">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDm7uk-cMc7q5baYLf6qczK8NShAjFvMFZj2ELleoB42kIyI5ixPI0GxGuAGyjtZQaKZdaW8mUS2eyH4l4twF8gXYamhcUpCoIwrTWq2_uys_3x5ESrIggrCigxfVN2PdTPF29ojVnv8waKyEJTrfqexB-CHYkM2qLfCG8eWdV8QB0sUuqsgGewTXoPA41vwcBC5zOxIzQBwD9To5Hh5OsnnY0B_ATj6EKfD6r0Gxz4WA-zrykXDNYHkw"
                    alt="Wintering Alone"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div
                    onClick={onOpenSkycam}
                    className="absolute inset-0 bg-[#0b132b]/40 flex items-center justify-center cursor-pointer"
                  >
                    <button className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-lg text-[#00677d] group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[32px] ml-1">play_arrow</span>
                    </button>
                  </div>
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-white font-['JetBrains_Mono'] text-[11px]">
                    08:42 DURATION
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="font-['Space_Grotesk'] text-[9px] px-2 py-0.5 rounded bg-[#10b981] text-white font-bold inline-block mb-1">
                      DOCU-SERIES EPISODE 04
                    </span>
                    <h5 className="font-['Space_Grotesk'] text-sm font-bold">Wintering Alone: 280 Days in the Polar Darkness</h5>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                  <span className="text-slate-400">With English & Hindi Transcripts</span>
                  <button
                    onClick={onOpenSkycam}
                    className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline"
                  >
                    Watch Log →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: SCIENTIFIC COLLABORATION & OPEN CALL BANNER */}
      <section className="w-full py-12 bg-white dark:bg-[#0b132b] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="relative rounded-3xl overflow-hidden p-8 md:p-12 bg-gradient-to-r from-[#0b132b] via-[#1c2541] to-[#00677d] text-white shadow-xl">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md font-['Space_Grotesk'] text-xs mb-4">
                <span className="material-symbols-outlined text-[#10b981] text-[16px]">verified</span>
                <span>CALL FOR RESEARCH PROPOSALS • 46th ISEA & UPCOMING ARCTIC SEASON</span>
              </div>

              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold mb-3 leading-tight">
                Submit Your Polar Scientific Hypothesis for the Upcoming Season.
              </h2>

              <p className="font-['Inter'] text-sm md:text-base text-[#dce9ff]/90 mb-8 max-w-2xl leading-relaxed">
                Faculty, scientists, and PhD researchers from Indian academic institutions and international collaborators are invited to submit field research proposals for berthing at Bharati, Maitri, Himadri, and Sagar Nidhi cruises.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={onOpenProposal}
                  className="px-6 py-3 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold shadow-md transition-all"
                >
                  DOWNLOAD PROPOSAL TEMPLATE (PDF)
                </button>
                <button
                  onClick={onOpenProposal}
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-['JetBrains_Mono'] text-xs font-semibold transition-all"
                >
                  PORTAL PERMIT GUIDELINES
                </button>
                <span className="font-['JetBrains_Mono'] text-xs text-[#4cd6fb]">
                  DEADLINE: TO BE ANNOUNCED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
