import type { ExpeditionMilestone, HotspotInfo, ScientificPaper, SimulationMission, StationData } from '../types/polaris';

export type ArchiveType = 'expedition' | 'report' | 'dataset' | 'publication' | 'photo' | 'video' | 'activity';
export type DataStatus = 'OFFICIAL' | 'VERIFIED' | 'SAMPLE' | 'SYNTHETIC' | 'AI_GENERATED' | 'UNVERIFIED' | 'TEMPLATE';

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
  dataStatus: DataStatus;
  provenance: Record<string, any>;
  reviewStatus: string;
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
  score?: number;
  lexicalRank?: number | null;
  semanticRank?: number | null;
  semanticScore?: number | null;
}

export interface SearchFilters {
  type?: string;
  domain?: string;
  station?: string;
  yearFrom?: string;
  yearTo?: string;
  theme?: string;
  status?: string;
}

export interface SearchResponse {
  query: string;
  mode?: 'hybrid' | 'lexical';
  semanticNote?: string | null;
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

export interface Facets {
  domains: string[];
  types: string[];
  dataStatuses: string[];
  stations: { id: string; name: string }[];
  years: { min: number | null; max: number | null };
  themes: string[];
}

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  year?: number | null;
  stationId?: string | null;
  domain?: string;
  dataStatus: string;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  origin: string;
}

export interface Hotspot {
  key: string;
  kind: 'instrument' | 'record';
  label: string;
  title: string;
  dataStatus: string;
  itemId: string | null;
  itemType: string | null;
  summary?: string;
  info?: import('../types/polaris').HotspotInfo;
}

export interface ClaimCheck {
  sentence: string;
  status: 'supported' | 'partial' | 'unsupported' | 'no_claim';
  citations: string[];
  overlap: number;
  missingNumbers: string[];
}
export interface Verification {
  claims: ClaimCheck[];
  supported: number;
  partial: number;
  unsupported: number;
  checked: number;
  nonAuthoritativeSources: string[];
}

export interface AiSource {
  ref: string;
  id: string;
  type: string;
  title: string;
  dataStatus: string;
  year: number | null;
  stationId: string | null;
  excerpt: string;
}

export interface AiAnswer {
  question: string;
  answer: string;
  provider: 'gemini' | 'ollama' | 'deterministic';
  model: string | null;
  retrieval: { mode: 'hybrid' | 'lexical'; note: string | null };
  sources: AiSource[];
  verification: Verification;
}

export interface AiStatus {
  llm: {
    active: 'gemini' | 'ollama' | 'deterministic';
    gemini: { configured: boolean; model: string };
    ollama: { reachable: boolean; modelInstalled: boolean; url: string; model: string };
  };
  ml: { available: boolean; url: string; model?: string; dim?: number; backend?: string };
  embeddings: number;
}

export interface OutreachPost {
  id: number;
  item_id: string;
  item_title?: string;
  item_data_status?: string;
  channel: OutreachChannel;
  content: string;
  status: string;
  data_status: string;
  review_status: 'PENDING_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  provider: string;
  claim_check: Partial<Verification>;
  reviewer: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const TOKEN_KEY = 'polaris-admin-token';
export const adminToken = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (t: string) => {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

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

const qs = (params: Record<string, string | number | undefined | null>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]).toString();

const adminRequest = <T,>(path: string, init?: RequestInit) =>
  request<T>(`/admin${path}`, { ...init, headers: { authorization: `Bearer ${adminToken.get()}`, ...init?.headers } });

export const api = {
  bootstrap: () => request<BootstrapData>('/bootstrap'),
  search: (q: string, limit = 20, filters: SearchFilters = {}) => request<SearchResponse>(`/search?${qs({ q, limit, ...filters })}`),
  facets: () => request<Facets>('/facets'),
  graph: (station?: string) => request<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/graph?${qs({ station })}`),
  station: (id: string) =>
    request<import('../types/polaris').StationData & { archiveCounts: Record<string, number>; dataStatus: string; readingsStatus: string }>(
      `/stations/${encodeURIComponent(id)}`
    ),
  hotspots: (id: string) => request<{ stationId: string; hotspots: Hotspot[] }>(`/stations/${encodeURIComponent(id)}/hotspots`),
  aiStatus: () => request<AiStatus>('/ai/status'),
  ask: (question: string, filters: SearchFilters = {}) =>
    request<AiAnswer>('/ai/ask', { method: 'POST', body: JSON.stringify({ question, filters }) }),
  admin: {
    overview: () => adminRequest<any>('/overview'),
    rebuildEmbeddings: () => adminRequest<{ embedded: number; model: string; dim: number }>('/embeddings/rebuild', { method: 'POST' }),
    updateRecord: (id: string, patch: Record<string, unknown>) =>
      adminRequest<ArchiveItem>(`/archive/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    proposals: () => adminRequest<any[]>('/proposals'),
    setProposal: (ref: string, status: string) =>
      adminRequest<any>(`/proposals/${encodeURIComponent(ref)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    outreach: (review?: string) => adminRequest<OutreachPost[]>(`/outreach?${qs({ review })}`),
    draft: (itemId: string, channel: OutreachChannel, mode: 'ai' | 'template') =>
      adminRequest<OutreachPost & { aiRequested: boolean; aiUsed: boolean }>('/outreach/draft', {
        method: 'POST',
        body: JSON.stringify({ itemId, channel, mode }),
      }),
    review: (id: number, body: { action: string; content?: string; reviewer?: string; note?: string }) =>
      adminRequest<OutreachPost>(`/outreach/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
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
