import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, type BootstrapData } from '../lib/api';
import {
  HOTSPOT_DATA,
  STATIONS_DATA,
  EXPEDITION_MILESTONES,
  SCIENTIFIC_PAPERS,
  SIMULATION_MISSIONS,
  VALUE_GRAPH_STEPS,
} from '../data/polarisData';

interface PolarisData extends BootstrapData {
  /** 'static' until the API responds; stays 'static' if the backend is unreachable. */
  source: 'static' | 'api';
}

// The bundled data doubles as first-paint content and as an offline fallback.
const FALLBACK: PolarisData = {
  stations: STATIONS_DATA,
  hotspots: HOTSPOT_DATA,
  milestones: EXPEDITION_MILESTONES,
  papers: SCIENTIFIC_PAPERS,
  simulations: SIMULATION_MISSIONS,
  valueGraph: VALUE_GRAPH_STEPS,
  source: 'static',
};

const PolarisDataContext = createContext<PolarisData>(FALLBACK);

export const PolarisDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<PolarisData>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    api
      .bootstrap()
      .then((d) => {
        if (!cancelled) setData({ ...d, source: 'api' });
      })
      .catch((err) => console.warn('[POLARIS] API unavailable, using bundled data:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return <PolarisDataContext.Provider value={data}>{children}</PolarisDataContext.Provider>;
};

export const usePolarisData = () => useContext(PolarisDataContext);
