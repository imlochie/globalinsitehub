import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

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
declare global {
  interface Window {
    __SIGNALWATCH_API_BASE__?: string;
  }
}

const runtimeApiBaseUrl =
  typeof window !== 'undefined' ? window.__SIGNALWATCH_API_BASE__?.trim() : undefined;
const apiBaseUrl = runtimeApiBaseUrl || import.meta.env.VITE_API_BASE_URL?.trim();
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
