/**
 * Desktop crash diagnostics.
 *
 * A packaged Tauri build has no devtools, so a frontend exception is otherwise
 * invisible: React's error boundary renders a generic fallback and the console
 * goes nowhere the user can see.
 *
 * This module provides two things:
 *
 *  1. `isSignalwatchDesktop()` — the single source of truth for "are we in the
 *     packaged shell", used by the error boundary and by the crash reporter.
 *  2. `reportDesktopCrash()` — writes the error straight into the DOM, outside
 *     React. It is driven from `createRoot`'s `onCaughtError`, which React
 *     calls for every boundary-caught error, and from global error listeners.
 *     That path cannot be suppressed by how a boundary chooses to render, and
 *     it also catches failures React never sees at all, such as a module or
 *     dynamic import that fails to load.
 *
 * Nothing here is active in a browser: every detection signal is specific to
 * the Tauri runtime, so production web builds are untouched.
 */

const OVERLAY_ID = 'signalwatch-desktop-crash';

export function isSignalwatchDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.__SIGNALWATCH_DESKTOP__ === true ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.protocol === 'tauri:' ||
    '__TAURI_INTERNALS__' in window
  );
}

/**
 * Runtime facts worth knowing when the app fails to start. Routing and
 * transport values only — no credentials, API keys or provider secrets.
 */
export function desktopDiagnosticLines(): string[] {
  if (typeof window === 'undefined') return [];
  const show = (value: unknown): string =>
    value === undefined ? '(unset)' : value === null ? '(null)' : String(value);
  return [
    `href: ${show(window.location.href)}`,
    `hostname: ${show(window.location.hostname)}`,
    `protocol: ${show(window.location.protocol)}`,
    `apiBase: ${show(window.__SIGNALWATCH_API_BASE__)}`,
    `desktopMarker: ${show(window.__SIGNALWATCH_DESKTOP__)}`,
    `tauriInternals: ${show('__TAURI_INTERNALS__' in window)}`,
    `baseUrl: ${show(import.meta.env.BASE_URL)}`,
  ];
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/**
 * Renders the crash into the document, bypassing React entirely.
 *
 * Appends rather than replaces, so several errors accumulate instead of the
 * last one hiding the first — the first is usually the useful one.
 */
export function reportDesktopCrash(
  value: unknown,
  componentStack?: string | null,
): void {
  if (!isSignalwatchDesktop()) return;
  if (typeof document === 'undefined' || document.body === null) return;

  const error = toError(value);
  const body = [
    `${error.name}: ${error.message}`,
    '',
    error.stack ?? '(no stack)',
    componentStack ? `\ncomponent stack:${componentStack}` : '',
    '',
    ...desktopDiagnosticLines(),
  ].join('\n');

  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay === null) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('data-testid', 'desktop-crash-overlay');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'overflow:auto',
      'background:#0b1020',
      'color:#e6edf3',
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'padding:16px',
      'white-space:pre-wrap',
      'word-break:break-word',
    ].join(';');
    document.body.appendChild(overlay);
  }

  const entry = document.createElement('pre');
  entry.style.cssText = 'margin:0 0 16px;white-space:pre-wrap;word-break:break-word';
  entry.textContent = body;
  overlay.appendChild(entry);
}

/**
 * Catches failures React never routes through a boundary — a chunk that fails
 * to load, or a rejected promise outside the render tree.
 */
export function installDesktopCrashListeners(): void {
  if (!isSignalwatchDesktop()) return;
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportDesktopCrash(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportDesktopCrash(event.reason);
  });
}
