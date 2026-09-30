import { chmod, cp, mkdir, rm, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Prepares the Signalwatch API sidecar for a Tauri build.
 *
 * Design note — why the Node runtime is shipped rather than a single-file
 * executable: the API is bundled as ESM and pino emits sibling worker modules
 * (pino-worker.mjs, pino-file.mjs, pino-pretty.mjs) that are loaded at runtime.
 * Node's Single Executable Application feature supports only one embedded
 * CommonJS script, so it cannot represent this app. Shipping the runtime plus
 * the built output is the honest option: larger, but it actually runs.
 *
 * Output layout inside the bundle:
 *   resources/runtime/node[.exe]   the Node runtime for the build host
 *   resources/api/*.mjs            the built API
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const apiDir = path.join(workspaceRoot, "artifacts", "api-server");
const resourcesDir = path.join(projectRoot, "src-tauri", "resources");
const runtimeDir = path.join(resourcesDir, "runtime");
const apiOutDir = path.join(resourcesDir, "api");

console.log("• building the Signalwatch API");
execFileSync(process.execPath, ["build.mjs"], {
  cwd: apiDir,
  stdio: "inherit",
});

await rm(resourcesDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
await mkdir(apiOutDir, { recursive: true });

console.log("• copying the built API into resources/api");
await cp(path.join(apiDir, "dist"), apiOutDir, {
  recursive: true,
  // Source maps are large and are not needed in a shipped desktop bundle.
  filter: (src) => !src.endsWith(".map"),
});

const isWindows = process.platform === "win32";
const runtimeName = isWindows ? "node.exe" : "node";
const runtimeTarget = path.join(runtimeDir, runtimeName);

console.log(`• copying the Node runtime (${process.execPath})`);
await cp(process.execPath, runtimeTarget);
if (!isWindows) await chmod(runtimeTarget, 0o755);

const { size } = await stat(runtimeTarget);
console.log(
  [
    "",
    "Sidecar prepared:",
    `  runtime   resources/runtime/${runtimeName} (${(size / 1024 / 1024).toFixed(1)} MB, ${process.version})`,
    `  api       resources/api/index.mjs`,
    "",
    isWindows
      ? "  This runtime is a Windows build and is correct for a Windows bundle."
      : `  NOTE: this is a ${process.platform} runtime. A Windows .exe must be`,
    isWindows ? "" : "  prepared on Windows so that node.exe is bundled instead.",
  ]
    .filter(Boolean)
    .join("\n"),
);
