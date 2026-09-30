import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

/**
 * API base URL.
 *
 * In a browser the app is served from the same origin as the API, so relative
 * `/api/...` requests are correct and nothing is configured here. Packaged
 * shells (Tauri desktop, and later Capacitor) load the same assets from a
 * custom origin such as `tauri://localhost`, where a relative path has no API
 * behind it — so those builds must supply VITE_API_BASE_URL at build time.
 *
 * Leaving it unset preserves existing browser behaviour exactly.
 */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
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
