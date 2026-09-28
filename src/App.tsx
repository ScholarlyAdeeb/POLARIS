/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DomainType, NavTab, ScientificPaper, SimulationMission } from './types/polaris';
import { Header } from './components/Header';
import { ExploreView } from './components/ExploreView';
import { BharatiStationView } from './components/BharatiStationView';
import { PolarMapView } from './components/PolarMapView';
import { Footer } from './components/Footer';

// Modals
import { PolarAIModal } from './components/modals/PolarAIModal';
import { SimulationModal } from './components/modals/SimulationModal';
import { SkycamModal } from './components/modals/SkycamModal';
import { PaperModal } from './components/modals/PaperModal';
import { DatasetModal } from './components/modals/DatasetModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { ProposalModal } from './components/modals/ProposalModal';
import { Toast, ToastMessage } from './components/Toast';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('explore');
  const [activeDomain, setActiveDomain] = useState<DomainType>('ANTARCTICA');
  const [isPolarNight, setIsPolarNight] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiStationContext, setAiStationContext] = useState('Bharati & Maitri');

  const [activeSimulation, setActiveSimulation] = useState<SimulationMission | null>(null);
  const [activePaper, setActivePaper] = useState<ScientificPaper | null>(null);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [skycamOpen, setSkycamOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);

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

  const handleOpenAI = (initialQuery?: string, station?: string) => {
    if (initialQuery) setAiQuery(initialQuery);
    if (station) setAiStationContext(station);
    setAiModalOpen(true);
  };

  const handleOpenSimulation = (mission: SimulationMission) => {
    setActiveSimulation(mission);
  };

  const handleOpenPaper = (paper: ScientificPaper) => {
    setActivePaper(paper);
  };

  const handleOpenDataset = (datasetName: string) => {
    setActiveDataset(datasetName);
  };

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
        onOpenAI={() => handleOpenAI()}
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
            onOpenAI={handleOpenAI}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenProposal={() => setProposalModalOpen(true)}
            onOpenDataset={handleOpenDataset}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'stations' && (
          <BharatiStationView
            onNavigate={setActiveTab}
            onOpenAI={handleOpenAI}
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
            onOpenAI={handleOpenAI}
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
            onOpenAI={handleOpenAI}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenProposal={() => setProposalModalOpen(true)}
            onOpenDataset={handleOpenDataset}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'data' && (
          <PolarMapView
            onNavigate={setActiveTab}
            onSelectStation={(id) => setSelectedStationId(id)}
            onOpenAI={handleOpenAI}
            selectedStationId={selectedStationId}
            onShowToast={handleShowToast}
          />
        )}

        {activeTab === 'media' && (
          <BharatiStationView
            onNavigate={setActiveTab}
            onOpenAI={handleOpenAI}
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
            onOpenAI={handleOpenAI}
            onOpenSimulation={handleOpenSimulation}
            onOpenPaper={handleOpenPaper}
            onOpenSkycam={() => setSkycamOpen(true)}
            onOpenProposal={() => setProposalModalOpen(true)}
            onOpenDataset={handleOpenDataset}
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
      <PolarAIModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        initialQuery={aiQuery}
        stationContext={aiStationContext}
      />

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
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveTab}
        onSelectStation={(id) => setSelectedStationId(id)}
        onOpenAIWithQuery={(q) => handleOpenAI(q)}
      />

      <ProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
      />

      {/* Non-intrusive Scientific Toast HUD */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
