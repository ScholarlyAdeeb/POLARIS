import React, { Component, Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Hotspot } from '../lib/api';

/**
 * Procedural WebGL scene for a station page. This is a CONCEPTUAL MODEL:
 * shapes are chosen from the station type (stilted modules, hut cluster, ship),
 * not surveyed geometry. Hotspots come from /api/stations/:id/hotspots.
 */

type Kind = 'stilts' | 'huts' | 'ship' | 'historic';

export function sceneKind(stationId: string, status?: string): Kind {
  if (stationId.includes('sagar')) return 'ship';
  if (status === 'HISTORIC') return 'historic';
  if (stationId === 'bharati') return 'stilts';
  return 'huts';
}

const HULL = '#9aa8b8';
const MODULE = '#c8412f';
const MODULE_2 = '#e7ecf2';

function Stilts() {
  const modules: [number, number, number][] = [];
  for (let x = -3; x <= 3; x += 1.5) for (const z of [-0.8, 0.8]) modules.push([x, 1.6, z]);
  for (let x = -1.5; x <= 1.5; x += 1.5) modules.push([x, 2.55, 0]);
  return (
    <group>
      {[-3.4, -1.1, 1.1, 3.4].flatMap((x) =>
        [-1.1, 1.1].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.55, z]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 1.1, 10]} />
            <meshStandardMaterial color="#5b6675" metalness={0.6} roughness={0.4} />
          </mesh>
        ))
      )}
      {modules.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[1.42, 0.9, 1.5]} />
          <meshStandardMaterial color={i % 3 === 0 ? MODULE_2 : MODULE} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Huts() {
  const huts: [number, number, number, number][] = [
    [-2.6, 0.5, -0.6, 1.2],
    [-0.6, 0.6, -1.2, 1.4],
    [1.6, 0.5, -0.2, 1.1],
    [0.2, 0.45, 1.4, 1.0],
    [2.8, 0.4, 1.6, 0.8],
  ];
  return (
    <group>
      {huts.map(([x, h, z, w], i) => (
        <mesh key={i} position={[x, h, z]} castShadow>
          <boxGeometry args={[w * 1.6, h * 2, w]} />
          <meshStandardMaterial color={i % 2 ? MODULE : MODULE_2} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Ship() {
  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[7, 1, 1.8]} />
        <meshStandardMaterial color="#1f3b5c" roughness={0.5} />
      </mesh>
      <mesh position={[-0.8, 1.45, 0]} castShadow>
        <boxGeometry args={[2.6, 0.9, 1.4]} />
        <meshStandardMaterial color={MODULE_2} />
      </mesh>
      <mesh position={[-0.8, 2.2, 0]} castShadow>
        <boxGeometry args={[1.4, 0.6, 1.2]} />
        <meshStandardMaterial color={MODULE_2} />
      </mesh>
      <mesh position={[2.3, 1.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
        <meshStandardMaterial color="#5b6675" />
      </mesh>
    </group>
  );
}

function Common({ kind }: { kind: Kind }) {
  if (kind === 'ship') return null;
  return (
    <group>
      <mesh position={[3.9, 1.2, -1.8]} castShadow>
        <sphereGeometry args={[0.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f5f7fa" roughness={0.3} />
      </mesh>
      <mesh position={[3.9, 0.6, -1.8]}>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 24]} />
        <meshStandardMaterial color="#dfe5ec" />
      </mesh>
      <mesh position={[-4.2, 1.5, 1.6]}>
        <cylinderGeometry args={[0.04, 0.05, 3, 8]} />
        <meshStandardMaterial color="#5b6675" />
      </mesh>
    </group>
  );
}

function Ground({ kind }: { kind: Kind }) {
  const hills = useMemo(
    () => Array.from({ length: 9 }, (_, i) => [Math.cos(i * 0.7) * (14 + (i % 3) * 3), Math.sin(i * 0.7) * (14 + (i % 3) * 3), 1.5 + (i % 4)] as const),
    []
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={kind === 'ship' ? '#1d4e73' : '#eef3f8'} roughness={kind === 'ship' ? 0.2 : 0.9} />
      </mesh>
      {kind !== 'ship' &&
        hills.map(([x, z, h], i) => (
          <mesh key={i} position={[x, h / 2 - 0.05, z]}>
            <coneGeometry args={[h * 1.3, h, 7]} />
            <meshStandardMaterial color={i % 2 ? '#6b7684' : '#e8edf3'} roughness={1} flatShading />
          </mesh>
        ))}
    </group>
  );
}

/** Text label drawn to a canvas texture: pure WebGL, no extra React roots, no font download. */
function Label({ text, active }: { text: string; active: boolean }) {
  const { texture, aspect } = useMemo(() => {
    const scale = 3;
    const font = `600 ${15 * scale}px Inter, "Segoe UI", Arial, sans-serif`;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 16 * scale;
    const h = 26 * scale;
    c.width = w;
    c.height = h;
    ctx.font = font;
    ctx.fillStyle = active ? '#00677d' : 'rgba(255,255,255,0.92)';
    const r = 6 * scale;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
    ctx.fillStyle = active ? '#ffffff' : '#0b1c30';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 8 * scale, h / 2 + scale);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: w / h };
  }, [text, active]);
  useEffect(() => () => texture.dispose(), [texture]);
  const height = 0.34;
  return (
    <sprite position={[0, 0.5, 0]} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

function hotspotPosition(i: number, n: number): [number, number, number] {
  const angle = (i / Math.max(n, 1)) * Math.PI * 2 + 0.4;
  const r = 3.2 + (i % 2) * 1.4;
  return [Math.cos(angle) * r, 1.4 + (i % 3) * 0.7, Math.sin(angle) * r];
}

const STATUS_COLOR: Record<string, string> = {
  OFFICIAL: '#10b981',
  VERIFIED: '#14b8a6',
  EXTERNAL: '#6366f1',
  UNVERIFIED: '#94a3b8',
  SAMPLE: '#f59e0b',
  SYNTHETIC: '#f97316',
  AI_GENERATED: '#8b5cf6',
};

function Hotspots({ hotspots, selected, onSelect }: { hotspots: Hotspot[]; selected: string | null; onSelect: (key: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <>
      {hotspots.map((h, i) => {
        const pos = hotspotPosition(i, hotspots.length);
        const active = selected === h.key || hover === h.key;
        return (
          <group key={h.key} position={pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelect(h.key);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(h.key);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[active ? 0.26 : 0.2, 24, 16]} />
              <meshStandardMaterial color={STATUS_COLOR[h.dataStatus] ?? '#38bdf8'} emissive={active ? '#0ea5e9' : '#000000'} emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0, -pos[1] / 2, 0]}>
              <cylinderGeometry args={[0.012, 0.012, pos[1], 6]} />
              <meshBasicMaterial color="#64748b" />
            </mesh>
            <Label text={`${i + 1}. ${h.label}`} active={active} />
          </group>
        );
      })}
    </>
  );
}

class WebGlBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="h-full flex items-center justify-center text-sm sci-muted p-6 text-center">
          3D view unavailable (WebGL not supported on this device). Use the hotspot list instead.
        </div>
      );
    return this.props.children;
  }
}

export default function StationScene({
  stationId,
  stationStatus,
  hotspots,
  selected,
  onSelect,
}: {
  stationId: string;
  stationStatus?: string;
  hotspots: Hotspot[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const kind = sceneKind(stationId, stationStatus);
  return (
    <WebGlBoundary>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [9, 7, 11], fov: 42 }} onPointerMissed={() => undefined}>
        <color attach="background" args={['#dbe9f6']} />
        <fog attach="fog" args={['#dbe9f6', 22, 48]} />
        <hemisphereLight args={['#dbeafe', '#1e293b', 0.7]} />
        <directionalLight position={[8, 12, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <Ground kind={kind} />
          {kind === 'stilts' && <Stilts />}
          {(kind === 'huts' || kind === 'historic') && <Huts />}
          {kind === 'ship' && <Ship />}
          <Common kind={kind} />
          <Hotspots hotspots={hotspots} selected={selected} onSelect={onSelect} />
        </Suspense>
        <OrbitControls enableDamping minDistance={6} maxDistance={26} maxPolarAngle={Math.PI / 2.15} target={[0, 1.2, 0]} />
      </Canvas>
    </WebGlBoundary>
  );
}
