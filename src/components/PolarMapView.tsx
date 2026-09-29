import React, { useState, useEffect } from 'react';
import { NavTab, StationData } from '../types/polaris';
import { usePolarisData } from '../context/PolarisDataContext';
import { download, downloadUrls } from '../lib/api';

interface PolarMapViewProps {
  onNavigate: (tab: NavTab) => void;
  onSelectStation: (stationId: string) => void;
  selectedStationId?: string;
  onShowToast?: (message: string, title?: string, type?: 'info' | 'success' | 'warning') => void;
}

export const PolarMapView: React.FC<PolarMapViewProps> = ({
  onNavigate,
  onSelectStation,
  selectedStationId = 'bharati',
  onShowToast,
}) => {
  const { stations, milestones } = usePolarisData();
  const [activeRegion, setActiveRegion] = useState<'ANTARCTICA' | 'ARCTIC' | 'HIMALAYAS' | 'SOUTHERN_OCEAN'>('ANTARCTICA');
  const [rasterMode, setRasterMode] = useState<'topo' | 'bed' | 'ice' | 'grav'>('topo');
  const [showGraticule, setShowGraticule] = useState(true);
  const [showBathymetry, setShowBathymetry] = useState(true);
  const [showWeatherRadar, setShowWeatherRadar] = useState(false);
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
  const [drawerOpen, setDrawerOpen] = useState(!isPhone);
  const [layersOpen, setLayersOpen] = useState(!isPhone);
  const [activeStation, setActiveStation] = useState<StationData>(
    stations.find((s) => s.id === selectedStationId) || stations[0]
  );
  const initialZoom = isPhone ? 0.4 : 1;
  const [mapZoom, setMapZoom] = useState(initialZoom);
  const [mapCenterOffset, setMapCenterOffset] = useState({ x: 0, y: 0 });
  const [searchFilter, setSearchFilter] = useState('Bharati Station');
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [currentTimelineYear, setCurrentTimelineYear] = useState(2026);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 5 | 10>(1);

  // Layer filters
  const [layerStations, setLayerStations] = useState(true);
  const [layerExpeditions, setLayerExpeditions] = useState(true);
  const [layerDrillSites, setLayerDrillSites] = useState(true);
  const [layerIceShelf, setLayerIceShelf] = useState(true);
  const [layerScarBases, setLayerScarBases] = useState(false);
  const [layerNisarSwaths, setLayerNisarSwaths] = useState(false);
  const [scienceDomain, setScienceDomain] = useState<'All' | 'Glaciology' | 'Atmospheric' | 'Geomagnetism' | 'Cryobio'>('All');

  // Timeline playback simulation
  useEffect(() => {
    let timer: any;
    if (isPlayingTimeline) {
      timer = setInterval(() => {
        setCurrentTimelineYear((prev) => {
          const years = [1981, 1983, 1989, 2008, 2010, 2012, 2016, 2026];
          const currIdx = years.indexOf(prev);
          if (currIdx === -1 || currIdx === years.length - 1) {
            return years[0];
          }
          return years[currIdx + 1];
        });
      }, 3000 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlayingTimeline, playbackSpeed]);

  const selectStationPin = (stationId: string) => {
    const st = stations.find((s) => s.id === stationId);
    if (st) {
      setActiveStation(st);
      setDrawerOpen(true);
      onSelectStation(stationId);
    }
  };

  return (
    <div className="w-full flex flex-col font-['Inter'] bg-[#f4f7fb] dark:bg-[#070c18] transition-colors">
      {/* TOP MAP CHROME BAR */}
      <div className="w-full bg-white dark:bg-[#0b132b] border-b border-slate-200 dark:border-slate-800 z-30 px-4 md:px-8 py-3 flex flex-col gap-3">
        {/* Tier 1: Region Projections & Metadata */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3">
          {/* Region Projections Pill Selector */}
          <div className="flex items-center p-1 rounded-xl bg-[#eff4ff] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveRegion('ANTARCTICA')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-['Space_Grotesk'] text-xs font-bold transition-all ${
                activeRegion === 'ANTARCTICA'
                  ? 'bg-white dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#00b4d8]"></span>
              <span>Antarctica</span>
            </button>
            <button
              onClick={() => setActiveRegion('ARCTIC')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs transition-all ${
                activeRegion === 'ARCTIC'
                  ? 'bg-white dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span>Arctic</span>
            </button>
            <button
              onClick={() => setActiveRegion('HIMALAYAS')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs transition-all ${
                activeRegion === 'HIMALAYAS'
                  ? 'bg-white dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span>Himalayas</span>
            </button>
            <button
              onClick={() => setActiveRegion('SOUTHERN_OCEAN')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs transition-all ${
                activeRegion === 'SOUTHERN_OCEAN'
                  ? 'bg-white dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span>Southern Ocean</span>
            </button>
          </div>

          {/* Projection & Scale Metadata */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e5eeff] dark:bg-slate-800 font-['JetBrains_Mono'] text-xs text-[#0b1c30] dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px] text-[#0077b6] dark:text-[#4cd6fb]">public</span>
            <span className="font-semibold">EPSG:3031 (Antarctic Polar Stereographic)</span>
            <span className="text-slate-400">•</span>
            <span>Scale 1:12,500,000</span>
            <span className="text-slate-400">•</span>
            <span className="text-[#00677d] dark:text-[#4cd6fb] font-bold">Exaggeration 1.8x</span>
          </div>

          {/* Quick Toggles */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={showGraticule}
                onChange={(e) => setShowGraticule(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#00b4d8] rounded cursor-pointer"
              />
              <span>Graticule (10° Lat)</span>
            </label>

            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={showBathymetry}
                onChange={(e) => setShowBathymetry(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#00b4d8] rounded cursor-pointer"
              />
              <span>Bathymetry</span>
            </label>

            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={showWeatherRadar}
                onChange={(e) => setShowWeatherRadar(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#00b4d8] rounded cursor-pointer"
              />
              <span>Weather Radar</span>
            </label>

          </div>
        </div>

        {/* Tier 2: Search Bar & View Raster Modes */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="w-full md:flex-1 md:min-w-[280px] max-w-lg flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">travel_explore</span>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search stations and expeditions"
              className="w-full bg-transparent text-[#0b1c30] dark:text-white text-base md:text-xs focus:outline-none"
            />
            <button
              onClick={() => setSearchFilter('')}
              className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              ESC
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
            <span className="text-xs font-semibold text-slate-400 mr-1 shrink-0">
              Base map
            </span>
            <button
              onClick={() => setRasterMode('topo')}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                rasterMode === 'topo'
                  ? 'bg-[#00b4d8] text-white font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Topographic / Satellite
            </button>
            <button
              onClick={() => setRasterMode('bed')}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                rasterMode === 'bed'
                  ? 'bg-[#00b4d8] text-white font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              BedMachine / Velocity
            </button>
            <button
              onClick={() => setRasterMode('ice')}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                rasterMode === 'ice'
                  ? 'bg-[#00b4d8] text-white font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Sea Ice Extent 2025
            </button>
            <button
              onClick={() => setRasterMode('grav')}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                rasterMode === 'grav'
                  ? 'bg-[#00b4d8] text-white font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Gravimetry / GRACE-FO
            </button>
          </div>
        </div>
      </div>

      {/* MAIN INTERACTIVE CANVAS VIEWPORT */}
      <div className="relative w-full h-[520px] sm:h-[680px] lg:h-[820px] bg-[#f4f7fb] dark:bg-[#070c18] overflow-hidden select-none">
        {/* Polar Projection Stereographic Canvas (Vector Map Stage) */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
          style={{
            transform: `scale(${mapZoom}) translate(${mapCenterOffset.x}px, ${mapCenterOffset.y}px)`,
          }}
        >
          <div className="relative w-[1100px] h-[1100px] rounded-full flex items-center justify-center">
            {/* Concentric Latitude Circles */}
            {showGraticule && (
              <>
                {/* 60°S */}
                <div className="absolute w-[980px] h-[980px] rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center pointer-events-none">
                  <span className="absolute top-2 font-['JetBrains_Mono'] text-[11px] text-slate-500 bg-white/90 dark:bg-slate-800/90 px-3 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    60°00′00″ S (Antarctic Convergence)
                  </span>
                </div>
                {/* 70°S */}
                <div className="absolute w-[740px] h-[740px] rounded-full border border-slate-300/80 dark:border-slate-700/80 flex items-center justify-center pointer-events-none">
                  <span className="absolute top-2 font-['JetBrains_Mono'] text-[11px] text-slate-500 bg-white/90 dark:bg-slate-800/90 px-3 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    70°00′00″ S (Coastal Fast Ice Zone)
                  </span>
                </div>
                {/* 80°S */}
                <div className="absolute w-[460px] h-[460px] rounded-full border border-slate-300/60 dark:border-slate-700/60 flex items-center justify-center pointer-events-none">
                  <span className="absolute top-2 font-['JetBrains_Mono'] text-[11px] text-slate-500 bg-white/90 dark:bg-slate-800/90 px-3 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    80°00′00″ S (Polar Plateau Rim)
                  </span>
                </div>
              </>
            )}

            {/* Vector SVG Continental Antarctica Outline */}
            <svg className="absolute w-[860px] h-[860px] drop-shadow-md" fill="none" viewBox="0 0 800 800">
              {showBathymetry && (
                <circle cx="400" cy="400" r="380" fill={rasterMode === 'bed' ? '#064e3b' : '#00b4d8'} fillOpacity={rasterMode === 'bed' ? '0.15' : '0.08'} />
              )}
              {/* Landmass */}
              <path
                d="M400,140 C450,145 520,160 580,210 C620,245 660,300 670,360 C680,420 660,480 620,530 C590,565 540,600 480,630 C430,655 370,660 320,640 C270,620 220,580 190,530 C160,480 150,420 160,360 C170,300 190,260 220,220 C240,195 280,220 310,210 C340,200 360,135 400,140 Z"
                fill={rasterMode === 'bed' ? '#1e293b' : rasterMode === 'ice' ? '#dbeafe' : '#ebf2fc'}
                stroke="#cbdcf5"
                strokeWidth="2.5"
              />
              {/* Amery Ice Shelf */}
              {layerIceShelf && (
                <path d="M510,250 C540,280 560,320 530,350 C500,340 480,300 510,250 Z" fill="#dce9ff" stroke="#00b4d8" strokeDasharray="4 4" strokeWidth="2" />
              )}
              {/* Ross Ice Shelf */}
              {layerIceShelf && (
                <path d="M360,540 C400,530 450,540 470,580 C440,610 390,600 360,540 Z" fill="#dce9ff" stroke="#00b4d8" strokeDasharray="4 4" strokeWidth="2" />
              )}
              {/* Weddell Sea / Ronne Shelf */}
              {layerIceShelf && (
                <path d="M260,320 C280,360 260,410 220,400 C200,360 220,330 260,320 Z" fill="#dce9ff" stroke="#00b4d8" strokeDasharray="4 4" strokeWidth="2" />
              )}

              {/* Transantarctic Mountain range */}
              <path d="M310,380 Q390,460 480,560" stroke="#94a3b8" strokeDasharray="3 5" strokeLinecap="round" strokeWidth="3" />

              {/* Longitudinal spokes */}
              {showGraticule && (
                <>
                  <line x1="400" y1="20" x2="400" y2="780" stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="0.8" />
                  <line x1="20" y1="400" x2="780" y2="400" stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="0.8" />
                  <line x1="130" y1="130" x2="670" y2="670" stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="0.8" />
                  <line x1="130" y1="670" x2="670" y2="130" stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="0.8" />
                </>
              )}

              {/* 45th ISEA track */}
              {layerExpeditions && (
                <>
                  <path d="M680,60 C640,110 590,190 535,278" stroke="#00b4d8" strokeDasharray="6 6" strokeLinecap="round" strokeWidth="3" />
                  <path d="M535,278 L310,245" stroke="#00b4d8" strokeDasharray="4 4" strokeWidth="2.5" />
                  <path d="M310,245 L400,400" stroke="#8b5cf6" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2.5" />
                </>
              )}
            </svg>

            {/* Geographic South Pole 90°S Marker */}
            <div
              onClick={() => onShowToast?.('Amundsen-Scott South Pole Station (90°00′S, Elev: 2,835 m). Site of 2010 Indian overland convoy reach led by Dr. Rasik Ravindra.', 'GEOGRAPHIC SOUTH POLE', 'info')}
              className="absolute w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center cursor-pointer group z-20 border border-slate-300"
            >
              <span className="w-3 h-3 rounded-full bg-[#0b132b] dark:bg-white"></span>
              <div className="absolute top-9 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#0b132b] text-white font-['JetBrains_Mono'] text-xs whitespace-nowrap opacity-90 group-hover:scale-105 transition-transform">
                SOUTH POLE (90°00′S) • Amundsen-Scott
              </div>
            </div>

            {/* STATION 1: BHARATI (PRIMARY PIN) */}
            {layerStations && (
              <div
                onClick={() => selectStationPin('bharati')}
                className="absolute top-[280px] right-[270px] cursor-pointer z-30 group"
              >
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-12 h-12 rounded-full bg-[#00b4d8]/30"></span>
                  <span className="absolute w-8 h-8 rounded-full bg-[#00b4d8]/40"></span>
                  <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                    <span className="font-['Space_Grotesk'] text-sm text-[#0b1c30] dark:text-white font-bold">BHARATI</span>
                    <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.5 rounded bg-[#e5eeff] dark:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb] font-semibold">
                      MoES
                    </span>
                  </div>
                </div>

                {/* Floating Quick Synoptic HUD */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center gap-2 border border-slate-200 dark:border-slate-700 pointer-events-none">
                  <div className="flex items-center gap-1 text-[#00677d] dark:text-[#4cd6fb] font-['JetBrains_Mono'] text-xs font-semibold">
                    <span className="material-symbols-outlined text-[15px]">ac_unit</span>
                    <span>-14.2°C</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1 text-[#0b1c30] dark:text-white font-['JetBrains_Mono'] text-xs">
                    <span className="material-symbols-outlined text-[15px] text-[#00b4d8]">air</span>
                    <span>18 kts ESE</span>
                  </div>
                  <span className="text-slate-300">|</span>
                                  </div>
              </div>
            )}

            {/* STATION 2: MAITRI */}
            {layerStations && (
              <div
                onClick={() => selectStationPin('maitri')}
                className="absolute top-[240px] left-[300px] cursor-pointer z-30 group"
              >
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                  <span className="font-['Space_Grotesk'] text-sm text-[#0b1c30] dark:text-white font-bold">MAITRI</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-slate-500">Schirmacher</span>
                </div>
              </div>
            )}

            {/* STATION 3: DAKSHIN GANGOTRI */}
            {layerStations && (
              <div
                onClick={() => selectStationPin('dakshin-gangotri')}
                className="absolute top-[195px] left-[325px] cursor-pointer z-20 group"
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                  <span className="font-['Space_Grotesk'] text-xs font-semibold text-[#0b1c30] dark:text-white">
                    DAKSHIN GANGOTRI
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[9px] text-slate-400">1983-1990</span>
                </div>
              </div>
            )}

            {/* RESEARCH VESSEL SAGAR NIDHI */}
            <div
              onClick={() => selectStationPin('sagar-kanya')}
              className="absolute top-[160px] right-[290px] cursor-pointer z-20 group"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all">
                <span className="material-symbols-outlined text-[#00b4d8] text-[18px]">directions_boat</span>
                <div className="flex flex-col">
                  <span className="font-['Space_Grotesk'] text-xs font-bold text-[#0b1c30] dark:text-white">
                    ORV SAGAR NIDHI
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">
                    CTD Station #44-B
                  </span>
                </div>
              </div>
            </div>

            {/* INTERNATIONAL BASES FOR REFERENCE */}
            {layerScarBases && (
              <>
                <div className="absolute bottom-[280px] left-[230px] opacity-75 hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800/80 font-['JetBrains_Mono'] text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>McMurdo (US)</span>
                  </div>
                </div>
                <div className="absolute bottom-[360px] right-[300px] opacity-75 hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800/80 font-['JetBrains_Mono'] text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Concordia (FR/IT)</span>
                  </div>
                </div>
                <div className="absolute top-[350px] right-[210px] opacity-75 hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800/80 font-['JetBrains_Mono'] text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Davis (AU)</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Layers panel */}
        <button
          onClick={() => setLayersOpen((o) => !o)}
          className="md:hidden absolute top-3 left-3 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-[#0b132b]/95 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0b1c30] dark:text-white"
        >
          <span className="material-symbols-outlined text-[16px]">layers</span>
          {layersOpen ? 'Hide layers' : 'Layers'}
        </button>
        <div className={`${layersOpen ? 'flex' : 'hidden'} absolute top-14 md:top-4 left-3 md:left-4 w-[calc(100%-1.5rem)] max-w-72 rounded-2xl bg-white/95 dark:bg-[#0b132b]/95 backdrop-blur-xl p-4 z-30 flex-col gap-3 border border-slate-200/80 dark:border-slate-800`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[20px]">layers</span>
              <span className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] dark:text-white">
                Map layers
              </span>
            </div>
          </div>

          {/* Science Domains */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-400 ">
              Topics
            </span>
            <div className="flex flex-wrap gap-1">
              {(['All', 'Glaciology', 'Atmospheric', 'Geomagnetism', 'Cryobio'] as const).map((dom) => (
                <button
                  key={dom}
                  onClick={() => setScienceDomain(dom)}
                  className={`px-2 py-0.5 rounded-full font-['JetBrains_Mono'] text-[10px] font-semibold transition-colors ${
                    scienceDomain === dom
                      ? 'bg-[#00677d] text-white'
                      : 'bg-[#f4f7fb] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#dce9ff]'
                  }`}
                >
                  {dom}
                </button>
              ))}
            </div>
          </div>

          {/* Layer Checkboxes */}
          <div className="flex flex-col gap-1 font-['Inter'] text-xs text-[#0b1c30] dark:text-slate-200">
            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#f4f7fb] dark:hover:bg-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layerStations}
                  onChange={(e) => setLayerStations(e.target.checked)}
                  className="w-4 h-4 accent-[#00b4d8] rounded"
                />
                <span className="font-medium">Indian Stations & Camps</span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">4</span>
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#f4f7fb] dark:hover:bg-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layerExpeditions}
                  onChange={(e) => setLayerExpeditions(e.target.checked)}
                  className="w-4 h-4 accent-[#00b4d8] rounded"
                />
                <span className="font-medium">Recent Expedition (45th ISEA)</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#f4f7fb] dark:hover:bg-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layerDrillSites}
                  onChange={(e) => setLayerDrillSites(e.target.checked)}
                  className="w-4 h-4 accent-[#00b4d8] rounded"
                />
                <span className="font-medium">Ice Core Drill Sites & AWS</span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">28</span>
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#f4f7fb] dark:hover:bg-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layerIceShelf}
                  onChange={(e) => setLayerIceShelf(e.target.checked)}
                  className="w-4 h-4 accent-[#00b4d8] rounded"
                />
                <span className="font-medium">Ice Shelf Boundaries</span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#00b4d8] font-bold">MODIS</span>
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#f4f7fb] dark:hover:bg-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layerScarBases}
                  onChange={(e) => setLayerScarBases(e.target.checked)}
                  className="w-4 h-4 accent-[#00b4d8] rounded"
                />
                <span className="text-slate-500 dark:text-slate-400">International SCAR Bases</span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">34</span>
            </label>

            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#f4f7fb] dark:hover:bg-slate-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layerNisarSwaths}
                  onChange={(e) => setLayerNisarSwaths(e.target.checked)}
                  className="w-4 h-4 accent-[#00b4d8] rounded"
                />
                <span className="text-slate-500 dark:text-slate-400">NISAR Cryosphere Swaths</span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#8b5cf6] font-bold">SAR-L</span>
            </label>
          </div>

        </div>

        {/* MAP CONTROLS DOCK (BOTTOM-LEFT) */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-30">
          <div className="flex flex-col rounded-2xl bg-white dark:bg-[#0b132b] border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setMapZoom((z) => Math.min(1.8, z + 0.15))}
              className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 w-full"></div>
            <button
              onClick={() => setMapZoom((z) => Math.max(0.3, z - 0.15))}
              className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 w-full"></div>
            <button
              onClick={() => {
                setMapZoom(initialZoom);
                setMapCenterOffset({ x: 0, y: 0 });
              }}
              className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-[#eff4ff] dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
              title="Reset Polar Center"
            >
              <span className="material-symbols-outlined text-[20px]">filter_center_focus</span>
            </button>
          </div>

          <button
            onClick={() => onShowToast?.('3D Globe Mode: Re-projecting stereographic grid to 3D Ellipsoid View (WGS84) with 1.8x vertical terrain exaggeration.', '3D GLOBE PROJECTION', 'info')}
            className="hidden sm:flex px-3.5 py-2 rounded-2xl bg-white dark:bg-[#0b132b] border border-slate-200 dark:border-slate-700 font-['JetBrains_Mono'] text-xs text-[#0b1c30] dark:text-white items-center gap-2 hover:bg-[#eff4ff] dark:hover:bg-slate-800 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[18px]">3d_rotation</span>
            <span>3D Globe Mode</span>
          </button>
        </div>

        {/* EXPANDED SLIDE-OUT STATION DRAWER (RIGHT SIDE) */}
        {drawerOpen && activeStation && (
          <div className="absolute inset-x-2 bottom-2 max-h-[70%] md:inset-x-auto md:max-h-none md:top-4 md:right-4 md:bottom-4 md:w-[420px] rounded-2xl bg-white/95 dark:bg-[#0b132b]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 z-40 flex flex-col overflow-hidden animate-slide-in">
            {/* Drawer Image Banner */}
            <div className="relative w-full h-28 md:h-44 bg-slate-200 shrink-0 overflow-hidden">
              <img
                src={activeStation.imageUrl}
                alt={activeStation.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b132b]/85 via-[#0b132b]/30 to-transparent"></div>

              {/* Station Code & Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold">
                  {activeStation.code}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#10b981] text-white font-['Space_Grotesk'] text-[10px] font-bold">
                  {activeStation.status === 'OPERATIONAL' ? 'Year-round' : activeStation.status.charAt(0) + activeStation.status.slice(1).toLowerCase()}
                </span>
              </div>

              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Bottom Title Overlay */}
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight">
                  {activeStation.name}
                </h2>
                <div className="flex items-center gap-1.5 font-['JetBrains_Mono'] text-xs text-slate-200">
                  <span className="material-symbols-outlined text-[14px] text-[#00b4d8]">pin_drop</span>
                  <span className="truncate">{activeStation.locationName}</span>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Geodetic Coordinates Pill */}
              <div className="p-2 px-3 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                <div>
                  <span className="text-slate-400">Location </span>
                  <span className="font-bold text-[#00677d] dark:text-[#4cd6fb]">{activeStation.coordinates}</span>
                </div>
                <div>
                  <span className="text-slate-400">Elevation </span>
                  <span className="font-semibold">{activeStation.elevation}</span>
                </div>
              </div>

              {/* Real-time In-Situ Telemetry Bento */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs  font-bold text-slate-400">
                    Sample readings
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#10b981] flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                    Sample values
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 font-['JetBrains_Mono'] text-xs">
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">Temperature</span>
                    <span className="text-lg font-bold text-[#00677d] dark:text-[#4cd6fb] mt-0.5">
                      {activeStation.temp}
                    </span>
                    <span className="text-[10px] text-slate-400">Wind Chill: {activeStation.windChill}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">Wind</span>
                    <span className="text-lg font-bold text-[#0b1c30] dark:text-white mt-0.5">
                      {activeStation.windSpeed}
                    </span>
                    <span className="text-[10px] text-slate-400">Heading: {activeStation.windDir}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">Pressure</span>
                    <span className="text-lg font-bold text-[#0b1c30] dark:text-white mt-0.5">
                      {activeStation.pressure}
                    </span>
                    <span className="text-[10px] text-[#10b981] font-semibold">Rising +1.1 hPa/3h</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">Solar flux</span>
                    <span className="text-lg font-bold text-[#f59e0b] mt-0.5">
                      {activeStation.solarFlux}
                    </span>
                    <span className="text-[10px] text-slate-400">24h Continuous Sun</span>
                  </div>
                </div>
              </div>

              {/* PRIMARY INTERACTIVE ACTION BUTTONS */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Launch 3D Digital Twin Button (Navigates to Bharati Screen 1) */}
                <button
                  onClick={() => {
                    onNavigate('stations');
                    onSelectStation(activeStation.id);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#00b4d8] text-white font-['Space_Grotesk'] text-sm font-bold hover:bg-[#0077b6] transition-all transform active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">view_in_ar</span>
                  <span>Launch 3D Virtual Station / Digital Twin</span>
                </button>

                <div className="grid grid-cols-2 gap-2 font-['JetBrains_Mono'] text-xs">
                  <button
                    onClick={() => onNavigate('data')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#00677d] dark:text-[#4cd6fb] hover:bg-[#eff4ff] dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">database</span>
                    <span>Station Datasets</span>
                  </button>

                  <button
                    onClick={() => {
                      download(downloadUrls.synoptic(activeStation.id));
                      onShowToast?.(`Downloading the last 72 h of hourly surface records for ${activeStation.name} (CSV, sample values).`, 'SYNOPTIC EXPORT', 'success');
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#00677d] dark:text-[#4cd6fb] hover:bg-[#eff4ff] dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Export Synoptic</span>
                  </button>
                </div>
              </div>

              {/* Active Payloads */}
              <div className="flex flex-col gap-2">
                <span className="text-xs  font-bold text-slate-400">
                  Instruments
                </span>
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#00677d] text-[18px]">wb_sunny</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[#0b1c30] dark:text-white">Brewer Spectrophotometer #184</span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">Total Column Ozone & UV Flux</span>
                      </div>
                    </div>
                    <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      Installed
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#00677d] text-[18px]">satellite_alt</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[#0b1c30] dark:text-white">GNSS-Reflectometry Station</span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">Tectonic Uplift & Fast Ice Altimetry</span>
                      </div>
                    </div>
                    <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      Installed
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#00677d] text-[18px]">graphic_eq</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[#0b1c30] dark:text-white">Broadband Seismometer Array</span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-slate-400">Antarctic Lithospheric Microseisms</span>
                      </div>
                    </div>
                    <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      Installed
                    </span>
                  </div>
                </div>
              </div>

              {/* Connected Scientific Knowledge Assets */}
              <div className="flex flex-col gap-2 pb-2">
                <span className="text-xs  font-bold text-slate-400">
                  Linked records
                </span>
                <div className="p-3.5 rounded-2xl bg-[#eff4ff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                    <span className="font-bold text-[#00677d] dark:text-[#4cd6fb]">12 linked expeditions</span>
                    <span className="text-slate-400">31st – 45th ISEA</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter']">
                    {activeStation.description}
                  </p>
                  <div className="pt-1">
                    <button
                      onClick={() => onNavigate('knowledge')}
                      className="font-['JetBrains_Mono'] text-xs text-[#00b4d8] font-bold hover:underline flex items-center gap-1"
                    >
                      <span>View station publications</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM MASTER EXPEDITION TIMELINE SCRUBBER (1981 - 2026) */}
      <div className="w-full bg-white dark:bg-[#0b132b] border-t border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 z-30 flex flex-col gap-3">
        {/* Scrubber Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#00677d] dark:text-[#4cd6fb] hover:bg-[#eff4ff] transition-all"
                title={isPlayingTimeline ? 'Pause Timeline' : 'Play Timeline Chronology'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isPlayingTimeline ? 'pause' : 'play_arrow'}
                </span>
              </button>
              <button
                onClick={() => {
                  setIsPlayingTimeline(false);
                  setCurrentTimelineYear(1981);
                }}
                className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-black dark:hover:text-white transition-all"
                title="Replay from 1981"
              >
                <span className="material-symbols-outlined text-[18px]">replay</span>
              </button>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] text-sm font-bold text-[#0b1c30] dark:text-white">
                  Expedition timeline
                </span>
                <span className="font-['JetBrains_Mono'] text-xs px-2 py-0.5 rounded-full bg-[#e5eeff] dark:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb] font-bold">
                  1981 — 2026
                </span>
              </div>
              <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
                45 Antarctic Expeditions • Arctic (Ny-Ålesund) • Southern Ocean Cruises
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 font-['JetBrains_Mono'] text-xs bg-[#f4f7fb] dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400">Speed</span>
              {([1, 5, 10] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-white dark:bg-slate-700 text-[#00677d] dark:text-[#4cd6fb]'
                      : 'text-slate-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 font-['JetBrains_Mono'] text-xs text-[#00677d] dark:text-[#4cd6fb] font-bold">
              <span className="material-symbols-outlined text-[18px]">history_edu</span>
              <span>
                CURRENT ERA: {currentTimelineYear === 2026 ? '45th ISEA (2025-26)' : `Year ${currentTimelineYear}`}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Rail */}
        <div className="relative w-full pt-2 pb-2">
          {/* Progress bar background */}
          <div className="relative w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#00677d] via-[#00b4d8] to-[#10b981] rounded-full transition-all duration-300"
              style={{
                width: `${((currentTimelineYear - 1981) / (2026 - 1981)) * 100}%`,
              }}
            ></div>
          </div>

          {/* Milestones along track */}
          <div className="relative w-full flex justify-between items-start mt-2">
            {milestones.map((m) => {
              const isSelected = currentTimelineYear === m.year;
              return (
                <div
                  key={m.year}
                  onClick={() => setCurrentTimelineYear(m.year)}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      isSelected
                        ? 'bg-[#10b981] scale-125 ring-4 ring-[#10b981]/25'
                        : 'bg-[#00677d] dark:bg-slate-400 group-hover:scale-125'
                    }`}
                  ></div>
                  <span className={`font-['JetBrains_Mono'] text-xs font-bold mt-1 ${
                    isSelected ? 'text-[#10b981]' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {m.year}
                  </span>
                  <span className="font-['Inter'] text-[10px] text-slate-500 text-center max-w-[85px] hidden sm:block">
                    {m.title.split(' ')[0]} {m.title.split(' ')[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
