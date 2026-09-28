import React, { useState } from 'react';
import { NavTab, ScientificPaper, SimulationMission } from '../types/polaris';
import { usePolarisData } from '../context/PolarisDataContext';
import { api } from '../lib/api';

interface BharatiStationViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenSimulation: (mission: SimulationMission) => void;
  onOpenPaper: (paper: ScientificPaper) => void;
  onOpenSkycam: () => void;
  onOpenDataset: (name: string) => void;
  onShowToast?: (message: string, title?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const BharatiStationView: React.FC<BharatiStationViewProps> = ({
  onNavigate,
  onOpenSimulation,
  onOpenPaper,
  onOpenSkycam,
  onOpenDataset,
  onShowToast,
}) => {
  const { hotspots, papers, simulations } = usePolarisData();
  const lidarPaper = papers.find((p) => p.id === 'paper-4') ?? papers[0];
  const [selectedHotspotId, setSelectedHotspotId] = useState<number>(1);
  const [activeRailTab, setActiveRailTab] = useState<'3d' | 'payloads' | 'expeditions' | 'datasets' | 'skycam'>('3d');
  const [thermalMode, setThermalMode] = useState(false);
  const [viewportView, setViewportView] = useState<'orbit' | 'level1' | 'level2' | 'radomes'>('orbit');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [shareCopied, setShareCopied] = useState(false);
  const [azimuth, setAzimuth] = useState(142);
  const [elevation, setElevation] = useState(24);

  const activeHotspot = hotspots[selectedHotspotId] || hotspots[1];

  const showKnowledgeGraph = async () => {
    try {
      const ds = await api.dataset(activeHotspot.datasetTitle);
      const linked = ds.links.map((l) => `${l.title} (${l.type})`).join('; ');
      onShowToast?.(
        linked
          ? `${activeHotspot.id} dataset ${ds.id} is linked to: ${linked}.`
          : `${activeHotspot.id} dataset ${ds.id} has no linked records yet.`,
        'KNOWLEDGE GRAPH',
        'info'
      );
    } catch {
      onShowToast?.('Knowledge graph is unavailable while the POLARIS API is offline.', 'KNOWLEDGE GRAPH', 'warning');
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const handleResetCam = () => {
    setThermalMode(false);
    setViewportView('orbit');
    setZoomLevel(1);
    setAzimuth(142);
    setElevation(24);
  };

  return (
    <div className="w-full flex flex-col font-['Inter']">
      {/* POLARIS HERO BREADCRUMB & METADATA OVERVIEW */}
      <section className="w-full px-4 md:px-8 py-4 bg-white dark:bg-[#0b132b] border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex flex-col gap-3">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-2 font-['JetBrains_Mono'] text-xs text-slate-500">
            <button
              onClick={() => onNavigate('explore')}
              className="hover:text-[#00b4d8] transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">home_pin</span>
              POLARIS BASE
            </button>
            <span>/</span>
            <button
              onClick={() => onNavigate('map')}
              className="hover:text-[#00b4d8] transition-colors"
            >
              STATIONS & BASES
            </button>
            <span>/</span>
            <span className="text-[#0b1c30] dark:text-white font-semibold">
              BHARATI (NCPOR-STN-03)
            </span>
          </div>

          {/* Station Primary ID & Live State Badge Matrix */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold text-[#0b1c30] dark:text-white tracking-tight">
                  Bharati Research Station
                </h1>
                <span className="px-3 py-1 rounded-full bg-[#f4f7fb] dark:bg-slate-800 shadow-sm font-['JetBrains_Mono'] text-xs text-[#0b1c30] dark:text-slate-200 font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
                  NCPOR-STN-03 • OPERATIONAL
                </span>
                <span className="px-2.5 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-['Space_Grotesk'] text-[10px] uppercase font-bold tracking-wider">
                  31st ISEA • Commissioned Mar 18, 2012
                </span>
              </div>

              <p className="font-['Inter'] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap mt-0.5">
                <span className="flex items-center gap-1 text-[#00677d] dark:text-[#4cd6fb] font-['JetBrains_Mono']">
                  <span className="material-symbols-outlined text-[15px]">location_on</span>
                  69°24′29″ S, 76°11′14″ E
                </span>
                <span>•</span>
                <span>Grovnes Peninsula, Larsemann Hills, Prydz Bay, East Antarctica</span>
                <span>•</span>
                <span className="font-['JetBrains_Mono']">Elevation: 35 m AMSL</span>
              </p>
            </div>

            {/* Right Quick Telemetry Counters */}
            <div className="flex items-center gap-3 self-start lg:self-center">
              <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(148,163,184,0.18)] border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#dce9ff] dark:bg-slate-700 flex items-center justify-center text-[#0077b6] dark:text-[#4cd6fb]">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-slate-400">
                    HABITAT CREW
                  </span>
                  <span className="font-['Space_Grotesk'] text-base font-bold text-[#0b1c30] dark:text-white leading-none">
                    24 / 47
                  </span>
                </div>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(148,163,184,0.18)] border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#dce9ff] dark:bg-slate-700 flex items-center justify-center text-[#8b5cf6]">
                  <span className="material-symbols-outlined text-[20px]">satellite_alt</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-slate-400">
                    AGEOS LINK
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#10b981] leading-none">
                    2.4 Gbps Direct
                  </span>
                </div>
              </div>

              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-2xl bg-[#f4f7fb] dark:bg-slate-800 shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(148,163,184,0.2)] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-[#00b4d8] border border-slate-200 dark:border-slate-700 transition-all relative"
                title="Share Bharati Digital Twin Link"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {shareCopied ? 'check' : 'share'}
                </span>
                {shareCopied && (
                  <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded font-['JetBrains_Mono'] whitespace-nowrap shadow-md">
                    Link Copied!
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Segmented Navigation Rail Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
            <button
              onClick={() => setActiveRailTab('3d')}
              className={`px-4 py-2 rounded-xl font-['JetBrains_Mono'] text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeRailTab === '3d'
                  ? 'bg-white dark:bg-slate-800 shadow-[-3px_-3px_8px_rgba(255,255,255,0.95),3px_3px_8px_rgba(148,163,184,0.22)] text-[#0077b6] dark:text-[#4cd6fb] border border-slate-200 dark:border-slate-700'
                  : 'bg-[#f4f7fb] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">view_in_ar</span>
              3D TWIN & SENSORS
            </button>

            <button
              onClick={() => {
                setActiveRailTab('payloads');
                setSelectedHotspotId(1);
              }}
              className={`px-4 py-2 rounded-xl font-['JetBrains_Mono'] text-xs transition-all flex items-center gap-1.5 ${
                activeRailTab === 'payloads'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-[#0077b6] dark:text-[#4cd6fb] font-bold border border-slate-200 dark:border-slate-700'
                  : 'bg-[#f4f7fb] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">science</span>
              SCIENTIFIC PAYLOADS (18)
            </button>

            <button
              onClick={() => onNavigate('expeditions')}
              className="px-4 py-2 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white font-['JetBrains_Mono'] text-xs transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">flag</span>
              ISEA EXPEDITIONS (31st–45th)
            </button>

            <button
              onClick={() => onOpenDataset('NCPOR-DS-LIDAR-2024')}
              className="px-4 py-2 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white font-['JetBrains_Mono'] text-xs transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">folder_data</span>
              DATASETS (142 TB)
            </button>

            <button
              onClick={onOpenSkycam}
              className="px-4 py-2 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white font-['JetBrains_Mono'] text-xs transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">videocam</span>
              SKYCAM & ARCHIVAL
            </button>
          </div>
        </div>
      </section>

      {/* 3D DIGITAL TWIN + DYNAMIC TELEMETRY STACK */}
      <section className="w-full px-4 md:px-8 py-6 bg-[#f8f9ff] dark:bg-[#070c18] transition-colors">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT / MAIN VIEWPORT CONTAINER (Cols 1-8) */}
          <div className="xl:col-span-8 flex flex-col gap-4">
            {/* Interactive 3D Viewport Box */}
            <div className="relative w-full h-[580px] lg:h-[620px] rounded-3xl bg-[#0b132b] overflow-hidden shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_20px_rgba(148,163,184,0.3)] border border-slate-700">
              {/* Background Synthetic Graphic Render */}
              <div
                className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ${
                  thermalMode ? 'contrast-150 saturate-200 hue-rotate-180 brightness-90' : 'opacity-85'
                }`}
                style={{
                  backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBvx6zVG3m3raIEnNzwm5g_mnVziu6NGUwv682BEG5Z38gWoF0eyqYIyblfvMEGfdwP8PH2xt0VdDgggJyaiTns5KWYNdBsj7uiB4S4UiUrrDFgrsBMT8i1-wv8OM28qjTbWSlKTdxQdT0KKs6uAfRcD1Da7IhaaNCOZqrbWBzpV5MYITx6oV6tdFxUau9RtaJ1tjhPuQ6AO4SNj-ey-DuxFUHap1rTsW9X8ohw3m54Uzos0Y4QPwjy_Q')`,
                  transform: `scale(${zoomLevel}) rotate(${viewportView === 'level1' ? 3 : viewportView === 'level2' ? -3 : 0}deg)`,
                }}
              ></div>

              {/* Cartographic Linework Overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-25">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="polar-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#b3ebff" strokeWidth="0.6" />
                      <circle cx="24" cy="24" r="1" fill="#00b4d8" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#polar-grid)" />
                  <path d="M -50 300 C 200 240, 400 360, 700 260 S 1100 380, 1400 300" fill="none" stroke="#4cd6fb" strokeDasharray="4,6" strokeWidth="1.2" />
                  <path d="M -50 420 C 300 380, 500 520, 800 400 S 1200 480, 1500 380" fill="none" stroke="#4cd6fb" strokeWidth="1" />
                </svg>
              </div>

              {/* Viewport Header HUD */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b132b]/85 backdrop-blur-md shadow-md border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
                  <span className="font-['JetBrains_Mono'] text-xs text-white">SIM-TWIN V4.8 • RT TELEMETRY STREAMING</span>
                  <span className="text-slate-500 font-['JetBrains_Mono'] text-xs">|</span>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#00b4d8]">35 FPS • WEBGL ACCELERATED</span>
                </div>

                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    onClick={() => setThermalMode(!thermalMode)}
                    className={`px-3 py-1 rounded-lg backdrop-blur-md font-['JetBrains_Mono'] text-xs transition-all flex items-center gap-1 shadow-sm border border-white/10 ${
                      thermalMode ? 'bg-[#f59e0b] text-black font-bold' : 'bg-[#0b132b]/80 text-white hover:text-[#00b4d8]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">thermostat</span>
                    THERMAL FLUX {thermalMode ? 'ON' : ''}
                  </button>

                  <button
                    onClick={handleResetCam}
                    className="px-3 py-1 rounded-lg bg-[#0b132b]/80 backdrop-blur-md text-white hover:text-[#00b4d8] font-['JetBrains_Mono'] text-xs transition-all flex items-center gap-1 shadow-sm border border-white/10"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    RESET CAM
                  </button>
                </div>
              </div>

              {/* 5 INTERACTIVE HOTSPOT PINS */}
              {/* Hotspot 1: AP-LIDAR-78 (Top 48%, Left 54%) */}
              <div
                onClick={() => setSelectedHotspotId(1)}
                className="absolute top-[48%] left-[54%] -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              >
                <div className="relative flex items-center justify-center">
                  <div className={`absolute w-12 h-12 rounded-full bg-[#00b4d8]/30 ${selectedHotspotId === 1 ? 'animate-ping' : ''}`}></div>
                  <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-125 ${
                    selectedHotspotId === 1 ? 'bg-[#00b4d8] ring-4 ring-[#00b4d8]/40' : 'bg-white/90 text-slate-900'
                  }`}>
                    <span className="material-symbols-outlined text-[18px]">flare</span>
                  </div>
                </div>
                <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-md bg-[#0b132b]/90 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-xs shadow-md border border-white/10">
                  <span className="text-[#00b4d8] font-bold">HS-01:</span> Raman LIDAR & Aerosol Lab
                </div>
              </div>

              {/* Hotspot 2: ISRO AGEOS Ground Station (Top 32%, Left 68%) */}
              <div
                onClick={() => setSelectedHotspotId(2)}
                className="absolute top-[32%] left-[68%] -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${
                  selectedHotspotId === 2 ? 'bg-[#8b5cf6] text-white ring-4 ring-[#8b5cf6]/40' : 'bg-white/90 text-[#1c2541] hover:bg-[#00b4d8] hover:text-white'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">satellite</span>
                </div>
                <div className={`absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-[#0b132b]/85 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-[11px] transition-opacity ${
                  selectedHotspotId === 2 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  HS-02: ISRO AGEOS Radome
                </div>
              </div>

              {/* Hotspot 3: Clean Cryo-Biology Lab (Top 62%, Left 42%) */}
              <div
                onClick={() => setSelectedHotspotId(3)}
                className="absolute top-[62%] left-[42%] -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${
                  selectedHotspotId === 3 ? 'bg-[#10b981] text-white ring-4 ring-[#10b981]/40' : 'bg-white/90 text-[#1c2541] hover:bg-[#00b4d8] hover:text-white'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">biotech</span>
                </div>
                <div className={`absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-[#0b132b]/85 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-[11px] transition-opacity ${
                  selectedHotspotId === 3 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  HS-03: Cryo-Microbiome Cleanroom
                </div>
              </div>

              {/* Hotspot 4: Combined Heat & Power Plant (Top 52%, Left 28%) */}
              <div
                onClick={() => setSelectedHotspotId(4)}
                className="absolute top-[52%] left-[28%] -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${
                  selectedHotspotId === 4 ? 'bg-[#f59e0b] text-white ring-4 ring-[#f59e0b]/40' : 'bg-white/90 text-[#1c2541] hover:bg-[#00b4d8] hover:text-white'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                </div>
                <div className={`absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-[#0b132b]/85 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-[11px] transition-opacity ${
                  selectedHotspotId === 4 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  HS-04: Co-Gen Power Station
                </div>
              </div>

              {/* Hotspot 5: Synoptic Weather Mast (Top 28%, Left 22%) */}
              <div
                onClick={() => setSelectedHotspotId(5)}
                className="absolute top-[28%] left-[22%] -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${
                  selectedHotspotId === 5 ? 'bg-[#00b4d8] text-white ring-4 ring-[#00b4d8]/40' : 'bg-white/90 text-[#1c2541] hover:bg-[#00b4d8] hover:text-white'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">air</span>
                </div>
                <div className={`absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-[#0b132b]/85 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-[11px] transition-opacity ${
                  selectedHotspotId === 5 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  HS-05: 30m Micro-Met Mast
                </div>
              </div>

              {/* BOTTOM VIEWPORT CONTROLS BAR */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 bg-[#0b132b]/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                {/* Camera & Floor Plan Selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setViewportView('orbit')}
                    className={`px-3 py-1 rounded-lg font-['JetBrains_Mono'] text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors ${
                      viewportView === 'orbit' ? 'bg-[#00b4d8] text-white' : 'bg-[#1c2541] text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">360</span>
                    360° ORBIT
                  </button>
                  <button
                    onClick={() => setViewportView('level1')}
                    className={`px-3 py-1 rounded-lg font-['JetBrains_Mono'] text-xs transition-colors ${
                      viewportView === 'level1' ? 'bg-[#00b4d8] text-white font-bold' : 'bg-[#1c2541] text-slate-300 hover:text-white'
                    }`}
                  >
                    LEVEL 01: LABS & COMMS
                  </button>
                  <button
                    onClick={() => setViewportView('level2')}
                    className={`px-3 py-1 rounded-lg font-['JetBrains_Mono'] text-xs transition-colors ${
                      viewportView === 'level2' ? 'bg-[#00b4d8] text-white font-bold' : 'bg-[#1c2541] text-slate-300 hover:text-white'
                    }`}
                  >
                    LEVEL 02: HABITAT & BRIDGE
                  </button>
                  <button
                    onClick={() => setViewportView('radomes')}
                    className={`px-3 py-1 rounded-lg font-['JetBrains_Mono'] text-xs transition-colors ${
                      viewportView === 'radomes' ? 'bg-[#00b4d8] text-white font-bold' : 'bg-[#1c2541] text-slate-300 hover:text-white'
                    }`}
                  >
                    ROOFTOP RADOMES
                  </button>
                </div>

                {/* Compass and Zoom Controls */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c2541] font-['JetBrains_Mono'] text-xs text-[#00b4d8]">
                    <span>AZ: {azimuth}°</span>
                    <span>•</span>
                    <span>EL: {elevation}°</span>
                  </div>

                  <div className="flex items-center gap-1 bg-[#1c2541] rounded-lg p-0.5">
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                      className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-[#00b4d8]"
                      title="Zoom In"
                    >
                      <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                    </button>
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
                      className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-[#00b4d8]"
                      title="Zoom Out"
                    >
                      <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                    </button>
                    <button
                      onClick={() => {
                        const el = document.fullscreenElement;
                        if (!el) document.documentElement.requestFullscreen?.();
                        else document.exitFullscreen?.();
                      }}
                      className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-[#00b4d8]"
                      title="Fullscreen"
                    >
                      <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Structural Casing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] border border-slate-100 dark:border-slate-700 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-['Space_Grotesk'] text-[10px] text-slate-400 font-bold uppercase">
                    STRUCTURAL CASING
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#0077b6] dark:text-[#4cd6fb]">
                    134 ISO MODULES
                  </span>
                </div>
                <span className="font-['Space_Grotesk'] text-base font-bold text-[#0b1c30] dark:text-white">
                  Aerodynamic Stilts
                </span>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Elevated on two-tier steel pylons allowing winds up to 200 km/h to sweep underneath without snowdrift burial.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] border border-slate-100 dark:border-slate-700 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-['Space_Grotesk'] text-[10px] text-slate-400 font-bold uppercase">
                    MADRID PROTOCOL
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#10b981]">
                    ZERO WASTE DISCHARGE
                  </span>
                </div>
                <span className="font-['Space_Grotesk'] text-base font-bold text-[#0b1c30] dark:text-white">
                  MBR Bioreactor Unit
                </span>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Advanced Membrane Bioreactor recycling 98.4% gray water into technical boiler flush, solids compressed for Goa back-haul.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] border border-slate-100 dark:border-slate-700 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-['Space_Grotesk'] text-[10px] text-slate-400 font-bold uppercase">
                    SPACE TELECOMMUNICATION
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#8b5cf6]">
                    AGEOS GROUND STATION
                  </span>
                </div>
                <span className="font-['Space_Grotesk'] text-base font-bold text-[#0b1c30] dark:text-white">
                  IRS Polar Data Relay
                </span>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Direct remote sensing payload download for CARTOSAT, RESOURCESAT, and OCEANSAT satellites with real-time transfer to India.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT / INTERACTIVE HOTSPOT DEEP-DIVE DRAWER (Cols 9-12) */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_16px_rgba(148,163,184,0.2)] border border-slate-100 dark:border-slate-700 flex flex-col gap-4">
              {/* Header */}
              <div className="flex flex-col gap-1 pb-1">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-700 font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold">
                    PAYLOAD ID: {activeHotspot.id}
                  </span>
                  <span className="flex items-center gap-1 font-['JetBrains_Mono'] text-xs text-[#10b981] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
                    {activeHotspot.status}
                  </span>
                </div>
                <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[#0b1c30] dark:text-white pt-1">
                  {activeHotspot.title}
                </h2>
                <p className="font-['JetBrains_Mono'] text-xs text-slate-500">
                  {activeHotspot.location}
                </p>
              </div>

              {/* Scientific Telemetry Inset Console (Recessed) */}
              <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 shadow-[inset_2px_2px_5px_rgba(148,163,184,0.20),inset_-2px_-2px_5px_rgba(255,255,255,0.75)] flex flex-col gap-3 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-['Space_Grotesk'] text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#00b4d8]">sensors</span>
                    LIVE SENSOR SYNOPTIC TELEMETRY
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#0077b6] dark:text-[#4cd6fb] font-bold">
                    20 Hz SAMPLING
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-['JetBrains_Mono']">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">{activeHotspot.m1_label}</span>
                    <span className="text-xl font-bold text-[#0b1c30] dark:text-white">{activeHotspot.m1_val}</span>
                    <span className="text-[10px] text-slate-500">{activeHotspot.m1_sub}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">{activeHotspot.m2_label}</span>
                    <span className="text-xl font-bold text-[#10b981]">{activeHotspot.m2_val}</span>
                    <span className="text-[10px] text-slate-500">{activeHotspot.m2_sub}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">{activeHotspot.m3_label}</span>
                    <span className="text-xl font-bold text-[#0b1c30] dark:text-white">{activeHotspot.m3_val}</span>
                    <span className="text-[10px] text-slate-500">{activeHotspot.m3_sub}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">{activeHotspot.m4_label}</span>
                    <span className="text-xl font-bold text-[#8b5cf6]">{activeHotspot.m4_val}</span>
                    <span className="text-[10px] text-slate-500">{activeHotspot.m4_sub}</span>
                  </div>
                </div>

                {/* Inline Spectral Chart */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-1 font-['JetBrains_Mono'] text-[10px]">
                    <span className="text-slate-400">BACKSCATTER PROFILE (0-12 km)</span>
                    <span className="text-[#00b4d8] font-bold">532nm Cross-Pol</span>
                  </div>
                  <svg className="w-full h-16 rounded-lg bg-[#dce9ff]/40 dark:bg-slate-800 p-1" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <path
                      d="M0,50 Q40,48 70,42 T120,38 T160,18 T180,32 T220,12 T260,45 L300,48"
                      fill="none"
                      stroke="#00b4d8"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M0,50 Q40,48 70,42 T120,38 T160,18 T180,32 T220,12 T260,45 L300,48 L300,60 L0,60 Z"
                      fill="rgba(0,180,216,0.15)"
                    />
                    <circle cx="160" cy="18" r="3.5" fill="#8b5cf6" />
                    <circle cx="220" cy="12" r="3.5" fill="#10b981" />
                  </svg>
                </div>
              </div>

              {/* Narratives */}
              <div className="flex flex-col gap-3 font-['Inter'] text-xs">
                <div>
                  <span className="font-['Space_Grotesk'] text-[10px] font-bold text-[#00677d] dark:text-[#4cd6fb] uppercase block mb-0.5">
                    WHAT IS THIS?
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {activeHotspot.what}
                  </p>
                </div>
                <div>
                  <span className="font-['Space_Grotesk'] text-[10px] font-bold text-[#00677d] dark:text-[#4cd6fb] uppercase block mb-0.5">
                    SIGNIFICANCE TO INDIA & GLOBAL CLIMATE
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {activeHotspot.why}
                  </p>
                </div>
              </div>

              {/* CONNECTED KNOWLEDGE FABRIC */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <span className="font-['Space_Grotesk'] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  CONNECTED KNOWLEDGE FABRIC
                </span>

                {/* Linked Dataset */}
                <div
                  onClick={() => onOpenDataset(activeHotspot.datasetTitle)}
                  className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900 hover:bg-[#dce9ff] dark:hover:bg-slate-800 transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-[#0077b6] dark:text-[#4cd6fb] shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">dataset</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-slate-500">
                      DATASET ({activeHotspot.datasetSize})
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#0b1c30] dark:text-white truncate">
                      {activeHotspot.datasetTitle}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-slate-500">
                      {activeHotspot.datasetDoi ? `DOI: ${activeHotspot.datasetDoi}` : 'Sample dataset record'}
                    </span>
                  </div>
                </div>

                {/* Linked Expedition */}
                <div
                  onClick={() => onNavigate('expeditions')}
                  className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900 hover:bg-[#dce9ff] dark:hover:bg-slate-800 transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-[#10b981] shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">explore</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-slate-500">
                      HOSTED EXPEDITION
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#0b1c30] dark:text-white truncate">
                      {activeHotspot.expeditionTitle}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-slate-500">
                      Team: {activeHotspot.expeditionTeam}
                    </span>
                  </div>
                </div>

                {/* Linked Academy Simulation */}
                <div
                  onClick={() => onOpenSimulation(simulations[1] ?? simulations[0])}
                  className="p-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-900 hover:bg-[#dce9ff] dark:hover:bg-slate-800 transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-[#8b5cf6] shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">school</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-slate-500">
                      POLAR ACADEMY SIMULATION
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#0b1c30] dark:text-white truncate">
                      {activeHotspot.simulationTitle}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#8b5cf6] font-semibold">
                      {activeHotspot.simulationDuration}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Matrix */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => onOpenDataset(activeHotspot.datasetTitle)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  DOWNLOAD OPEN DATASET (NETCDF)
                </button>

                <div className="grid grid-cols-2 gap-2 font-['JetBrains_Mono'] text-xs">
                  <button
                    onClick={() => onNavigate('map')}
                    className="py-2 px-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:bg-[#eff4ff] dark:hover:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb] font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">map</span>
                    VIEW ON MAP
                  </button>
                  <button
                    onClick={showKnowledgeGraph}
                    className="py-2 px-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:bg-[#eff4ff] dark:hover:bg-slate-700 text-[#0b1c30] dark:text-slate-200 font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">hub</span>
                    KNOWLEDGE GRAPH
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATION ENVIRONMENTAL & INFRASTRUCTURE SYNCHRONIZED TELEMETRY DOCK */}
      <section className="w-full px-4 md:px-8 py-6 bg-[#f8f9ff] dark:bg-[#070c18] transition-colors">
        <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-slate-800 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_20px_rgba(148,163,184,0.22)] border border-slate-100 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-2 border-b border-slate-100 dark:border-slate-700 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#10b981] animate-pulse"></div>
              <span className="font-['Space_Grotesk'] text-lg font-bold text-[#0b1c30] dark:text-white">
                Station Environmental & Life-Support Telemetry Dock
              </span>
              <span className="font-['JetBrains_Mono'] text-xs px-2 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb] font-semibold">
                SYNCED: 12 SEC AGO
              </span>
            </div>
            <div className="flex items-center gap-3 font-['JetBrains_Mono'] text-xs text-slate-500">
              <span>UPLINK: GSAT-14 / INMARSAT-GX</span>
              <span>•</span>
              <span className="text-[#10b981] font-bold">LATENCY 38ms</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 font-['JetBrains_Mono']">
            {/* 1. Surface Temp */}
            <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold">SURFACE TEMP</span>
                <span className="material-symbols-outlined text-[16px] text-[#00b4d8]">ac_unit</span>
              </div>
              <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#0b1c30] dark:text-white leading-tight">
                -14.2°C
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Windchill: -24.8°C</span>
            </div>

            {/* 2. Wind Velocity */}
            <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold">WIND SPEED & DIR</span>
                <span className="material-symbols-outlined text-[16px] text-[#00b4d8]">air</span>
              </div>
              <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#0b1c30] dark:text-white leading-tight">
                18.4 kts
              </span>
              <span className="text-[10px] text-slate-500 mt-1">34.1 km/h • ESE (118°)</span>
            </div>

            {/* 3. Atmospheric Pressure */}
            <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold">PRESSURE (QNH)</span>
                <span className="material-symbols-outlined text-[16px] text-[#00b4d8]">compress</span>
              </div>
              <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#0b1c30] dark:text-white leading-tight">
                987.2 hPa
              </span>
              <span className="text-[10px] text-[#10b981] font-semibold mt-1">Rising (+1.4 hPa/3h)</span>
            </div>

            {/* 4. Solar Radiation */}
            <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold">SOLAR FLUX</span>
                <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">sunny</span>
              </div>
              <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#0b1c30] dark:text-white leading-tight">
                412 W/m²
              </span>
              <span className="text-[10px] text-slate-500 mt-1">24h Midnight Sun</span>
            </div>

            {/* 5. Potable Water */}
            <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold">POTABLE WATER</span>
                <span className="material-symbols-outlined text-[16px] text-[#0077b6]">water_drop</span>
              </div>
              <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#0b1c30] dark:text-white leading-tight">
                88,400 L
              </span>
              <span className="text-[10px] text-[#10b981] font-semibold mt-1">94% Capacity (Nominal)</span>
            </div>

            {/* 6. Power Draw */}
            <div className="p-4 rounded-2xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold">POWER DRAW</span>
                <span className="material-symbols-outlined text-[16px] text-[#10b981]">offline_bolt</span>
              </div>
              <span className="font-['Space_Grotesk'] text-2xl font-bold text-[#0b1c30] dark:text-white leading-tight">
                142 kW
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Jet A-1 Fuel: 82% Full</span>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK DISCOVERY STRIP: EXPEDITIONS, SKYCAM & TECHNICAL REPORTS */}
      <section className="w-full px-4 md:px-8 py-8 bg-white dark:bg-[#0b132b] transition-colors">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-['Space_Grotesk'] text-xs font-bold text-slate-500 uppercase">
                KNOWLEDGE DISCOVERY
              </span>
              <h3 className="font-['Space_Grotesk'] text-xl font-bold text-[#0b1c30] dark:text-white">
                Recent Expeditions, Media & Publications from Bharati
              </h3>
            </div>
            <button
              onClick={() => onNavigate('knowledge')}
              className="font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline flex items-center gap-1"
            >
              VIEW ALL 184 SCIENTIFIC PAPERS
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: 45th ISEA Winter Team Field Log */}
            <div className="rounded-3xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] overflow-hidden flex flex-col justify-between border border-slate-100 dark:border-slate-700 group">
              <div className="h-44 w-full relative overflow-hidden">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZw2qSKyLTDjQhM3MeqLGbJLO7RE-trWbPShMLEeMiTKnjFtNv-8KKNLNULK6-CdhVAG4lrlUXIfgOfHfFYE1dKGj63HPkqP-b_JQdXnRc-63yHM2LAFqx22Fk2WBaJIluNDge9ZzYKLwDUcGKiAXE2-1E1NdoUqlti79v2Qbz49--KK10BfiryWRVn97wbyK2FCFdQx7jH6E5oSZfk7QqL9YJ15LASjX9wPnK_8EjGB0Axm-rM6MLoQ"
                  alt="45th ISEA Winter Team"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded bg-[#0b132b]/80 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-[10px] font-bold">
                  45TH ISEA • 2025–2026
                </span>
              </div>
              <div className="p-4 flex flex-col gap-1.5 flex-1 justify-between">
                <div>
                  <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-[#00677d] dark:text-[#4cd6fb]">
                    FIELD EXPEDITION LOG
                  </span>
                  <h4 className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] dark:text-white line-clamp-2 mt-0.5">
                    45th ISEA Winter Team at Bharati Station (Sample Log)
                  </h4>
                  <p className="font-['Inter'] text-xs text-slate-500 line-clamp-2 mt-1">
                    Winter-over scientists and engineers continue aerosol and ice core monitoring through the polar night.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-slate-400 font-['JetBrains_Mono'] text-xs border-t border-slate-100 dark:border-slate-700/60">
                  <span>NCPOR REPO: EXP-45</span>
                  <button
                    onClick={() => onShowToast?.('Logbook EXP-45: winter crew roster and daily science manifest (sample record).', '45TH ISEA FIELD LOGBOOK', 'success')}
                    className="text-[#00b4d8] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    READ <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Live Skycam */}
            <div className="rounded-3xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] overflow-hidden flex flex-col justify-between border border-slate-100 dark:border-slate-700 group">
              <div className="h-44 w-full relative overflow-hidden">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDj2_8WCpqBNBy-n9lZMf2Up_u_Rzj0xUbj8IrshptpeZL-NmnvKg6JVXd0MTMzi4zJ75LfsS1jmYQGQW0bfIYyatGIyPYnnd3wtz2t-RcppImIcnC_b1nO3iOeDu20SxSFYxoYsbKpFK4iBcgpQbtGBoou_OHYXkTWdlgeldqfkKTFoB7HgW3-FZBJT2eTpDApROKroFMy7Kx2NO6t1JwEsc6-Pg3ik3fYpDQwJ1CWnvdh5woNkRBSrQ"
                  alt="North Prydz Bay Skycam"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded bg-[#10b981] text-white font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  LIVE SKYCAM • NORTH PRYDZ BAY
                </span>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#0b132b]/80 backdrop-blur-sm text-white font-['JetBrains_Mono'] text-[10px]">
                  CAM-02 [4K]
                </span>
              </div>
              <div className="p-4 flex flex-col gap-1.5 flex-1 justify-between">
                <div>
                  <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold text-[#00677d] dark:text-[#4cd6fb]">
                    OPTICAL TELEMETRY
                  </span>
                  <h4 className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] dark:text-white line-clamp-2 mt-0.5">
                    Prydz Bay Sea Ice Breakup & Fast-Ice Extent Optical Monitor
                  </h4>
                  <p className="font-['Inter'] text-xs text-slate-500 line-clamp-2 mt-1">
                    Continuous 60-second time lapse camera feeds used for sea ice cover quantification and biological sighting logs.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-slate-400 font-['JetBrains_Mono'] text-xs border-t border-slate-100 dark:border-slate-700/60">
                  <span>FEED: 2160p H.265</span>
                  <button
                    onClick={onOpenSkycam}
                    className="text-[#00b4d8] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    STREAM <span className="material-symbols-outlined text-[14px]">play_circle</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Peer-Reviewed Study */}
            <div className="rounded-3xl bg-white dark:bg-slate-800 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] p-5 flex flex-col justify-between border border-slate-100 dark:border-slate-700 group">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-['Space_Grotesk'] text-[10px] text-slate-400 font-bold uppercase">
                    PEER-REVIEWED STUDY
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#0077b6] dark:text-[#4cd6fb]">
                    Q1 JOURNAL
                  </span>
                </div>
                <h4
                  onClick={() => onOpenPaper(lidarPaper)}
                  className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] dark:text-white leading-snug cursor-pointer hover:text-[#00b4d8]"
                >
                  Atmospheric Boundary Layer dynamics in East Antarctic coastal oasis
                </h4>
                <p className="font-['Inter'] text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  Sample publication record. Ground-based lidar & micro-radiometer telemetry from Bharati Station validating katabatic wind patterns.
                </p>
                <div className="flex flex-wrap gap-1 pt-1 font-['JetBrains_Mono'] text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-700 text-[#0b1c30] dark:text-slate-200">
                    SAMPLE RECORD
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                    OPEN ACCESS
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                <span className="text-slate-400">Lead: NCPOR Goa</span>
                <button
                  onClick={() => onOpenPaper(lidarPaper)}
                  className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline flex items-center gap-1"
                >
                  PDF <span className="material-symbols-outlined text-[14px]">download</span>
                </button>
              </div>
            </div>

            {/* Card 4: Station Archive */}
            <div className="rounded-3xl bg-[#dce9ff]/50 dark:bg-slate-800/80 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),4px_4px_12px_rgba(148,163,184,0.18)] p-5 flex flex-col justify-between border border-slate-200/60 dark:border-slate-700/60 group">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-['Space_Grotesk'] text-[10px] text-[#00677d] dark:text-[#4cd6fb] font-bold uppercase">
                    STATION ARCHIVE
                  </span>
                  <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[18px]">inventory_2</span>
                </div>
                <h4 className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] dark:text-white">
                  Browse Bharati Station Records
                </h4>
                <p className="font-['Inter'] text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Filter 12 years of Bharati meteorological archives, structural blueprints, expedition logs, and satellite links by year and instrument.
                </p>
              </div>
              <div className="pt-3">
                <button
                  onClick={() => onNavigate('data')}
                  className="w-full py-2.5 rounded-xl bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  OPEN STATION DATASETS
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
