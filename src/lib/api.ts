import type { ExpeditionMilestone, HotspotInfo, ScientificPaper, SimulationMission, StationData } from '../types/polaris';

export type ArchiveType = 'expedition' | 'report' | 'dataset' | 'publication' | 'photo' | 'video' | 'activity';
export type DataStatus = 'OFFICIAL' | 'VERIFIED' | 'EXTERNAL' | 'SAMPLE' | 'SYNTHETIC' | 'AI_GENERATED' | 'UNVERIFIED' | 'TEMPLATE';

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
  reviewNote?: string | null;
  ownerId?: number | null;
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
  provider: 'gemini' | 'deterministic';
  model: string | null;
  retrieval: { mode: 'hybrid' | 'lexical'; note: string | null };
  sources: AiSource[];
  verification: Verification;
}

export interface AiStatus {
  llm: {
    active: 'gemini' | 'deterministic';
    gemini: { configured: boolean; model: string };
  };
  ml: { available: boolean; url: string; model?: string; dim?: number; backend?: string };
  embeddings: number;
}

export interface OutreachPost {
  id: number;
  item_id: string;
  item_title?: string;
  item_data_status?: string;
  item_review_status?: string;
  author_name?: string | null;
  author_institution?: string | null;
  published_at?: string | null;
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

export type Role = 'contributor' | 'reviewer' | 'admin';
export interface User {
  id: number;
  email: string;
  name: string;
  institution: string;
  role: Role;
}

export interface MappingSuggestion {
  station: { id: string; name: string; reason: string } | null;
  region: string;
  related: { id: string; type: ArchiveType; title: string; year: number | null; relation: string; reason: string }[];
}

export interface RecordInput {
  type: ArchiveType;
  title: string;
  summary?: string;
  body?: string;
  stationId?: string | null;
  year?: number | null;
  date?: string | null;
  tags?: string[];
  url?: string | null;
  thumbnailUrl?: string | null;
  doi?: string | null;
  location?: { lat: number; lon: number } | null;
  links?: { id: string; relation: string }[];
}

export interface PublishedPost {
  id: number;
  item_id: string;
  channel: OutreachChannel;
  content: string;
  data_status: string;
  reviewer: string | null;
  published_at: string | null;
  updated_at: string;
  item_title: string;
  item_type: ArchiveType;
  item_thumbnail: string | null;
  item_station: string | null;
  author_id: number | null;
  author_name: string | null;
  author_institution: string | null;
}

export interface Submission extends ArchiveItem {
  ownerName: string;
  ownerInstitution: string;
  links: LinkedRecord[];
}

export interface AtlasPoint {
  id: string;
  type: ArchiveType;
  title: string;
  year: number | null;
  stationId: string | null;
  dataStatus: DataStatus;
  lat: number;
  lon: number;
  basis: 'record' | 'station';
  contributor: string | null;
}

export interface Series {
  x: string;
  columns: string[];
  rows: { x: string; values: number[] }[];
  truncated: boolean;
  source: string;
  dataStatus: string;
}

export interface StationWeather {
  stationId: string;
  location: { lat: number; lon: number };
  current: Record<string, number | string>;
  units: Record<string, string>;
  hourly: { time: string; temperature: number }[];
  source: string;
  note: string;
  fetchedAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explain: string;
  sourceId: string;
}

export interface LessonPack {
  region: string;
  stations: { id: string; name: string; locationName: string; description: string }[];
  records: { id: string; type: ArchiveType; title: string; summary: string; year: number | null; thumbnailUrl: string | null; dataStatus: DataStatus }[];
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

// Reviewer calls: the signed-in session cookie is sent automatically; the admin token is added when one was entered.
const adminRequest = <T,>(path: string, init?: RequestInit) =>
  request<T>(`/admin${path}`, { ...init, headers: { ...(adminToken.get() ? { authorization: `Bearer ${adminToken.get()}` } : {}), ...init?.headers } });

async function uploadFile(path: string, file: File) {
  const res = await fetch(`/api${path}`, { method: 'POST', body: file, headers: { 'x-filename': file.name } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error || `Upload failed (${res.status})`);
  return body as { url: string; kind: 'image' | 'video' | 'document' | 'data'; bytes: number; originalName: string };
}

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
  auth: {
    me: () => request<User | null>('/auth/me'),
    login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (b: { name: string; email: string; password: string; institution?: string }) =>
      request<User>('/auth/register', { method: 'POST', body: JSON.stringify(b) }),
    logout: () => request<null>('/auth/logout', { method: 'POST' }),
  },
  me: {
    upload: (file: File) => uploadFile('/me/uploads', file),
    suggest: (b: Partial<RecordInput> & { excludeId?: string }) => request<MappingSuggestion>('/me/suggest', { method: 'POST', body: JSON.stringify(b) }),
    records: () => request<ArchiveItem[]>('/me/records'),
    record: (id: string) => request<ArchiveItem & { links: LinkedRecord[] }>(`/me/records/${encodeURIComponent(id)}`),
    create: (b: RecordInput) => request<ArchiveItem>('/me/records', { method: 'POST', body: JSON.stringify(b) }),
    update: (id: string, b: Partial<RecordInput>) => request<ArchiveItem>(`/me/records/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(b) }),
    remove: (id: string) => request<null>(`/me/records/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    generate: (id: string, channels: OutreachChannel[], mode: 'ai' | 'template') =>
      request<OutreachPost[]>(`/me/records/${encodeURIComponent(id)}/content`, { method: 'POST', body: JSON.stringify({ channels, mode }) }),
    content: () => request<OutreachPost[]>('/me/content'),
    editContent: (id: number, content: string) => request<OutreachPost>(`/me/content/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  },
  published: (params: { channel?: string; user?: number } = {}) => request<PublishedPost[]>(`/content/published?${qs(params)}`),
  contributor: (id: number) =>
    request<{ id: number; name: string; institution: string; role: Role; created_at: string; records: ArchiveItem[]; publishedPosts: number }>(`/contributors/${id}`),
  atlas: () =>
    request<{ stations: { id: string; name: string; domain: string; status: string; lat: number; lon: number }[]; points: AtlasPoint[]; unmapped: number }>('/atlas'),
  learn: (seed?: number) => request<{ packs: LessonPack[]; quiz: QuizQuestion[]; seed: number }>(`/learn?${qs({ seed })}`),
  weather: (stationId: string) => request<StationWeather>(`/stations/${encodeURIComponent(stationId)}/weather`),
  cite: (id: string, format: 'apa' | 'bibtex' | 'ris') => request<{ format: string; text: string }>(`/archive/${encodeURIComponent(id)}/cite?format=${format}`),
  series: (id: string) => request<Series>(`/archive/${encodeURIComponent(id)}/series`),
  event: (path: string) => {
    fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }), keepalive: true }).catch(() => undefined);
  },
  admin: {
    overview: () => adminRequest<any>('/overview'),
    submissions: (review = 'PENDING_REVIEW') => adminRequest<Submission[]>(`/submissions?${qs({ review })}`),
    reviewRecord: (id: string, body: { action: 'approve' | 'request_changes' | 'reject'; note?: string; reviewer?: string; dataStatus?: string }) =>
      adminRequest<ArchiveItem>(`/archive/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(body) }),
    users: () => adminRequest<(User & { created_at: string; records: number })[]>('/users'),
    setRole: (id: number, role: Role) => adminRequest<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    analytics: (days = 30) => adminRequest<any>(`/analytics?${qs({ days })}`),
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
  cite: (id: string, format: 'apa' | 'bibtex' | 'ris') => `/api/archive/${encodeURIComponent(id)}/cite?format=${format}&download=1`,
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
