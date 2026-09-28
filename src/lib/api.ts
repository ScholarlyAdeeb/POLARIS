import type { ExpeditionMilestone, HotspotInfo, ScientificPaper, SimulationMission, StationData } from '../types/polaris';

export type ArchiveType = 'expedition' | 'report' | 'dataset' | 'publication' | 'photo' | 'video' | 'activity';

export interface ArchiveItem {
  id: string;
  type: ArchiveType;
  title: string;
  summary: string;
  body: string;
  domain: string;
  stationId: string | null;
  year: number | null;
  date: string | null;
  tags: string[];
  url: string | null;
  thumbnailUrl: string | null;
  doi: string | null;
  meta: Record<string, any>;
  downloads: number;
}

export interface LinkedRecord {
  id: string;
  type: ArchiveType;
  title: string;
  relation: string;
  direction: 'in' | 'out';
}

export interface DatasetDetail extends ArchiveItem {
  header: string;
  links: LinkedRecord[];
}

export interface SearchResult extends ArchiveItem {
  snippet: string;
}

export interface SearchResponse {
  query: string;
  matchedAllTerms: boolean;
  total: number;
  results: SearchResult[];
  stations: { id: string; name: string; domain: string; locationName: string }[];
}

export interface BootstrapData {
  stations: StationData[];
  hotspots: Record<number, HotspotInfo>;
  milestones: ExpeditionMilestone[];
  papers: ScientificPaper[];
  simulations: SimulationMission[];
  valueGraph: { step: string; phase: string; title: string; desc: string; tag: string; color: string }[];
}

export type OutreachChannel = 'website' | 'x' | 'linkedin' | 'instagram';

export interface OutreachContent {
  channel: OutreachChannel;
  title?: string;
  slug?: string;
  metaDescription?: string;
  text: string;
  characters: number;
  limit?: number;
}

export interface ProposalInput {
  title: string;
  piName: string;
  affiliation: string;
  email: string;
  platform: string;
  domain?: string;
  summary: string;
  berths?: number | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body?.error || `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  bootstrap: () => request<BootstrapData>('/bootstrap'),
  search: (q: string, limit = 20) => request<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  archive: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    return request<{ items: ArchiveItem[]; total: number }>(`/archive?${qs}`);
  },
  record: (id: string) => request<ArchiveItem & { links: LinkedRecord[] }>(`/archive/${encodeURIComponent(id)}`),
  dataset: (ref: string) => request<DatasetDetail>(`/datasets/${encodeURIComponent(ref)}`),
  submitProposal: (p: ProposalInput) =>
    request<{ reference: string; status: string }>('/proposals', { method: 'POST', body: JSON.stringify(p) }),
  generateOutreach: (itemId: string, channels?: OutreachChannel[]) =>
    request<{ itemId: string; link: string; content: OutreachContent[] }>('/outreach/generate', {
      method: 'POST',
      body: JSON.stringify({ itemId, channels }),
    }),
};

export const downloadUrls = {
  dataset: (ref: string) => `/api/datasets/${encodeURIComponent(ref)}/download`,
  citation: (paperId: string) => `/api/publications/${encodeURIComponent(paperId)}/citation.bib`,
  metadata: (id: string) => `/api/archive/${encodeURIComponent(id)}/metadata.json`,
  synoptic: (stationId: string) => `/api/stations/${encodeURIComponent(stationId)}/synoptic.csv`,
  proposalTemplate: () => '/api/proposals/template',
};

/** Trigger a browser download of a server-generated file (server sets Content-Disposition). */
export function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
