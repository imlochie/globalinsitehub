import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/**
 * Detects the packaged desktop shell.
 *
 * Four independent signals, because relying on a single one has already cost a
 * build cycle: the injected marker, Tauri's Windows asset origin
 * (`tauri.localhost`), its custom scheme on other platforms (`tauri:`), and
 * the `__TAURI_INTERNALS__` object Tauri v2 always injects. None of these can
 * be present in an ordinary browser, so production web builds are unaffected.
 */
function isSignalwatchDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.__SIGNALWATCH_DESKTOP__ === true ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.protocol === 'tauri:' ||
    '__TAURI_INTERNALS__' in window
  );
}

/**
 * Error detail is shown in development and inside the packaged desktop shell.
 *
 * The desktop build has no devtools, so without this a crash is a blank
 * "Something went wrong" with no way to diagnose it. Ordinary production
 * browser/PWA builds are unchanged and still hide internals, because messages
 * can carry API responses.
 */
function showsErrorDetail(): boolean {
  return import.meta.env.DEV || isSignalwatchDesktop();
}

/**
 * Runtime facts, read at render time rather than taken from a value recorded
 * during startup, so they are still correct if the crash happened before that
 * startup code ran. Deliberately limited to routing/runtime values: no
 * credentials, API keys or provider secrets.
 */
function runtimeDiagnostics(): Array<[string, string]> {
  if (typeof window === 'undefined') return [];
  const show = (value: unknown): string =>
    value === undefined ? '(unset)' : value === null ? '(null)' : String(value);
  return [
    ['href', show(window.location.href)],
    ['hostname', show(window.location.hostname)],
    ['protocol', show(window.location.protocol)],
    ['apiBase', show(window.__SIGNALWATCH_API_BASE__)],
    ['desktopMarker', show(window.__SIGNALWATCH_DESKTOP__)],
    ['tauriInternals', show('__TAURI_INTERNALS__' in window)],
    ['baseUrl', show(import.meta.env.BASE_URL)],
  ];
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  const detailed = showsErrorDetail();
  const diagnostics = detailed ? runtimeDiagnostics() : [];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This part of the app hit an error. The rest of the app is still
          running.
        </p>
        {/*
          Always rendered, deliberately unobtrusive: it tells us at a glance
          whether a packaged build actually contains the current diagnostics,
          instead of leaving "no detail shown" ambiguous between a stale build
          and a detection failure.
        */}
        <p className="mt-1 text-[10px] text-gray-400" data-testid="text-error-revision">
          diagnostics r2
        </p>
        {detailed ? (
          <pre
            className="mt-4 max-h-64 overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800"
            data-testid="text-error-detail"
          >
            {error.message || String(error)}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        ) : null}
        {detailed && diagnostics.length > 0 ? (
          <pre
            className="mt-2 overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800"
            data-testid="text-error-diagnostics"
          >
            {diagnostics.map(([key, value]) => `${key}: ${value}`).join('\n')}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
