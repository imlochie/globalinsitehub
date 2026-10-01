import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Builds the Signalwatch web client for the desktop bundle.
 *
 * This exists so the desktop build can set SIGNALWATCH_DESKTOP_BUILD without
 * relying on shell-specific environment syntax, which differs between cmd,
 * PowerShell and sh and had to work on all three.
 *
 * The flag makes vite-plugin-pwa emit a self-destroying service worker. Tauri
 * serves the app from `tauri.localhost`, which WebView2 treats as a secure
 * context, so a normal worker registers and then serves its cached
 * `index.html` on every later launch — which is how a freshly built
 * executable ends up running the previous frontend bundle.
 *
 * PORT and BASE_PATH are defaulted because the web vite config requires them,
 * and a desktop build should not depend on the caller having exported them.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const webRoot = path.resolve(projectRoot, "..", "signalwatch");

const env = {
  ...process.env,
  SIGNALWATCH_DESKTOP_BUILD: "1",
  PORT: process.env.PORT ?? "5173",
  BASE_PATH: process.env.BASE_PATH ?? "/",
};

console.log("• building the Signalwatch web client for the desktop bundle");
console.log("  service worker: self-destroying (desktop must not cache assets)");

execFileSync(
  process.execPath,
  [
    path.join(webRoot, "node_modules", "vite", "bin", "vite.js"),
    "build",
    "--config",
    "vite.config.ts",
  ],
  { cwd: webRoot, env, stdio: "inherit" },
);
