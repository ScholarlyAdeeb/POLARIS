import React, { useState } from 'react';

interface SkycamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SkycamModal: React.FC<SkycamModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeCam, setActiveCam] = useState<'CAM-01' | 'CAM-02' | 'CAM-03'>('CAM-02');
  const [isPlaying, setIsPlaying] = useState(true);

  const cameras = [
    {
      id: 'CAM-02' as const,
      name: 'North Prydz Bay Fast-Ice Monitor',
      resolution: '4K Ultra-HD (2160p)',
      fps: '30 FPS',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDj2_8WCpqBNBy-n9lZMf2Up_u_Rzj0xUbj8IrshptpeZL-NmnvKg6JVXd0MTMzi4zJ75LfsS1jmYQGQW0bfIYyatGIyPYnnd3wtz2t-RcppImIcnC_b1nO3iOeDu20SxSFYxoYsbKpFK4iBcgpQbtGBoou_OHYXkTWdlgeldqfkKTFoB7HgW3-FZBJT2eTpDApROKroFMy7Kx2NO6t1JwEsc6-Pg3ik3fYpDQwJ1CWnvdh5woNkRBSrQ',
      azimuth: '012° NNE',
    },
    {
      id: 'CAM-01' as const,
      name: 'Larsemann Ridge & Helipad Deck',
      resolution: '1080p Full-HD',
      fps: '60 FPS',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvx6zVG3m3raIEnNzwm5g_mnVziu6NGUwv682BEG5Z38gWoF0eyqYIyblfvMEGfdwP8PH2xt0VdDgggJyaiTns5KWYNdBsj7uiB4S4UiUrrDFgrsBMT8i1-wv8OM28qjTbWSlKTdxQdT0KKs6uAfRcD1Da7IhaaNCOZqrbWBzpV5MYITx6oV6tdFxUau9RtaJ1tjhPuQ6AO4SNj-ey-DuxFUHap1rTsW9X8ohw3m54Uzos0Y4QPwjy_Q',
      azimuth: '194° SSW',
    },
    {
      id: 'CAM-03' as const,
      name: 'Upper Science Deck & Radomes',
      resolution: '4K Ultra-HD (2160p)',
      fps: '30 FPS',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCh5gLUawjsStKcJIsNpQekm481MPzFnwd28EOAiV27WkCZLGHbXb9DB5C2KlKsntiosguAhz0er_fmHv3H9uu-LT9RQOOEMGTElk1aCX4vo6uZsbOdFX6_KxnZaDGrVZ28drBnNIoVZi_wp67bCzsGWnp51ERvVdSmo2HtdtO5Eua8BtXG_mgXUYMC-f3Vevj4TZEGpyPogBO-PW5AnWTezpIZcYvUJz7bC5PAdVj-ZnkVU7ihud_1CA',
      azimuth: '340° NNW',
    },
  ];

  const currentCam = cameras.find((c) => c.id === activeCam) || cameras[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl flex flex-col bg-[#0b132b] rounded-3xl shadow-2xl border border-slate-700 overflow-hidden text-white">
        {/* Top Control Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] font-bold text-base">
                  Bharati station camera
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  DEMO VISUALIZATION
                </span>
              </div>
              <span className="font-['JetBrains_Mono'] text-xs text-slate-400">
                Still images only · no live camera connection · Prydz Bay, East Antarctica
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Video Canvas Stage */}
        <div className="relative w-full h-[440px] bg-black overflow-hidden flex items-center justify-center">
          <img
            src={currentCam.img}
            alt={currentCam.name}
            className="w-full h-full object-cover select-none"
          />

          {/* OSD (On-Screen Display) Overlay */}
          <div className="absolute top-4 left-4 flex flex-col gap-1 font-['JetBrains_Mono'] text-xs bg-black/60 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
            <span className="font-bold text-[#00b4d8]">{currentCam.name} [{currentCam.id}]</span>
            <span className="text-slate-300">STREAM: {currentCam.resolution} @ {currentCam.fps}</span>
            <span className="text-slate-300">AZIMUTH: {currentCam.azimuth} • ELEV: +14°</span>
            <span className="text-emerald-400 font-bold">● REC TIME-LAPSE ACTIVE (60s INTERVAL)</span>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => alert(`Captured high-res frame from ${currentCam.id} and saved to browser cache.`)}
              className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md hover:bg-black/80 text-white font-['JetBrains_Mono'] text-xs flex items-center gap-1.5 border border-white/10"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              <span>CAPTURE FRAME</span>
            </button>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 font-['JetBrains_Mono'] text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-lg bg-[#00b4d8] text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              </button>
              <span className="text-slate-300">UTC: 2026-01-14T11:42:09Z</span>
              <span className="hidden sm:inline text-slate-400">• SURFACE TEMP: -14.2°C • WIND: 18.4 KTS</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">SELECT CAM:</span>
              {cameras.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCam(c.id)}
                  className={`px-2 py-1 rounded font-bold text-xs ${
                    activeCam === c.id ? 'bg-[#00b4d8] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {c.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
