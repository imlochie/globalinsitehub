/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute API origin for packaged shells (Tauri desktop, Capacitor).
   * Unset in browser builds, where relative `/api` requests are correct.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    /** Absolute API origin injected by the Tauri desktop shell at launch. */
    __SIGNALWATCH_API_BASE__?: string;
    /** Marks the packaged desktop shell. Never set in a browser build. */
    __SIGNALWATCH_DESKTOP__?: boolean;
    /** Startup diagnostics, surfaced on screen in the desktop shell only. */
    __SIGNALWATCH_DIAG__?: Record<string, string>;
  }
}

export {};
