import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LANGS, useT } from '../lib/i18n';
import { isReviewerRole, useAuth } from '../lib/auth';

interface HeaderProps {
  onOpenCommandPalette: () => void;
}

const SUBTITLE: Record<string, string> = {
  EN: 'Indian Polar Science Knowledge Platform · built for MoES / NCPOR',
  HI: 'भारतीय ध्रुवीय विज्ञान ज्ञान मंच · एमओईएस / एनसीपीओआर के लिए',
  TA: 'இந்திய துருவ அறிவியல் அறிவுத் தளம் · MoES / NCPOR-க்காக',
};
const SEARCH: Record<string, string> = {
  EN: 'Search expeditions, datasets, stations…',
  HI: 'अभियान, डेटासेट, केंद्र खोजें…',
  TA: 'பயணங்கள், தரவு, நிலையங்களைத் தேடு…',
};

function AccountMenu() {
  const { user, logout } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user)
    return (
      <Link to="/login" className="h-8 px-3 rounded-lg bg-[#00677d] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
        <span className="material-symbols-outlined text-[16px]">login</span>
        <span className="hidden min-[420px]:inline">{t('auth.signIn')}</span>
      </Link>
    );

  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#00677d] text-white text-xs font-bold flex items-center justify-center"
        aria-label={`Account: ${user.name}`}
        aria-expanded={open}
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 sci-card p-2 text-sm z-50" role="menu">
          <div className="px-2 py-1.5 border-b sci-border mb-1">
            <p className="font-semibold truncate">{user.name}</p>
            <p className="text-xs sci-muted truncate">{user.email}</p>
            <p className="text-[11px] mt-1 inline-block px-1.5 py-0.5 rounded bg-[#e5eeff] text-[#00677d] font-semibold capitalize">{user.role}</p>
          </div>
          {[
            { to: '/workspace', label: t('nav.workspace'), show: true },
            { to: `/contributors/${user.id}`, label: 'Public profile', show: true },
            { to: '/content/review', label: t('nav.studio'), show: isReviewerRole(user) },
            { to: '/admin', label: t('nav.admin'), show: isReviewerRole(user) },
          ]
            .filter((i) => i.show)
            .map((i) => (
              <Link key={i.to} to={i.to} onClick={() => setOpen(false)} className="block px-2 py-1.5 rounded hover:bg-[var(--pol-surface-2)]" role="menuitem">
                {i.label}
              </Link>
            ))}
          <button
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--pol-surface-2)]"
            role="menuitem"
          >
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

export const Header: React.FC<HeaderProps> = ({ onOpenCommandPalette }) => {
  const { lang, setLang, t } = useT();
  const { user } = useAuth();
  const [highContrast, setHighContrast] = useState(false);
  const navigate = useNavigate();

  const toggleContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle('high-contrast');
  };

  const navItems: { to: string; key: string; show?: boolean }[] = [
    { to: '/', key: 'nav.home' },
    { to: '/explore', key: 'nav.explore' },
    { to: '/atlas', key: 'nav.atlas' },
    { to: '/map', key: 'nav.map' },
    { to: '/stations', key: 'nav.stations' },
    { to: '/knowledge-graph', key: 'nav.graph' },
    { to: '/timeline', key: 'nav.timeline' },
    { to: '/newsroom', key: 'nav.newsroom' },
    { to: '/learn', key: 'nav.learn' },
    { to: '/ai', key: 'nav.assistant' },
    { to: '/workspace', key: 'nav.workspace' },
    { to: '/content/review', key: 'nav.studio', show: !user || isReviewerRole(user) },
    { to: '/admin', key: 'nav.admin', show: !user || isReviewerRole(user) },
  ];
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  return (
    <header className="fixed top-0 w-full z-50 bg-[#ffffff]/90 backdrop-blur-xl border-b border-slate-200 transition-colors">
      <div className="w-full px-4 md:px-8 py-2.5 flex flex-col justify-between gap-2 max-w-[1440px] mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div onClick={() => navigate('/')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0">
            <span className="h-9 w-9 shrink-0 rounded-lg bg-white p-0.5 ring-1 ring-slate-200 flex items-center justify-center">
              <img alt="POLARIS emblem" className="h-full w-full object-contain" src="/polaris-emblem.svg" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] text-lg md:text-xl tracking-tight text-[#0b1c30] font-bold leading-none">POLARIS</span>
                <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#00677d] font-semibold">SIH 2026 prototype</span>
              </div>
              <span className="text-xs text-[#3d494d] truncate max-w-xs md:max-w-xl hidden sm:inline mt-0.5">{SUBTITLE[lang]}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onOpenCommandPalette}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center bg-[#eff4ff] text-[#3d494d] hover:text-black"
              title="Search"
              aria-label="Search"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
            <div
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4f7fb] border border-slate-200 w-72 xl:w-96 cursor-pointer hover:border-[#00b4d8]/60 transition-all"
            >
              <span className="material-symbols-outlined text-[#64748b] text-[18px]">search</span>
              <span className="w-full text-[#64748b] text-xs font-['Inter']">{SEARCH[lang]}</span>
              <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-500 whitespace-nowrap">{shortcut}</kbd>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden sm:flex items-center rounded-lg bg-[#eff4ff] p-0.5 text-xs" role="group" aria-label="Language">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    title={l.name}
                    aria-pressed={lang === l.code}
                    className={`px-2 py-0.5 rounded font-semibold transition-all ${lang === l.code ? 'bg-white text-[#0b1c30]' : 'text-[#64748b] hover:text-black'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={toggleContrast}
                className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center transition-colors ${highContrast ? 'bg-[#00677d] text-white' : 'bg-[#eff4ff] text-[#3d494d] hover:text-black'}`}
                title="High contrast"
                aria-label="High contrast"
              >
                <span className="material-symbols-outlined text-[18px]">accessibility_new</span>
              </button>
              <AccountMenu />
            </div>
          </div>
        </div>

        <div className="hidden md:block border-t border-slate-200 pt-1.5 overflow-x-auto scrollbar-none">
          <nav className="flex items-center gap-1 md:gap-1.5 w-max">
            {navItems
              .filter((i) => i.show !== false)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `text-sm whitespace-nowrap transition-colors px-3 py-1.5 rounded-lg ${
                      isActive ? 'text-[#00677d] font-semibold bg-[#eff4ff]' : 'text-slate-600 hover:text-[#0b1c30] hover:bg-slate-100/60'
                    }`
                  }
                >
                  {t(item.key)}
                </NavLink>
              ))}
          </nav>
        </div>
      </div>
    </header>
  );
};
