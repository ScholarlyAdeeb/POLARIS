import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Background, Controls, MarkerType, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api, type GraphEdge, type GraphNode } from '../lib/api';
import { usePolarisData } from '../context/PolarisDataContext';
import { ErrorNote, Page, PageHeader } from '../components/ui';

const COLUMNS: Record<string, number> = { station: 0, expedition: 1, dataset: 2, publication: 3, report: 4, photo: 5, video: 5, activity: 5 };
const COLOR: Record<string, string> = {
  station: '#00677d',
  expedition: '#1d4ed8',
  dataset: '#c2410c',
  publication: '#7c3aed',
  report: '#0f766e',
  photo: '#64748b',
  video: '#64748b',
  activity: '#64748b',
};
const STATUS_RING: Record<string, string> = { SAMPLE: '#f59e0b', SYNTHETIC: '#f97316', AI_GENERATED: '#8b5cf6', OFFICIAL: '#10b981', VERIFIED: '#14b8a6' };

function layout(nodes: GraphNode[], edges: GraphEdge[]): { nodes: Node[]; edges: Edge[] } {
  const rows: Record<number, number> = {};
  const out: Node[] = nodes.map((n) => {
    const col = COLUMNS[n.kind] ?? 5;
    const row = (rows[col] = (rows[col] ?? -1) + 1);
    return {
      id: n.id,
      position: { x: col * 280, y: row * 74 },
      data: { label: n.label, raw: n },
      style: {
        width: 240,
        fontSize: 11,
        lineHeight: 1.25,
        textAlign: 'left',
        borderRadius: 10,
        border: `2px solid ${STATUS_RING[n.dataStatus] ?? 'var(--pol-border)'}`,
        borderLeft: `6px solid ${COLOR[n.kind] ?? '#64748b'}`,
        background: 'var(--pol-surface)',
        color: 'var(--pol-ink)',
        padding: '6px 8px',
      },
    };
  });
  const out2: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.relation.replace(/_/g, ' '),
    labelStyle: { fontSize: 10, fill: 'var(--pol-muted)' },
    labelBgStyle: { fill: 'var(--pol-surface)' },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    style: { stroke: e.origin === 'item_links' ? '#0ea5e9' : '#94a3b8', strokeDasharray: e.origin === 'item_links' ? undefined : '4 4' },
  }));
  return { nodes: out, edges: out2 };
}

export function KnowledgeGraphPage({ onOpenDataset, onOpenRecord }: { onOpenDataset: (ref: string) => void; onOpenRecord: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const station = params.get('station') ?? '';
  const navigate = useNavigate();
  const { stations } = usePolarisData();
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGraph(null);
    api
      .graph(station || undefined)
      .then(setGraph)
      .catch((e) => setError(e.message));
  }, [station]);

  const flow = useMemo(() => (graph ? layout(graph.nodes, graph.edges) : null), [graph]);
  const relCount = graph?.edges.filter((e) => e.origin === 'item_links').length ?? 0;

  return (
    <Page>
      <PageHeader
        title="Knowledge graph"
        text="Stations, expeditions, datasets and publications, with every edge read from the database: solid lines are item_links relations, dashed lines are records located at a station."
      >
        <select value={station} onChange={(e) => setParams(e.target.value ? { station: e.target.value } : {})} className="sci-input" aria-label="Filter by station">
          <option value="">All stations</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </PageHeader>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-3 text-xs sci-muted mb-3">
        {Object.entries({ station: 'Station', expedition: 'Expedition', dataset: 'Dataset', publication: 'Publication', report: 'Report', photo: 'Media / activity' }).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLOR[k] }} /> {v}
          </span>
        ))}
        <span>· Border colour = data status (amber sample, orange synthetic)</span>
        {graph && (
          <span className="sci-mono">
            · {graph.nodes.length} nodes, {graph.edges.length} edges ({relCount} relations)
          </span>
        )}
      </div>
      <div className="h-[65vh] min-h-[420px] rounded-2xl border sci-border overflow-hidden" style={{ background: 'var(--pol-surface-2)' }}>
        {flow ? (
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            fitView
            minZoom={0.2}
            nodesConnectable={false}
            onNodeClick={(_, n) => {
              const raw = (n.data as any).raw as GraphNode;
              if (raw.kind === 'station') navigate(`/stations/${raw.id.replace('station:', '')}`);
              else if (raw.kind === 'dataset') onOpenDataset(raw.id);
              else onOpenRecord(raw.id);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        ) : (
          <div className="h-full flex items-center justify-center sci-muted text-sm">Loading graph…</div>
        )}
      </div>
    </Page>
  );
}

export default KnowledgeGraphPage;
