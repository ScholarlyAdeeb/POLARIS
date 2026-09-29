import React from 'react';
import { Link } from 'react-router-dom';

const STATIONS = [
  ['bharati', 'Bharati'],
  ['maitri', 'Maitri'],
  ['himadri', 'Himadri (Svalbard)'],
  ['himansh', 'Himansh (Spiti)'],
] as const;

const PAGES: [string, string][] = [
  ['/explore', 'Archive search'],
  ['/map', 'Polar map'],
  ['/knowledge-graph', 'Knowledge graph'],
  ['/ai', 'Polar Science Assistant'],
];

const LINKS = [
  ['https://ncpor.res.in', 'NCPOR website'],
  ['https://www.ats.aq', 'Antarctic Treaty'],
  ['https://github.com/ScholarlyAdeeb/POLARIS', 'Source code'],
];

const linkCls = 'text-left text-sm text-slate-600 dark:text-slate-400 hover:text-[#0b1c30] dark:hover:text-white';
const headCls = 'text-sm font-semibold text-[#0b1c30] dark:text-white mb-1';

export const Footer: React.FC = () => (
  <footer className="w-full bg-[#f4f7fb] dark:bg-[#070c18] border-t border-slate-200 dark:border-slate-800 pt-10 pb-8 transition-colors">
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-8 pb-8 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-7 w-7 rounded-md bg-white p-0.5 ring-1 ring-slate-200 dark:ring-slate-700">
              <img alt="" className="h-full w-full object-contain" src="/polaris-emblem.svg" />
            </span>
            <span className="font-['Space_Grotesk'] text-lg font-bold text-[#0b1c30] dark:text-white">POLARIS</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            One place to archive, search and share India’s polar science. A Smart India Hackathon 2026 prototype by Team Pehchaan.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-6">
          <div className="flex flex-col gap-2">
            <span className={headCls}>Stations</span>
            {STATIONS.map(([id, name]) => (
              <Link key={id} to={`/stations/${id}`} className={linkCls}>
                {name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className={headCls}>Explore</span>
            {PAGES.map(([to, name]) => (
              <Link key={to} to={to} className={linkCls}>
                {name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className={headCls}>Links</span>
            {LINKS.map(([href, name]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" className={linkCls}>
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <p className="pt-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        © 2026 Team Pehchaan · SIH 2026 prototype for NCPOR, MoES. Not an official Government of India website. Records marked “sample” are illustrative.
      </p>
    </div>
  </footer>
);
