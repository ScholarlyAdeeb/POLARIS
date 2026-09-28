import React, { useState } from 'react';
import { DomainType, NavTab } from '../types/polaris';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeDomain: DomainType;
  setActiveDomain: (domain: DomainType) => void;
  isPolarNight: boolean;
  setIsPolarNight: (val: boolean) => void;
  language: 'EN' | 'HI';
  setLanguage: (lang: 'EN' | 'HI') => void;
  onOpenAI: () => void;
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeDomain,
  setActiveDomain,
  isPolarNight,
  setIsPolarNight,
  language,
  setLanguage,
  onOpenAI,
  onOpenCommandPalette,
}) => {
  const [quickSearch, setQuickSearch] = useState('');
  const [highContrast, setHighContrast] = useState(false);

  const toggleContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle('high-contrast');
  };

  const navItems: { id: NavTab; label: string; hindiLabel: string }[] = [
    { id: 'explore', label: 'EXPLORE', hindiLabel: 'अन्वेषण' },
    { id: 'expeditions', label: 'EXPEDITIONS', hindiLabel: 'अभियान' },
    { id: 'stations', label: 'STATIONS', hindiLabel: 'अनुसंधान केंद्र' },
    { id: 'map', label: 'MAP & GIS', hindiLabel: 'मानचित्र' },
    { id: 'knowledge', label: 'KNOWLEDGE', hindiLabel: 'ज्ञानकोश' },
    { id: 'data', label: 'DATA', hindiLabel: 'डेटा' },
    { id: 'media', label: 'MEDIA', hindiLabel: 'मीडिया' },
    { id: 'learn', label: 'LEARN (POLAR ACADEMY)', hindiLabel: 'ध्रुवीय अकादमी' },
    { id: 'ai-assistant', label: 'AI ASSISTANT', hindiLabel: 'एआई सहायक' },
  ];

  const domains: DomainType[] = [
    'ANTARCTICA',
    'ARCTIC',
    'HIMALAYAS / THIRD POLE',
    'SOUTHERN OCEAN',
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-[#ffffff]/90 dark:bg-[#0b132b]/95 backdrop-blur-xl border-b border-[#e2e8f0]/60 dark:border-slate-800 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-colors">
      <div className="w-full px-4 md:px-8 py-2.5 flex flex-col justify-between gap-2 max-w-[1440px] mx-auto">
        {/* Tier 1: Main Header Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Brand Lockup */}
          <div 
            onClick={() => setActiveTab('explore')}
            className="flex items-center gap-3 cursor-pointer group select-none shrink-0"
          >
            <img 
              alt="POLARIS Emblem" 
              className="h-9 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-xs" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAiCBf_fzJC3otVNs1O9mCueDKQUMFMNJEFCJwZG96OrIBQ7BdEP_vSewEjY5S2L7fMPwfq3yElY69bgXFV4VFNOcC1nZy067m9MUybBc-QhaHRr8wj0BrZtAn4arOe9eRUfDu3XJLspiwqWfNCG4szkh77nx2WDh-JOHLmMCUpVuDSbxW5SrjepdM2rtcnJCGl02KCw-d-upkanY9D9JbD9KKqw-xrq0K1gDPrOaTulCg3TJaivjFjjw" 
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] text-lg md:text-xl tracking-tight text-[#0b1c30] dark:text-white font-bold leading-none">
                  POLARIS
                </span>
                <span className="font-['Space_Grotesk'] text-[10px] px-2 py-0.5 rounded-full bg-[#e5eeff] dark:bg-slate-800 text-[#00677d] dark:text-[#4cd6fb] font-bold tracking-wider border border-[#b3ebff]/50 dark:border-slate-700">
                  GOVT OF INDIA
                </span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[11px] text-[#3d494d] dark:text-slate-400 truncate max-w-xs md:max-w-xl hidden sm:inline mt-0.5">
                {language === 'EN' 
                  ? 'Indian Polar Science Knowledge Platform | Ministry of Earth Sciences (MoES / NCPOR)'
                  : 'भारतीय ध्रुवीय विज्ञान ज्ञान मंच | पृथ्वी विज्ञान मंत्रालय (एनसीपीओआर)'}
              </span>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Search trigger */}
            <div 
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f7fb] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(148,163,184,0.15)] w-72 xl:w-96 cursor-pointer hover:border-[#00b4d8]/60 transition-all"
            >
              <span className="material-symbols-outlined text-[#64748b] text-[18px]">search</span>
              <span className="w-full text-[#64748b] text-xs font-['Inter']">
                {language === 'EN' ? 'Search expeditions, datasets, stations, coords...' : 'अभियान, डेटासेट, केंद्र खोजें...'}
              </span>
              <span className="material-symbols-outlined text-[#64748b] text-[17px] hover:text-[#00b4d8]">document_scanner</span>
              <kbd className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.5 rounded bg-[#d3e4fe] dark:bg-slate-800 text-[#0b1c30] dark:text-slate-300 font-semibold">
                ⌘K
              </kbd>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={onOpenAI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(148,163,184,0.2)] text-[#8b5cf6] hover:bg-[#eff4ff] dark:hover:bg-slate-700 transition-all text-xs font-['JetBrains_Mono'] font-bold shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span className="hidden sm:inline">Ask Polar AI</span>
              </button>

              {/* Language Switcher */}
              <div className="flex items-center rounded-lg bg-[#eff4ff] dark:bg-slate-800 p-0.5 text-xs font-['JetBrains_Mono']">
                <button 
                  onClick={() => setLanguage('EN')}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${language === 'EN' ? 'bg-white dark:bg-slate-700 text-[#0b1c30] dark:text-white shadow-xs' : 'text-[#64748b] hover:text-black dark:hover:text-white'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLanguage('HI')}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${language === 'HI' ? 'bg-white dark:bg-slate-700 text-[#0b1c30] dark:text-white shadow-xs' : 'text-[#64748b] hover:text-black dark:hover:text-white'}`}
                >
                  हिंदी
                </button>
              </div>

              {/* Accessibility Toggle */}
              <button 
                onClick={toggleContrast}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${highContrast ? 'bg-[#00677d] text-white' : 'bg-[#eff4ff] dark:bg-slate-800 text-[#3d494d] dark:text-slate-300 hover:text-black'}`}
                title="Toggle High Contrast"
              >
                <span className="material-symbols-outlined text-[18px]">accessibility_new</span>
              </button>

              {/* Polar Night / Daylight Shift */}
              <button 
                onClick={() => setIsPolarNight(!isPolarNight)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isPolarNight ? 'bg-[#8b5cf6] text-white' : 'bg-[#eff4ff] dark:bg-slate-800 text-[#3d494d] dark:text-slate-300 hover:text-black'}`}
                title={isPolarNight ? "Switch to Polar Daylight" : "Switch to Polar Night"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPolarNight ? 'nights_stay' : 'wb_sunny'}
                </span>
              </button>

              {/* User Avatar */}
              <div 
                onClick={() => alert('NCPOR Polar Credentials Node: Validated Guest Researcher Session.')}
                className="w-8 h-8 rounded-full bg-[#00677d] text-white flex items-center justify-center shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(148,163,184,0.25)] cursor-pointer hover:scale-105 transition-transform"
                title="Polar Researcher Account"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: Navigation Links & Domain Filters */}
        <div className="flex items-center justify-between border-t border-[#e2e8f0]/80 dark:border-slate-800/80 pt-1.5 overflow-x-auto scrollbar-none">
          <nav className="flex items-center gap-2 md:gap-4 shrink-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'ai-assistant') {
                      onOpenAI();
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`font-['JetBrains_Mono'] text-xs font-semibold whitespace-nowrap transition-all px-2.5 py-1 rounded-lg ${
                    isActive 
                      ? 'text-[#00677d] dark:text-[#4cd6fb] font-bold bg-[#eff4ff] dark:bg-slate-800/80 shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#0b1c30] dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {language === 'EN' ? item.label : item.hindiLabel}
                </button>
              );
            })}
          </nav>

          {/* Domain Quick Filters */}
          <div className="hidden xl:flex items-center gap-1.5 font-['Space_Grotesk'] text-[11px] font-bold text-[#3d494d] dark:text-slate-400 shrink-0 ml-4 pl-4 border-l border-slate-200/80 dark:border-slate-800">
            <span className="text-[#64748b] text-[10px] uppercase tracking-wider mr-1">DOMAIN:</span>
            {domains.map((dom) => {
              const isDomActive = activeDomain === dom;
              return (
                <button
                  key={dom}
                  onClick={() => setActiveDomain(dom)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                    isDomActive
                      ? 'bg-[#00677d] text-white shadow-xs font-bold'
                      : 'bg-[#f4f7fb] dark:bg-slate-800 hover:bg-[#dce9ff] dark:hover:bg-slate-700 text-[#0b1c30] dark:text-slate-300'
                  }`}
                >
                  {dom}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
