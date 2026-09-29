/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { DomainType, NavTab, ScientificPaper, SimulationMission } from './types/polaris';
import { Header } from './components/Header';
import { ExploreView } from './components/ExploreView';
import { BharatiStationView } from './components/BharatiStationView';
import { PolarMapView } from './components/PolarMapView';
import { Footer } from './components/Footer';

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
  const [activeTab, setActiveTab] = useState<NavTab>('explore');
  const [activeDomain, setActiveDomain] = useState<DomainType>('ANTARCTICA');
  const [isPolarNight, setIsPolarNight] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals state
  const [activeSimulation, setActiveSimulation] = useState<SimulationMission | null>(null);
  const [activePaper, setActivePaper] = useState<ScientificPaper | null>(null);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [skycamOpen, setSkycamOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const { papers } = usePolarisData();

  // Selected station
  const [selectedStationId, setSelectedStationId] = useState('bharati');

  // Apply polar night dark class to HTML
  useEffect(() => {
    if (isPolarNight) {
      document.documentElement.classList.add('dark', 'polar-night');
    } else {
      document.documentElement.classList.remove('dark', 'polar-night');
    }
  }, [isPolarNight]);

  const handleOpenSimulation = (mission: SimulationMission) => {
    setActiveSimulation(mission);
  };

  const handleOpenPaper = (paper: ScientificPaper) => {
    setActivePaper(paper);
  };

  const handleOpenDataset = (datasetName: string) => {
    setActiveDataset(datasetName);
  };

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

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] dark:bg-[#070c18] text-[#0b1c30] dark:text-[#e6f0ff] transition-colors">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDomain={activeDomain}
        setActiveDomain={setActiveDomain}
        isPolarNight={isPolarNight}
        setIsPolarNight={setIsPolarNight}
        language={language}
        setLanguage={setLanguage}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Main View Area */}
      <main className="w-full pt-24 flex-1">
        {activeTab === 'explore' && (
          <ExploreView
            onNavigate={setActiveTab}
            onSelectStation={(id) => {
              setSelectedStationId(id);
              setActiveTab('stations');
            }}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenProposal={() => setProposalModalOpen(true)}
            onOpenDataset={handleOpenDataset}
            onOpenRecord={handleOpenRecord}
            onOpenMediaGallery={() => setMediaGalleryOpen(true)}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'stations' && (
          <BharatiStationView
            onNavigate={setActiveTab}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenDataset={handleOpenDataset}
            onShowToast={handleShowToast}
          />
        )}

        {(activeTab === 'map' || activeTab === 'expeditions') && (
          <PolarMapView
            onNavigate={setActiveTab}
            onSelectStation={(id) => setSelectedStationId(id)}
            selectedStationId={selectedStationId}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'knowledge' && (
          <ExploreView
            onNavigate={setActiveTab}
            onSelectStation={(id) => {
              setSelectedStationId(id);
              setActiveTab('stations');
            }}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenProposal={() => setProposalModalOpen(true)}
            onOpenDataset={handleOpenDataset}
            onOpenRecord={handleOpenRecord}
            onOpenMediaGallery={() => setMediaGalleryOpen(true)}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'data' && (
          <PolarMapView
            onNavigate={setActiveTab}
            onSelectStation={(id) => setSelectedStationId(id)}
            selectedStationId={selectedStationId}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'media' && (
          <BharatiStationView
            onNavigate={setActiveTab}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenDataset={handleOpenDataset}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'learn' && (
          <ExploreView
            onNavigate={setActiveTab}
            onSelectStation={(id) => {
              setSelectedStationId(id);
              setActiveTab('stations');
            }}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenProposal={() => setProposalModalOpen(true)}
            onOpenDataset={handleOpenDataset}
            onOpenRecord={handleOpenRecord}
            onOpenMediaGallery={() => setMediaGalleryOpen(true)}
            onShowToast={handleShowToast}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={setActiveTab}
        onSelectStation={(id) => {
          setSelectedStationId(id);
          setActiveTab('stations');
        }}
      />

      {/* Interactive Global Modals */}
      <SimulationModal
        mission={activeSimulation}
        onClose={() => setActiveSimulation(null)}
      />

      <SkycamModal
        isOpen={skycamOpen}
        onClose={() => setSkycamOpen(false)}
      />

      <PaperModal
        paper={activePaper}
        onClose={() => setActivePaper(null)}
        onOpenDataset={handleOpenDataset}
      />

      <DatasetModal
        datasetName={activeDataset}
        onClose={() => setActiveDataset(null)}
        onOpenRecord={handleOpenRecord}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveTab}
        onSelectStation={(id) => setSelectedStationId(id)}
        onOpenResult={openArchiveRecord}
      />

      <ProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
      />

      <RecordModal
        recordId={activeRecordId}
        onClose={() => setActiveRecordId(null)}
        onOpenRecord={handleOpenRecord}
      />

      <MediaGalleryModal
        isOpen={mediaGalleryOpen}
        onClose={() => setMediaGalleryOpen(false)}
        onOpenRecord={handleOpenRecord}
      />

      {/* Non-intrusive Scientific Toast HUD */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
