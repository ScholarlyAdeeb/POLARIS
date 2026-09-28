import React, { useState, useEffect } from 'react';
import { NavTab } from '../../types/polaris';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onSelectStation: (stationId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectStation,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or toggle
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { title: 'Bharati Research Station (3D Twin & Sensors)', category: 'Stations', action: () => { onNavigate('stations'); onSelectStation('bharati'); onClose(); } },
    { title: 'Maitri Base (Schirmacher Oasis)', category: 'Stations', action: () => { onNavigate('stations'); onSelectStation('maitri'); onClose(); } },
    { title: 'Himadri Research Station (Ny-Ålesund, Arctic)', category: 'Stations', action: () => { onNavigate('stations'); onSelectStation('himadri'); onClose(); } },
    { title: 'Himansh Observatory (Spiti, Himalayas)', category: 'Stations', action: () => { onNavigate('stations'); onSelectStation('himansh'); onClose(); } },
    { title: 'Polar Stereographic Knowledge Map (EPSG:3031)', category: 'GIS & Maps', action: () => { onNavigate('map'); onClose(); } },
    { title: '45th Indian Scientific Expedition to Antarctica (ISEA)', category: 'Expeditions', action: () => { onNavigate('expeditions'); onClose(); } },
    { title: 'Mission: Survive a Week at Maitri Station', category: 'Polar Academy', action: () => { onNavigate('learn'); onClose(); } },
    { title: 'Become a Polar Glaciologist: Ice Core Analysis', category: 'Polar Academy', action: () => { onNavigate('learn'); onClose(); } },
    { title: 'Chhota Shigri Glacier Mass Balance Deficit Study', category: 'Publications', action: () => { onNavigate('knowledge'); onClose(); } },
  ];

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0b132b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a station, expedition, paper, or mission..."
            className="flex-1 bg-transparent text-sm text-[#0b1c30] dark:text-white focus:outline-none placeholder:text-slate-400 font-['Inter']"
          />
          <button
            onClick={onClose}
            className="text-[11px] font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60 font-['Inter']">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No polar records found for "{query}". Try "Bharati", "Maitri", or "Lidar".
            </div>
          ) : (
            filtered.map((item, index) => (
              <div
                key={index}
                onClick={item.action}
                className="px-3 py-2.5 rounded-xl hover:bg-[#eff4ff] dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#00b4d8] text-[18px]">
                    chevron_right
                  </span>
                  <span className="text-sm font-medium text-[#0b1c30] dark:text-slate-200 group-hover:text-[#00677d] dark:group-hover:text-[#4cd6fb]">
                    {item.title}
                  </span>
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[#f8f9ff] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-slate-400">
          <span>Navigate with arrows or click</span>
          <span>POLARIS Knowledge Directory</span>
        </div>
      </div>
    </div>
  );
};
