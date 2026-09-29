/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { NavTab, ScientificPaper, SimulationMission } from './types/polaris';
import { Header } from './components/Header';
import { ExploreView } from './components/ExploreView';
import { PolarMapView } from './components/PolarMapView';
import { Footer } from './components/Footer';
import { ExplorePage } from './pages/ExplorePage';
import { AssistantPage } from './pages/AssistantPage';
import { ContentStudioPage } from './pages/ContentStudioPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { ContributorPage, NewsroomPage } from './pages/NewsroomPage';
import { TimelinePage } from './pages/TimelinePage';
import { LearnPage } from './pages/LearnPage';

// Modals
import { SimulationModal } from './components/modals/SimulationModal';
import { SkycamModal } from './components/modals/SkycamModal';
import { PaperModal } from './components/modals/PaperModal';
import { DatasetModal } from './components/modals/DatasetModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { ProposalModal } from './components/modals/ProposalModal';
import { RecordModal } from './components/modals/RecordModal';
import { MediaGalleryModal } from './components/modals/MediaGalleryModal';
import { Toast, ToastMessage } from './components/Toast';
import { usePolarisData } from './context/PolarisDataContext';
import { api, type ArchiveItem } from './lib/api';

// Heavy routes (three.js, React Flow) load on demand.
const StationRoutes = lazy(() => import('./pages/StationPage').then((m) => ({ default: m.StationPage })));
const StationsIndex = lazy(() => import('./pages/StationPage').then((m) => ({ default: m.StationsIndex })));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage'));
const AtlasPage = lazy(() => import('./pages/AtlasPage'));

