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
