import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface HeaderProps {
  isPolarNight: boolean;
  setIsPolarNight: (val: boolean) => void;
  language: 'EN' | 'HI';
  setLanguage: (lang: 'EN' | 'HI') => void;
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isPolarNight,
  setIsPolarNight,
  language,
  setLanguage,
  onOpenCommandPalette,
}) => {
  const [highContrast, setHighContrast] = useState(false);

  const toggleContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle('high-contrast');
  };

  const navigate = useNavigate();
  const navItems: { to: string; label: string; hindiLabel: string }[] = [
    { to: '/', label: 'Home', hindiLabel: 'मुख्य पृष्ठ' },
    { to: '/explore', label: 'Explore', hindiLabel: 'अन्वेषण' },
    { to: '/map', label: 'Map', hindiLabel: 'मानचित्र' },
    { to: '/stations', label: 'Stations', hindiLabel: 'अनुसंधान केंद्र' },
    { to: '/knowledge-graph', label: 'Knowledge graph', hindiLabel: 'ज्ञान ग्राफ़' },
    { to: '/ai', label: 'Assistant', hindiLabel: 'सहायक' },
    { to: '/content/review', label: 'Outreach studio', hindiLabel: 'आउटरीच स्टूडियो' },
    { to: '/admin', label: 'Admin', hindiLabel: 'व्यवस्थापन' },
  ];
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  return (
    <header className="fixed top-0 w-full z-50 bg-[#ffffff]/90 dark:bg-[#0b132b]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="w-full px-4 md:px-8 py-2.5 flex flex-col justify-between gap-2 max-w-[1440px] mx-auto">
        {/* Tier 1: Main Header Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Brand Lockup */}
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0"
          >
            <span className="h-9 w-9 shrink-0 rounded-lg bg-white p-0.5 ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center">
              <img alt="POLARIS emblem" className="h-full w-full object-contain" src="/polaris-emblem.svg" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] text-lg md:text-xl tracking-tight text-[#0b1c30] dark:text-white font-bold leading-none">
                  POLARIS
                </span>
                <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-semibold">
                  SIH 2026 prototype
                </span>
              </div>
              <span className="text-xs text-[#3d494d] dark:text-slate-400 truncate max-w-xs md:max-w-xl hidden sm:inline mt-0.5">
                {language === 'EN' 
                  ? 'Indian Polar Science Knowledge Platform · built for MoES / NCPOR'
                  : 'भारतीय ध्रुवीय विज्ञान ज्ञान मंच | एमओईएस / एनसीपीओआर के लिए निर्मित'}
              </span>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Search button for screens without the search bar */}
            <button
              onClick={onOpenCommandPalette}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center bg-[#eff4ff] dark:bg-slate-800 text-[#3d494d] dark:text-slate-300 hover:text-black"
              title="Search"
              aria-label="Search"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
            {/* Quick Search trigger */}
            <div 
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-72 xl:w-96 cursor-pointer hover:border-[#00b4d8]/60 transition-all"
            >
              <span className="material-symbols-outlined text-[#64748b] text-[18px]">search</span>
              <span className="w-full text-[#64748b] text-xs font-['Inter']">
                {language === 'EN' ? 'Search expeditions, datasets, stations…' : 'अभियान, डेटासेट, केंद्र खोजें…'}
              </span>
              <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {shortcut}
              </kbd>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Language Switcher */}
              <div className="flex items-center rounded-lg bg-[#eff4ff] dark:bg-slate-800 p-0.5 text-xs">
                <button 
                  onClick={() => setLanguage('EN')}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${language === 'EN' ? 'bg-white dark:bg-slate-700 text-[#0b1c30] dark:text-white' : 'text-[#64748b] hover:text-black dark:hover:text-white'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLanguage('HI')}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${language === 'HI' ? 'bg-white dark:bg-slate-700 text-[#0b1c30] dark:text-white' : 'text-[#64748b] hover:text-black dark:hover:text-white'}`}
                >
                  हिंदी
                </button>
              </div>

              {/* Accessibility Toggle */}
              <button 
                onClick={toggleContrast}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${highContrast ? 'bg-[#00677d] text-white' : 'bg-[#eff4ff] dark:bg-slate-800 text-[#3d494d] dark:text-slate-300 hover:text-black'}`}
                title="High contrast"
                aria-label="High contrast"
              >
                <span className="material-symbols-outlined text-[18px]">accessibility_new</span>
              </button>

              {/* Polar Night / Daylight Shift */}
              <button 
                onClick={() => setIsPolarNight(!isPolarNight)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isPolarNight ? 'bg-[#8b5cf6] text-white' : 'bg-[#eff4ff] dark:bg-slate-800 text-[#3d494d] dark:text-slate-300 hover:text-black'}`}
                title={isPolarNight ? 'Light mode' : 'Dark mode'}
                aria-label={isPolarNight ? 'Light mode' : 'Dark mode'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPolarNight ? 'nights_stay' : 'wb_sunny'}
                </span>
              </button>

              {/* User Avatar */}
              <div 
                onClick={() => alert('Guest session (demo). Sign-in is not part of this prototype.')}
                className="w-8 h-8 rounded-full bg-[#00677d] text-white hidden min-[380px]:flex items-center justify-center cursor-pointer"
                title="Guest session"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: Navigation Links & Domain Filters */}
        <div className="-mx-4 px-4 md:mx-0 md:px-0 border-t border-slate-200 dark:border-slate-800 pt-1.5 overflow-x-auto scrollbar-none">
          <nav className="flex items-center gap-1 md:gap-2 w-max">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `text-sm whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-[#00677d] dark:text-[#4cd6fb] font-semibold bg-[#eff4ff] dark:bg-slate-800/80'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#0b1c30] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`
                }
              >
                {language === 'EN' ? item.label : item.hindiLabel}
              </NavLink>
            ))}
          </nav>

        </div>
      </div>
    </header>
  );
};
