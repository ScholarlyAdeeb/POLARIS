export type DomainType = 'ANTARCTICA' | 'ARCTIC' | 'HIMALAYAS / THIRD POLE' | 'SOUTHERN OCEAN';

export type NavTab = 
  | 'explore'
  | 'expeditions'
  | 'stations'
  | 'map'
  | 'knowledge'
  | 'data'
  | 'media'
  | 'learn';

export interface HotspotInfo {
  id: string;
  tag: string;
  status: string;
  title: string;
  location: string;
  m1_label: string;
  m1_val: string;
  m1_sub: string;
  m2_label: string;
  m2_val: string;
  m2_sub: string;
  m3_label: string;
  m3_val: string;
  m3_sub: string;
  m4_label: string;
  m4_val: string;
  m4_sub: string;
  what: string;
  why: string;
  datasetTitle: string;
  datasetDoi: string;
  datasetSize: string;
  expeditionTitle: string;
  expeditionTeam: string;
  simulationTitle: string;
  simulationDuration: string;
}

export interface StationData {
  id: string;
  code: string;
  name: string;
  domain: string;
  locationName: string;
  coordinates: string;
  elevation: string;
  commissionYear: string;
  status: 'OPERATIONAL' | 'SEASONAL' | 'HISTORIC';
  temp: string;
  windChill: string;
  windSpeed: string;
  windDir: string;
  pressure: string;
  solarFlux: string;
  potableWater: string;
  waterPercent: string;
  powerDraw: string;
  fuelStatus: string;
  crewCurrent: number;
  crewMax: number;
  downlink: string;
  datasetsCount: number;
  imageUrl: string;
  description: string;
}

export interface ExpeditionMilestone {
  year: number;
  title: string;
  leader?: string;
  description: string;
  highlights: string[];
  latLng: [number, number];
  badge: string;
}

export interface ScientificPaper {
  id: string;
  title: string;
  domain: string;
  journal: string;
  acceptedDate: string;
  abstract: string;
  authors: string;
  doi: string;
  dataFile: string;
  fileSize: string;
}

export interface SimulationMission {
  id: string;
  title: string;
  category: string;
  grades: string;
  subtopic: string;
  duration: string;
  rating: string;
  studentsCount: string;
  description: string;
  imageUrl: string;
  badge: string;
}
