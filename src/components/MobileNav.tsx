import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LANGS, useT } from '../lib/i18n';
import { isReviewerRole, useAuth } from '../lib/auth';

/** Phone navigation: a bottom tab bar for the main pages and a "More" sheet for everything else. */

const TABS = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/explore', key: 'nav.explore', icon: 'search' },
  { to: '/atlas', key: 'nav.atlas', icon: 'public' },
  { to: '/workspace', key: 'nav.share', icon: 'add_circle' },
];

export function MobileNav() {
  const { t, lang, setLang } = useT();
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const more = [
    { to: '/newsroom', key: 'nav.newsroom', icon: 'newspaper' },
    { to: '/map', key: 'nav.map', icon: 'map' },
    { to: '/stations', key: 'nav.stations', icon: 'home_work' },
    { to: '/knowledge-graph', key: 'nav.graph', icon: 'hub' },
    { to: '/timeline', key: 'nav.timeline', icon: 'timeline' },
    { to: '/learn', key: 'nav.learn', icon: 'school' },
    ...(user && !isReviewerRole(user)
      ? []
      : [
          { to: '/content/review', key: 'nav.studio', icon: 'campaign' },
          { to: '/admin', key: 'nav.admin', icon: 'admin_panel_settings' },
        ]),
  ];

  const tab = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] ${active ? 'text-[#00677d] font-semibold' : 'text-slate-500'}`;

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-[41] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t('nav.more')}>
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+88px)] max-h-[80dvh] overflow-y-auto shadow-2xl">
            <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-300 mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {more.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-xl p-3 text-xs text-center ${isActive ? 'bg-[#e5eeff] text-[#00677d] font-semibold' : 'bg-[#f4f7fb] text-slate-700'}`
                  }
                >
                  <span className="material-symbols-outlined text-[22px]">{m.icon}</span>
                  {t(m.key)}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs sci-muted">Language</span>
              <div className="flex rounded-lg bg-[#eff4ff] p-1 text-sm ml-auto">
                {LANGS.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} aria-pressed={lang === l.code} className={`px-3 py-1.5 rounded ${lang === l.code ? 'bg-white font-semibold' : 'text-slate-500'}`}>
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-[42] bg-white/95 backdrop-blur border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)]"
        aria-label="Main"
      >
        {TABS.map((tb) => (
          <NavLink key={tb.to} to={tb.to} end={tb.to === '/'} className={({ isActive }) => tab(isActive && !open)}>
            <span className="material-symbols-outlined text-[22px]">{tb.icon}</span>
            {t(tb.key)}
          </NavLink>
        ))}
        <button className={tab(open)} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="material-symbols-outlined text-[22px]">{open ? 'close' : 'menu'}</span>
          {t('nav.more')}
        </button>
      </nav>
    </>
  );
}
