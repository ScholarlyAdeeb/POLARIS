import React, { useState } from 'react';
import { NavTab, ScientificPaper, SimulationMission } from '../types/polaris';
import { usePolarisData } from '../context/PolarisDataContext';
import { api, type SearchResponse, type SearchResult } from '../lib/api';

interface ExploreViewProps {
  onNavigate: (tab: NavTab) => void;
  onSelectStation: (stationId: string) => void;
  onOpenSimulation: (mission: SimulationMission) => void;
  onOpenPaper: (paper: ScientificPaper) => void;
  onOpenSkycam: () => void;
  onOpenProposal: () => void;
  onOpenDataset: (name: string) => void;
  onOpenRecord: (id: string) => void;
  onOpenMediaGallery: () => void;
  onShowToast?: (message: string, title?: string, type?: 'info' | 'success' | 'warning') => void;
}

const RESULT_ICON: Record<string, string> = {
  expedition: 'route',
  report: 'description',
  dataset: 'database',
  publication: 'article',
  photo: 'photo_library',
  video: 'movie',
  activity: 'campaign',
};

/** Render the server's [highlighted] snippet markers as <mark>. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[') && p.endsWith(']') ? (
          <mark key={i} className="bg-[#00b4d8]/20 text-inherit rounded px-0.5">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}

const REGIONS = [
  { id: 'bharati', region: 'Antarctica', title: 'Maitri and Bharati', place: 'Schirmacher Oasis and Larsemann Hills', text: 'Year-round stations for the Indian Scientific Expeditions to Antarctica: atmosphere, geology and ice.' },
  { id: 'himadri', region: 'Arctic', title: 'Himadri', place: 'Ny-Ålesund, Svalbard', text: 'Fjord hydrography, black carbon on glaciers and Arctic aerosol studies.' },
  { id: 'himansh', region: 'Himalayas', title: 'Himansh', place: 'Spiti Valley, 4,080 m', text: 'Glacier mass balance and snowmelt runoff in the Chandra basin.' },
  { id: 'sagar-kanya', region: 'Southern Ocean', title: 'ORV Sagar Kanya', place: 'Cruises between 40°S and 65°S', text: 'Ocean biogeochemistry, plankton blooms and carbon uptake.' },
];

function SectionHeader({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div className="max-w-2xl">
        <h2 className="font-['Space_Grotesk'] text-xl sm:text-2xl md:text-3xl text-[#0b132b] dark:text-white font-bold tracking-tight">{title}</h2>
        {text && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{text}</p>}
      </div>
      {action}
    </div>
  );
}

const CARD = 'rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80';

export const ExploreView: React.FC<ExploreViewProps> = ({
  onNavigate,
  onSelectStation,
  onOpenSimulation,
  onOpenPaper,
  onOpenSkycam,
  onOpenProposal,
  onOpenDataset,
  onOpenRecord,
  onOpenMediaGallery,
  onShowToast,
}) => {
  const { papers, simulations, valueGraph } = usePolarisData();
  const [searchQuery, setSearchQuery] = useState('What atmospheric studies were conducted at Maitri in 2023?');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);

  const runSearch = async (query = searchQuery) => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setSearchResults(await api.search(query, 12));
    } catch {
      onShowToast?.('Archive search is unavailable while the POLARIS API is offline.', 'POLAR ARCHIVE SEARCH', 'warning');
    } finally {
      setSearching(false);
    }
  };

  const openResult = (r: SearchResult) => {
    if (r.type === 'publication') {
      const paper = papers.find((p) => p.id === r.id);
      if (paper) return onOpenPaper(paper);
    }
    if (r.type === 'dataset') return onOpenDataset(r.id);
    onOpenRecord(r.id);
  };


  const samplePrompts = [
    'Bharati station architectural heat-recovery efficiency',
    'Himadri glacier ablation rate trends 2015-2024',
    'Southern Ocean microplastic concentration transects',
    'Maitri Lake Priyadarshini water chemistry variations',
  ];

  return (
    <div className="w-full flex flex-col font-['Inter']">
      {/* SECTION 1: HERO */}
      <section className="w-full bg-[#eff4ff] dark:bg-[#0c162c] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 pt-6 pb-10 md:pt-10 md:pb-14 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold text-[#00677d] dark:text-[#4cd6fb] mb-3">SIH 2026 prototype · built for NCPOR, MoES</p>
            <h1 className="font-['Space_Grotesk'] text-[2rem] leading-[1.1] sm:text-5xl xl:text-6xl text-[#0b132b] dark:text-white tracking-tight font-bold mb-4">
              Explore India’s science at the <span className="text-[#00677d] dark:text-[#00b4d8]">ends of the Earth.</span>
            </h1>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mb-6 leading-relaxed">
              Expeditions, research stations, datasets, publications and stories from India’s missions to Antarctica, the Arctic, the Himalayas and the Southern Ocean.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onNavigate('map')}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00677d] hover:bg-[#005466] text-white text-sm font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">explore</span>
                Explore the polar map
              </button>
              <button
                onClick={() => {
                  onNavigate('stations');
                  onSelectStation('bharati');
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 text-[#0b132b] dark:text-white text-sm font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">travel_explore</span>
                Visit Bharati station
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative w-full h-56 sm:h-80 lg:h-[400px] rounded-2xl overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Bharati Antarctic Research Station in the Larsemann Hills"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCh5gLUawjsStKcJIsNpQekm481MPzFnwd28EOAiV27WkCZLGHbXb9DB5C2KlKsntiosguAhz0er_fmHv3H9uu-LT9RQOOEMGTElk1aCX4vo6uZsbOdFX6_KxnZaDGrVZ28drBnNIoVZi_wp67bCzsGWnp51ERvVdSmo2HtdtO5Eua8BtXG_mgXUYMC-f3Vevj4TZEGpyPogBO-PW5AnWTezpIZcYvUJz7bC5PAdVj-ZnkVU7ihud_1CA"
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent"></div>
              <button
                onClick={onOpenSkycam}
                className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/75 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">videocam</span>
                Bharati station camera
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FOUR REGIONS */}
      <section className="w-full py-10 md:py-14 bg-white dark:bg-[#0b132b] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <SectionHeader title="Four polar regions" text="Where India’s polar research happens." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onNavigate('stations');
                  onSelectStation(r.id);
                }}
                className={`${CARD} p-4 md:p-5 text-left hover:border-[#00b4d8] transition-colors group`}
              >
                <span className="text-xs font-semibold text-[#00677d] dark:text-[#4cd6fb]">{r.region}</span>
                <h3 className="font-['Space_Grotesk'] text-base md:text-lg text-[#0b132b] dark:text-white font-bold mt-1">{r.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{r.place}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{r.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#00677d] dark:text-[#4cd6fb] group-hover:underline">
                  Explore <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>


      {/* SECTION 3: HOW RECORDS CONNECT */}
      <section className="w-full py-10 md:py-14 bg-[#eff4ff] dark:bg-[#0c162c] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <SectionHeader title="From one field photo to the classroom" text="Every record links to the ones around it, so a single observation can be followed all the way through." />

          <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {valueGraph.map((step) => (
              <li key={step.step} className={`${CARD} p-4`}>
                <span className="text-xs font-semibold text-[#00677d] dark:text-[#4cd6fb]">{step.step}</span>
                <h3 className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold">{step.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-snug mt-1">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SECTION 4: ARCHIVE SEARCH */}
      <section className="w-full bg-white dark:bg-[#0b132b] py-10 md:py-14 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div>
            <SectionHeader title="Search 40+ years of polar records" text="Reports, datasets, papers, photos and expedition logs, by keyword, place or year." />

            {/* Search box */}
            <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus-within:border-[#00b4d8] mb-3">
              <span className="material-symbols-outlined text-slate-400 text-[22px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Try “ozone Maitri 2023” or “Himadri glacier”"
                aria-label="Search the archive"
                className="min-w-0 flex-1 bg-transparent text-[#0b132b] dark:text-white text-base sm:text-sm py-2 focus:outline-none"
              />
              <button
                onClick={() => runSearch()}
                disabled={searching}
                className="px-4 py-2.5 rounded-lg bg-[#00677d] hover:bg-[#005466] disabled:opacity-60 text-white text-sm font-semibold shrink-0"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>

            {/* Sample Prompts */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs text-slate-500 mr-1">Try:</span>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchQuery(p);
                    runSearch(p);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 hover:bg-[#dce9ff] dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Search results */}
            {searchResults ? (
              <div className="p-4 md:p-5 rounded-2xl bg-[#eff4ff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[18px]">manage_search</span>
                    <span className="text-sm font-semibold text-[#0b132b] dark:text-white truncate">
                      {searchResults.total} record{searchResults.total === 1 ? '' : 's'} for “{searchResults.query}”
                    </span>
                  </div>
                  <button
                    onClick={() => setSearchResults(null)}
                    className="text-sm text-slate-500 hover:text-[#00677d] shrink-0"
                  >
                    Clear
                  </button>
                </div>

                {!searchResults.matchedAllTerms && searchResults.total > 0 && (
                  <p className="font-['Inter'] text-xs text-slate-500 mb-3">
                    No record matched every term; showing the closest matches.
                  </p>
                )}

                {searchResults.stations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {searchResults.stations.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onNavigate('stations');
                          onSelectStation(s.id);
                        }}
                        className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-[#00677d] dark:text-[#4cd6fb] font-semibold flex items-center gap-1 hover:border-[#00b4d8]"
                      >
                        <span className="material-symbols-outlined text-[14px]">home_pin</span>
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.total === 0 ? (
                  <p className="font-['Inter'] text-sm text-slate-500 py-6 text-center">
                    No records found. Try a station name, a year, or a topic such as “lidar” or “glacier”.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {searchResults.results.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => openResult(r)}
                        className="p-3 rounded-xl bg-white dark:bg-slate-800 flex items-start gap-2.5 text-left hover:border-[#00b4d8] border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[#00677d] dark:text-[#4cd6fb] text-[20px]">
                          {RESULT_ICON[r.type] ?? 'description'}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs text-slate-500 dark:text-slate-400 block capitalize">
                            {r.type}
                            {r.year ? ` · ${r.year}` : ''}
                            {r.meta?.sample ? ' · sample' : ''}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-white block">
                            {r.title}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            <Snippet text={r.snippet || r.summary} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* SECTION 5: POLAR ACADEMY */}
      <section id="academy" className="w-full py-10 md:py-14 bg-[#eff4ff] dark:bg-[#0c162c] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <SectionHeader title="Polar Academy" text="Student missions built on real polar data, from Grade 6 to undergraduate." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {simulations.map((mission) => (
              <div
                key={mission.id}
                className={`${CARD} overflow-hidden flex flex-col`}
              >
                <div className="relative h-40 sm:h-48 overflow-hidden">
                  <img
                    src={mission.imageUrl}
                    alt={mission.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-[#00677d] dark:text-[#4cd6fb] font-['Space_Grotesk'] text-[10px] font-bold">
                    {mission.category}
                  </span>
                </div>

                <div className="p-4 md:p-5 flex flex-col flex-grow justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {mission.grades} · {mission.subtopic}
                    </p>

                    <h3 className="font-['Space_Grotesk'] text-base font-bold text-[#0b132b] dark:text-white mb-2">
                      {mission.title}
                    </h3>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {mission.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{mission.duration}</span>
                    <button
                      onClick={() => onOpenSimulation(mission)}
                      className="px-4 py-2 rounded-lg bg-[#00677d] hover:bg-[#005466] text-white text-sm font-semibold transition-colors"
                    >
                      Start mission
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: PUBLICATIONS AND MEDIA */}
      <section className="w-full bg-white dark:bg-[#0b132b] py-10 md:py-14 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <SectionHeader title="Publications and media" text="Recent papers with their data, plus photos and film from the expeditions." />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
            {/* Left Papers (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {papers.slice(0, 3).map((paper) => (
                <div
                  key={paper.id}
                  className={`${CARD} p-4 md:p-5 flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#00677d] dark:text-[#4cd6fb]">
                        {paper.domain.charAt(0) + paper.domain.slice(1).toLowerCase()}
                      </span>
                      <span className="text-xs text-slate-400">
                        {paper.acceptedDate}
                      </span>
                    </div>

                    <h4
                      onClick={() => onOpenPaper(paper)}
                      className="font-['Space_Grotesk'] text-base text-[#0b132b] dark:text-white font-bold mb-2 leading-snug cursor-pointer hover:text-[#00b4d8]"
                    >
                      {paper.title}
                    </h4>

                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                      {paper.abstract}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400">{paper.authors}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onOpenPaper(paper)}
                        className="text-[#00b4d8] font-bold hover:underline"
                      >
                        {paper.doi ? `doi:${paper.doi}` : 'View record'}
                      </button>
                      <button
                        onClick={() => onOpenDataset(paper.dataFile)}
                        className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Data ({paper.fileSize})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Media (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Photo Vault */}
              <div className={`${CARD} overflow-hidden`}>
                <div className="relative h-44 sm:h-56 overflow-hidden group">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXLC_eTbIu7Pp6cXtgYdVVRLdi3D4fXKLmLMTu_otxXuCnaDa46kRdx2H9u_be79beIIbd2dQVtYeFu-MyvRHiLrF_OvXGEn2K4Iz8J_n8jgcbr6iH_mkyOJEgluSHNtEYjKy01iqHIvXJN9uSv0BEEJijltzFBspCa6duRX89z-nv0hyk1mhRsk1_eJypkfiS2osDO1GG9ioODBat3Wwx0cvrkeTGot1wx_sTogtK3WKbtOXTdclbHA"
                    alt="South Pole Traverse"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b132b]/85 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h5 className="font-['Space_Grotesk'] text-sm font-bold">South Pole Scientific Traverse 2010</h5>
                    <p className="font-['Inter'] text-[11px] text-slate-300">
                      NCPOR 8-member convoy reaching 90°S geographic pole under leader Dr. Rasik Ravindra.
                    </p>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Photo archive</span>
                  <button
                    onClick={onOpenMediaGallery}
                    className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline"
                  >
                    Browse gallery →
                  </button>
                </div>
              </div>

              {/* Video Log */}
              <div className={`${CARD} overflow-hidden`}>
                <div className="relative h-44 sm:h-56 overflow-hidden group">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDm7uk-cMc7q5baYLf6qczK8NShAjFvMFZj2ELleoB42kIyI5ixPI0GxGuAGyjtZQaKZdaW8mUS2eyH4l4twF8gXYamhcUpCoIwrTWq2_uys_3x5ESrIggrCigxfVN2PdTPF29ojVnv8waKyEJTrfqexB-CHYkM2qLfCG8eWdV8QB0sUuqsgGewTXoPA41vwcBC5zOxIzQBwD9To5Hh5OsnnY0B_ATj6EKfD6r0Gxz4WA-zrykXDNYHkw"
                    alt="Wintering Alone"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div
                    onClick={onOpenSkycam}
                    className="absolute inset-0 bg-[#0b132b]/40 flex items-center justify-center cursor-pointer"
                  >
                    <button className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-lg text-[#00677d] group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[32px] ml-1">play_arrow</span>
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h5 className="font-['Space_Grotesk'] text-sm font-bold">Wintering Alone: 280 Days in the Polar Darkness</h5>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">English and Hindi transcripts</span>
                  <button
                    onClick={onOpenSkycam}
                    className="text-[#00677d] dark:text-[#4cd6fb] font-bold hover:underline"
                  >
                    Watch →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: CALL FOR PROPOSALS */}
      <section className="w-full py-10 md:py-14 bg-[#eff4ff] dark:bg-[#0c162c] transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="rounded-2xl p-6 md:p-10 bg-[#0b132b] text-white">
            <p className="text-xs font-semibold text-[#4cd6fb] mb-2">Call for research proposals · 46th ISEA and the next Arctic season</p>
            <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold mb-3 leading-tight max-w-2xl">
              Propose fieldwork for the coming polar season
            </h2>
            <p className="text-sm md:text-base text-slate-300 mb-6 max-w-2xl leading-relaxed">
              Researchers from Indian institutions and international partners can apply for berths at Bharati, Maitri, Himadri and on the Sagar Nidhi cruises.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={onOpenProposal}
                className="px-5 py-3 rounded-xl bg-[#00b4d8] hover:bg-[#0096b4] text-[#0b132b] text-sm font-semibold transition-colors"
              >
                Submit a proposal
              </button>
              <span className="text-xs text-slate-400">Deadline to be announced</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
