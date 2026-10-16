import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, type Location } from 'react-router-dom';

/**
 * PowerPoint-style "morph" between pages with the View Transitions API.
 *
 * The app renders the location this hook returns, not the router's. When the router moves to a new page,
 * the hook swaps inside document.startViewTransition: the browser snapshots the old page, React renders the
 * new one, and every element with the same view-transition-name in both (the header, the active-tab pill,
 * page and station titles) animates from its old box to its new one; the rest cross-fades.
 *
 * Names are applied only while `html.vt-page` is set (see index.css), so they never interfere with the boot
 * splash or ordinary rendering. Same-page changes, reduced motion and browsers without the API swap instantly.
 */
export function useMorphLocation(): Location {
  const location = useLocation();
  const [shown, setShown] = useState(location);

  useEffect(() => {
    if (location.key === shown.key) return;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const instant =
      location.pathname === shown.pathname ||
      !doc.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      Boolean(document.getElementById('boot')); // the boot splash runs its own transition
    if (instant) {
      setShown(location);
      return;
    }
    let cancelled = false;
    // Load the next page's code first (the current page stays usable), so the "after" snapshot is the real
    // page and not a Suspense placeholder; then morph.
    (async () => {
      await preloadRoute(location.pathname);
      if (cancelled) return;
      const root = document.documentElement;
      root.classList.add('vt-page');
      const t = doc.startViewTransition!(() => {
        flushSync(() => setShown(location));
        if (!location.hash) window.scrollTo(0, 0);
      });
      t.finished.finally(() => root.classList.remove('vt-page'));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return shown;
}

// ---- route code loading --------------------------------------------------------------------------------

type Loader = () => Promise<unknown>;
const routeLoaders: [(path: string) => boolean, Loader][] = [];

/** Tells the morph which code a path needs, so it can load it before the transition starts. */
export function registerRoute(match: (path: string) => boolean, load: Loader) {
  routeLoaders.push([match, load]);
}

function preloadRoute(path: string): Promise<unknown> {
  const hits = routeLoaders.filter(([m]) => m(path)).map(([, load]) => load().catch(() => undefined));
  // Never hold a navigation for long: after 2.5 s morph anyway (Suspense shows its fallback).
  return Promise.race([Promise.all(hits), new Promise((r) => setTimeout(r, 2500))]);
}

/**
 * React.lazy whose module can be loaded ahead of time with `.preload()`. Once loaded it renders directly,
 * without the one-render Suspense pause React.lazy always takes the first time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<P extends object = any>(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  let loaded: React.ComponentType<P> | null = null;
  let pending: Promise<React.ComponentType<P>> | null = null;
  const load = () => (pending ??= factory().then((m) => (loaded = m.default)));
  const Lazy = React.lazy(() => load().then((c) => ({ default: c })));
  const Component = (props: P) => React.createElement((loaded ?? Lazy) as React.ComponentType<P>, props);
  return Object.assign(Component, { preload: load });
}

/** Style that gives an element a morph name during page transitions (see `.vt-named` in index.css). */
export const morphName = (name: string) => ({ ['--vt-name' as string]: name.replace(/[^A-Za-z0-9_-]/g, '-') }) as React.CSSProperties;
