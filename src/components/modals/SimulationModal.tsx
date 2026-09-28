import React, { useState } from 'react';
import { SimulationMission } from '../../types/polaris';

interface SimulationModalProps {
  mission: SimulationMission | null;
  onClose: () => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({ mission, onClose }) => {
  if (!mission) return null;

  // State for Maitri Survival Simulation
  const [day, setDay] = useState(1);
  const [fuel, setFuel] = useState(85);
  const [temp, setTemp] = useState(21.4);
  const [water, setWater] = useState(90);
  const [blizzardActive, setBlizzardActive] = useState(false);
  const [shuttersClosed, setShuttersClosed] = useState(false);
  const [generatorLoad, setGeneratorLoad] = useState<'LOW' | 'MEDIUM' | 'BOOST'>('MEDIUM');
  const [simLog, setSimLog] = useState<string[]>([
    'Day 01: Systems initialized. Outside temp: -28°C. Wind: 18 kts. Lake Priyadarshini water pump nominal.',
  ]);

  // State for Ice Core Lab Simulation
  const [depth, setDepth] = useState(45); // meters
  const [laserWavelength, setLaserWavelength] = useState(532);

  const advanceMaitriDay = () => {
    if (day >= 7) {
      alert('Mission Complete! You successfully kept Maitri Station running through all 7 days of polar winter.');
      return;
    }
    const nextDay = day + 1;
    setDay(nextDay);

    const willBlizzard = nextDay === 3 || nextDay === 5;
    setBlizzardActive(willBlizzard);

    let fuelBurn = generatorLoad === 'LOW' ? 8 : generatorLoad === 'MEDIUM' ? 12 : 18;
    let newFuel = Math.max(0, fuel - fuelBurn);
    setFuel(newFuel);

    let tempChange = generatorLoad === 'LOW' ? -2.5 : generatorLoad === 'MEDIUM' ? 0.2 : +2.0;
    if (willBlizzard && !shuttersClosed) tempChange -= 5.0;
    let newTemp = Math.round((temp + tempChange) * 10) / 10;
    setTemp(newTemp);

    let newWater = Math.max(10, water - 10 + (generatorLoad === 'BOOST' ? 15 : 8));
    setWater(newWater);

    const logEntry = `Day 0${nextDay}: Generator [${generatorLoad}], Interior: ${newTemp}°C, Fuel: ${newFuel}%, Water: ${newWater}L${
      willBlizzard ? ' ⚠️ BLIZZARD 65 KTS DETECTED!' : ''
    }`;
    setSimLog((prev) => [logEntry, ...prev]);
  };

  // Ice Core estimated paleoclimate metrics based on depth
  const estimatedAgeYears = depth * 125;
  const estimatedCO2 = Math.round(180 + (depth % 30) * 4);
  const delta18O = (-38.5 + (depth % 20) * 0.4).toFixed(2);
  const climateEpoch =
    depth < 25
      ? 'Late Holocene (Industrial Baseline)'
      : depth < 60
      ? 'Mid-Holocene Climatic Optimum'
      : depth < 90
      ? 'Younger Dryas Abrupt Cooling'
      : 'Last Glacial Maximum (18,000 BP)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0b132b] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#eff4ff] dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#00677d] text-white">
              <span className="material-symbols-outlined text-[20px]">school</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] font-bold text-lg text-[#0b1c30] dark:text-white">
                  {mission.title}
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded-full bg-[#00b4d8]/20 text-[#00677d] dark:text-[#4cd6fb] font-bold">
                  {mission.grades}
                </span>
              </div>
              <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
                POLAR ACADEMY INTERACTIVE LAB • {mission.subtopic}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Interactive Simulation Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mission.id === 'sim-maitri-survival' ? (
            /* MISSION 1: SURVIVE A WEEK AT MAITRI STATION */
            <div className="space-y-6">
              {/* Mission Scenario briefing */}
              <div className="p-4 rounded-2xl bg-[#eff4ff] dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-sm">
                  <img src={mission.imageUrl} alt={mission.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h4 className="font-['Space_Grotesk'] font-bold text-sm text-[#0b1c30] dark:text-white mb-1">
                    Objective: Maintain Station Habitability through Antarctic Winter
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter']">
                    Outside temperature has plunged to -32°C at Schirmacher Oasis. Manage your diesel generators, melt water from Lake Priyadarshini, and ensure indoor thermal buffers never drop below 18°C or freeze station pipes!
                  </p>
                </div>
              </div>

              {/* Status Gauges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-['JetBrains_Mono']">
                <div className="p-4 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">MISSION DAY</span>
                  <span className="text-2xl font-bold text-[#00677d] dark:text-[#4cd6fb]">Day 0{day} / 07</span>
                  <span className="text-[10px] text-slate-500 block">Polar Midnight</span>
                </div>

                <div className="p-4 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">HABITAT TEMP</span>
                  <span className={`text-2xl font-bold ${temp < 18 ? 'text-red-500' : 'text-[#10b981]'}`}>
                    {temp}°C
                  </span>
                  <span className="text-[10px] text-slate-500 block">Min Threshold: 18.0°C</span>
                </div>

                <div className="p-4 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">JET A-1 FUEL</span>
                  <span className="text-2xl font-bold text-[#0b1c30] dark:text-white">{fuel}%</span>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-[#00b4d8] h-full" style={{ width: `${fuel}%` }}></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">MELT WATER RESERVES</span>
                  <span className="text-2xl font-bold text-[#0b1c30] dark:text-white">{water} L</span>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-[#10b981] h-full" style={{ width: `${Math.min(100, water)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Control Panel */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <span className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Station Operational Controls
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Generator Load */}
                  <div>
                    <label className="text-xs font-['Inter'] font-semibold block text-slate-600 dark:text-slate-300 mb-1.5">
                      Co-Gen Engine Output:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 font-['JetBrains_Mono'] text-xs">
                      {(['LOW', 'MEDIUM', 'BOOST'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setGeneratorLoad(mode)}
                          className={`py-2 rounded-lg font-bold transition-all ${
                            generatorLoad === mode
                              ? 'bg-[#00677d] text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Blizzard Storm Shutters */}
                  <div>
                    <label className="text-xs font-['Inter'] font-semibold block text-slate-600 dark:text-slate-300 mb-1.5">
                      Aerodynamic Thermal Shutters:
                    </label>
                    <button
                      onClick={() => setShuttersClosed(!shuttersClosed)}
                      className={`w-full py-2 rounded-lg font-['JetBrains_Mono'] text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        shuttersClosed
                          ? 'bg-[#10b981] text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {shuttersClosed ? 'lock' : 'lock_open'}
                      </span>
                      {shuttersClosed ? 'SHUTTERS SEALED' : 'OPEN / OBSERVING'}
                    </button>
                  </div>

                  {/* Advance Turn Button */}
                  <div>
                    <label className="text-xs font-['Inter'] font-semibold block text-slate-600 dark:text-slate-300 mb-1.5">
                      Execute Day Cycle:
                    </label>
                    <button
                      onClick={advanceMaitriDay}
                      className="w-full py-2 rounded-lg bg-[#00b4d8] hover:bg-[#0077b6] text-white font-['JetBrains_Mono'] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
                    >
                      <span>ADVANCE DAY {day} → {day + 1}</span>
                      <span className="material-symbols-outlined text-[16px]">fast_forward</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Station Event Log */}
              <div className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-['JetBrains_Mono'] text-xs space-y-1 max-h-36 overflow-y-auto">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Station Log Terminal:</span>
                {simLog.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </div>
          ) : (
            /* MISSION 2: ICE CORE SPECTROMETRY ANALYSIS */
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[#eff4ff] dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-sm">
                  <img src={mission.imageUrl} alt={mission.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h4 className="font-['Space_Grotesk'] font-bold text-sm text-[#0b1c30] dark:text-white mb-1">
                    Central Dronning Maud Land (IND-CDML) Ice Core Stratigraphy
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-['Inter']">
                    Cylinder drill core recovered during the 40th ISEA. Adjust the micro-laser spectrometer depth gauge to analyze annual seasonal snow layers, trapped atmospheric air bubbles, and δ18O paleotemperature proxies across 15,000 years of Earth history.
                  </p>
                </div>
              </div>

              {/* Interactive Core Depth Slider */}
              <div className="p-5 rounded-2xl bg-[#f8f9ff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                  <span className="font-bold text-[#00677d] dark:text-[#4cd6fb]">
                    CORE DRILL DEPTH: {depth} METERS BELOW SURFACE
                  </span>
                  <span className="text-slate-500">ESTIMATED AGE: ~{estimatedAgeYears} YEARS BP</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="120"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#00b4d8]"
                />
                <div className="flex justify-between text-[10px] font-['JetBrains_Mono'] text-slate-400">
                  <span>Surface (2024 CE)</span>
                  <span>40m (~5,000 BP)</span>
                  <span>80m (~10,000 BP)</span>
                  <span>120m (~15,000 BP)</span>
                </div>
              </div>

              {/* Spectrometric Readout Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-['JetBrains_Mono']">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">δ18O ISOTOPIC TEMP</span>
                  <span className="text-2xl font-bold text-[#8b5cf6]">{delta18O} ‰</span>
                  <span className="text-[10px] text-slate-500 block">Relative to VSMOW</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">TRAPPED CO2 CONCENTRATION</span>
                  <span className="text-2xl font-bold text-[#00677d] dark:text-[#4cd6fb]">{estimatedCO2} ppm</span>
                  <span className="text-[10px] text-slate-500 block">Atmospheric air bubble</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs col-span-2">
                  <span className="text-[10px] text-slate-400 block font-bold">PALEO-CLIMATIC EPOCH</span>
                  <span className="text-base font-bold text-[#0b1c30] dark:text-white">{climateEpoch}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                    ✓ Validated by NCPOR Ice Core Vault
                  </span>
                </div>
              </div>

              {/* Visual Stratigraphic Column Preview */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-['JetBrains_Mono'] text-xs text-slate-500">
                  <span>STRATIGRAPHIC DENSITY PROFILE & DUST HORIZONS</span>
                  <span>LASER LASER @ {laserWavelength} nm</span>
                </div>
                <svg className="w-full h-20 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-2" viewBox="0 0 400 60" preserveAspectRatio="none">
                  <path
                    d={`M0,30 Q${depth * 1.5},10 ${depth * 2.5},45 T${depth * 3.2},20 T400,35`}
                    fill="none"
                    stroke="#00b4d8"
                    strokeWidth="2.5"
                  />
                  <line x1={depth * 3.3} x2={depth * 3.3} y1="0" y2="60" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="3 3" />
                  <circle cx={depth * 3.3} cy="30" r="4" fill="#8b5cf6" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
            NCPOR Polar Science Educational Initiative • Grade 6–12 & University Track
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-['JetBrains_Mono'] text-xs font-bold hover:opacity-90"
          >
            Close Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