function recordToPaper(r: ArchiveItem): ScientificPaper {
  return {
    id: r.id,
    title: r.title,
    domain: r.domain,
    journal: r.meta.journal ?? '',
    acceptedDate: r.meta.acceptedDate ?? String(r.year ?? ''),
    abstract: r.summary,
    authors: r.meta.authors ?? '',
    doi: r.doi ?? '',
    dataFile: r.meta.dataFile ?? '',
    fileSize: r.meta.fileSize ?? '',
  };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [activeSimulation, setActiveSimulation] = useState<SimulationMission | null>(null);
  const [activePaper, setActivePaper] = useState<ScientificPaper | null>(null);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [skycamOpen, setSkycamOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const { papers } = usePolarisData();

  // Station picked on the map; read synchronously when the map asks to open it.
  const [selectedStationId, setSelectedStationId] = useState('bharati');
  const selectedRef = useRef(selectedStationId);
  const selectStation = (id: string) => {
    selectedRef.current = id;
    setSelectedStationId(id);
  };

  /** Legacy tab ids used inside the older views, mapped to routes. */
  const goTab = (tab: NavTab) => {
    const paths: Record<NavTab, string> = {
      explore: '/',
      expeditions: '/map',
      stations: `/stations/${selectedRef.current}`,
      map: '/map',
      knowledge: '/explore',
      data: '/explore?type=dataset',
      media: '/explore?type=photo,video',
      learn: '/#academy',
    };
    navigate(paths[tab]);
  };
  const openStation = (id: string) => {
    selectStation(id);
    navigate(`/stations/${id}`);
  };

  // Leaving a page closes any open viewer so it never covers the next page.
  useEffect(() => {
    setActiveDataset(null);
    setActivePaper(null);
    setActiveRecordId(null);
    setActiveSimulation(null);
    setMediaGalleryOpen(false);
    setSkycamOpen(false);
    setCommandPaletteOpen(false);
  }, [location.pathname]);

  // Anonymous page-view counter (path only) for the admin usage panel.
  useEffect(() => {
    api.event(location.pathname);
  }, [location.pathname]);

  // New page, new scroll position (hash links such as /#academy excepted).
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
      return;
    }
    const t = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150);
    return () => clearTimeout(t);
  }, [location.pathname, location.hash]);

  /** Open any archive record in the most specific viewer available. */
  const openArchiveRecord = (r: ArchiveItem) => {
    if (r.type === 'publication') return setActivePaper(papers.find((p) => p.id === r.id) ?? recordToPaper(r));
    if (r.type === 'dataset') return setActiveDataset(r.id);
    setActiveRecordId(r.id);
  };

  const handleOpenRecord = (id: string) => {
    setActivePaper(null);
    setActiveDataset(null);
    setMediaGalleryOpen(false);
    api
      .record(id)
      .then(openArchiveRecord)
      .catch(() => setActiveRecordId(id)); // RecordModal shows the error state
  };

  // Ctrl/Cmd+K toggles the command palette from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Deep links from generated outreach posts: /?record=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('record');
    if (id) handleOpenRecord(id);
  }, []);

  const handleShowToast = (message: string, title?: string, type?: 'info' | 'success' | 'warning') => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      title,
      type: type || 'info',
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const viewers = { onOpenDataset: setActiveDataset, onOpenRecord: handleOpenRecord };
  const loading = <div className="sci-page min-h-[60vh] flex items-center justify-center text-sm sci-muted">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30] transition-colors">
      <Header
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <main className="w-full pt-24 flex-1">
        <Suspense fallback={loading}>
          <Routes>
            <Route
              path="/"
              element={
                <ExploreView
                  onNavigate={goTab}
                  onSelectStation={openStation}
                  onOpenSimulation={setActiveSimulation}
                  onOpenPaper={setActivePaper}
                  onOpenSkycam={() => setSkycamOpen(true)}
                  onOpenProposal={() => setProposalModalOpen(true)}
                  onOpenDataset={setActiveDataset}
                  onOpenRecord={handleOpenRecord}
                  onOpenMediaGallery={() => setMediaGalleryOpen(true)}
                  onShowToast={handleShowToast}
                />
              }
            />
            <Route path="/explore" element={<ExplorePage {...viewers} />} />
            <Route
              path="/map"
              element={<PolarMapView onNavigate={goTab} onSelectStation={selectStation} selectedStationId={selectedStationId} onShowToast={handleShowToast} />}
            />
            <Route path="/stations" element={<StationsIndex />} />
            <Route path="/stations/:id" element={<StationRoutes {...viewers} />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraphPage {...viewers} />} />
            <Route path="/ai" element={<AssistantPage {...viewers} />} />
            <Route path="/content" element={<Navigate to="/content/review" replace />} />
            <Route path="/content/review" element={<ContentStudioPage />} />
            <Route path="/admin" element={<AdminPage onOpenRecord={handleOpenRecord} />} />
            <Route path="/atlas" element={<AtlasPage {...viewers} />} />
            <Route path="/timeline" element={<TimelinePage onOpenRecord={handleOpenRecord} />} />
            <Route path="/newsroom" element={<NewsroomPage />} />
            <Route path="/learn" element={<LearnPage onOpenRecord={handleOpenRecord} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/contributors/:id" element={<ContributorPage onOpenRecord={handleOpenRecord} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />

      <SimulationModal mission={activeSimulation} onClose={() => setActiveSimulation(null)} />
      <SkycamModal isOpen={skycamOpen} onClose={() => setSkycamOpen(false)} />
      <PaperModal paper={activePaper} onClose={() => setActivePaper(null)} onOpenDataset={setActiveDataset} />
      <DatasetModal
        datasetName={activeDataset}
        onClose={() => setActiveDataset(null)}
        onOpenRecord={handleOpenRecord}
        onAsk={(q) => {
          setActiveDataset(null);
          navigate(`/ai?q=${encodeURIComponent(q)}`);
        }}
        onDraft={(id) => {
          setActiveDataset(null);
          navigate(`/content/review?item=${encodeURIComponent(id)}`);
        }}
      />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={goTab}
        onSelectStation={selectStation}
        onOpenResult={openArchiveRecord}
      />
      <ProposalModal isOpen={proposalModalOpen} onClose={() => setProposalModalOpen(false)} />
      <RecordModal recordId={activeRecordId} onClose={() => setActiveRecordId(null)} onOpenRecord={handleOpenRecord} />
      <MediaGalleryModal isOpen={mediaGalleryOpen} onClose={() => setMediaGalleryOpen(false)} onOpenRecord={handleOpenRecord} />
      <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
