import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { normalizeEntryPath } from '@/lib/entry-path';
import {
  installDesktopCrashListeners,
  reportDesktopCrash,
} from '@/lib/desktop-diagnostics';

import './index.css';

// Installed before anything else can fail, so a chunk that never loads is
// still reported. No-op outside the packaged desktop shell.
installDesktopCrashListeners();

/**
 * API base URL resolution, in priority order:
 *
 *  1. `window.__SIGNALWATCH_API_BASE__` — injected at runtime by the Tauri
 *     desktop shell, which starts the bundled API on a port chosen at launch.
 *     A port picked at runtime cannot be expressed at build time.
 *  2. `VITE_API_BASE_URL` — build-time origin for packaged shells that talk to
 *     a fixed host.
 *  3. Nothing — the browser case, where the app is served from the same origin
 *     as the API and relative `/api/...` requests are already correct.
 *
 * Leaving both unset preserves existing browser behaviour exactly.
 */
const runtimeApiBaseUrl =
  typeof window !== 'undefined' ? window.__SIGNALWATCH_API_BASE__?.trim() : undefined;
const apiBaseUrl = runtimeApiBaseUrl || import.meta.env.VITE_API_BASE_URL?.trim();
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

/**
 * Rewrite a packaged shell's `index.html` entry path to its directory before
 * React mounts, so the router resolves the same routes as the browser. This is
 * a replaceState, so it adds no navigation entry, and it is a no-op for paths
 * that are already normal routes.
 */
if (typeof window !== 'undefined') {
  const normalized = normalizeEntryPath(window.location.pathname);
  if (normalized !== null) {
    window.history.replaceState(
      null,
      '',
      `${normalized}${window.location.search}${window.location.hash}`,
    );
  }
}

/**
 * Startup diagnostics.
 *
 * A packaged desktop build has no devtools, so console output alone is
 * invisible. These values are stashed for the error boundary to render on
 * screen when running inside the desktop shell. They are deliberately limited
 * to routing/runtime facts — no credentials or provider secrets.
 */
if (typeof window !== 'undefined') {
  window.__SIGNALWATCH_DIAG__ = {
    runtimeApiBaseUrl: runtimeApiBaseUrl ?? '(not injected)',
    apiBaseUrl: apiBaseUrl ?? '(relative, same-origin)',
    href: window.location.href,
    baseUrl: import.meta.env.BASE_URL,
    desktop: String(window.__SIGNALWATCH_DESKTOP__ === true),
  };
  console.info('signalwatch startup', window.__SIGNALWATCH_DIAG__);
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  // React calls this for every boundary-caught error, so it is the one hook
  // that cannot be suppressed by how a boundary chooses to render.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
    reportDesktopCrash(error, errorInfo.componentStack);
  },
  onUncaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
    reportDesktopCrash(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
