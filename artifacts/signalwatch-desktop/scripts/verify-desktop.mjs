import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Desktop shell verification.
 *
 * Mirrors verify-pwa.mjs: it checks the things that must be true for a Tauri
 * Windows build to produce a correct Signalwatch, without requiring the Rust
 * toolchain. It deliberately does NOT claim the .exe works — only a real build
 * on a Windows host can establish that.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const tauriDir = path.join(projectRoot, "src-tauri");
const config = JSON.parse(
  await readFile(path.join(tauriDir, "tauri.conf.json"), "utf8"),
);

// --- identity -------------------------------------------------------------
assert.equal(config.productName, "Signalwatch");
assert.match(
  config.identifier,
  /^[a-z0-9]+(\.[a-z0-9-]+)+$/,
  "bundle identifier must be reverse-DNS and is effectively permanent",
);
assert.ok(
  !config.identifier.endsWith(".app"),
  "identifier must not keep the create-tauri-app placeholder suffix",
);

// --- the desktop shell must serve the canonical web client ----------------
const frontendDist = path.resolve(tauriDir, config.build.frontendDist);
assert.ok(
  frontendDist.includes(path.join("artifacts", "signalwatch", "dist")),
  "desktop must serve the canonical Signalwatch web build, not its own copy",
);
const indexHtml = path.join(frontendDist, "index.html");
try {
  await stat(indexHtml);
} catch {
  assert.fail(
    `frontendDist has no index.html at ${indexHtml} — run the Signalwatch web build first`,
  );
}

// The shell must not fork product logic: no app source of its own beyond the
// Rust entry points.
const rustSources = ["src/main.rs", "src/lib.rs", "build.rs"];
for (const file of rustSources) {
  await stat(path.join(tauriDir, file));
}

// --- Windows bundle targets and icons -------------------------------------
const targets = config.bundle?.targets ?? [];
assert.ok(
  Array.isArray(targets) && targets.includes("nsis"),
  "Windows build must produce an NSIS installer (.exe)",
);

const iconIco = path.join(tauriDir, "icons", "icon.ico");
const ico = await readFile(iconIco);
assert.equal(
  ico.subarray(0, 4).toString("hex"),
  "00000100",
  "icon.ico must be a real ICO file",
);

const requiredPngs = new Map([
  ["icons/32x32.png", [32, 32]],
  ["icons/128x128.png", [128, 128]],
  ["icons/128x128@2x.png", [256, 256]],
]);
for (const [relative, dimensions] of requiredPngs) {
  const png = await readFile(path.join(tauriDir, relative));
  assert.equal(
    png.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${relative} must be a PNG`,
  );
  assert.deepEqual(
    [png.readUInt32BE(16), png.readUInt32BE(20)],
    dimensions,
    `${relative} dimensions must match its name`,
  );
}

// --- service worker must not cache the packaged frontend ----------------
/**
 * Tauri serves from `tauri.localhost`, which WebView2 treats as a secure
 * context, so a precaching service worker will register and then serve its
 * cached index.html on every later launch — a freshly built executable then
 * silently runs the previous bundle. The desktop frontend build emits a
 * self-destroying worker instead; this asserts the staged assets are that
 * build and not the web variant.
 */
const swPath = path.join(frontendDist, "sw.js");
let swSource = null;
try {
  swSource = await readFile(swPath, "utf8");
} catch {
  // No worker at all is also acceptable for a desktop bundle.
}
if (swSource !== null) {
  assert.match(
    swSource,
    /registration\.unregister\(\)/,
    "the packaged frontend ships a caching service worker; rebuild it with scripts/build-frontend.mjs so the worker self-destructs",
  );
  assert.doesNotMatch(
    swSource,
    /precacheAndRoute|workbox-/,
    "the packaged frontend must not precache assets",
  );
}

// --- API reachability: the bundled sidecar ------------------------------
/**
 * Tauri serves the frontend from tauri://localhost, where a relative "/api"
 * request has no server behind it. The shell therefore starts the real
 * Signalwatch API from bundled resources on a runtime-chosen port and injects
 * the origin as window.__SIGNALWATCH_API_BASE__.
 *
 * These checks verify that contract end to end, short of compiling Rust.
 */
const mainTsx = await readFile(
  path.join(projectRoot, "..", "signalwatch", "src", "main.tsx"),
  "utf8",
);
assert.match(
  mainTsx,
  /__SIGNALWATCH_API_BASE__/,
  "the web client must honour the runtime-injected API origin",
);
assert.match(
  mainTsx,
  /VITE_API_BASE_URL/,
  "the web client must still honour a build-time origin as a fallback",
);

const libRs = await readFile(path.join(tauriDir, "src", "lib.rs"), "utf8");
assert.match(libRs, /__SIGNALWATCH_API_BASE__/, "the shell must inject the API origin");
assert.match(
  libRs,
  /127\.0\.0\.1:0/,
  "the shell must request a free port rather than hardcoding one",
);
assert.match(
  libRs,
  /RunEvent::Exit/,
  "the shell must terminate the API when the app exits",
);

assert.ok(
  Array.isArray(config.bundle?.resources) &&
    config.bundle.resources.some((entry) => entry.startsWith("resources/runtime")) &&
    config.bundle.resources.some((entry) => entry.startsWith("resources/api")),
  "the bundle must ship the Node runtime and the built API",
);
assert.match(
  config.app?.security?.csp ?? "",
  /connect-src[^;]*http:\/\/127\.0\.0\.1:\*/,
  "CSP must allow the frontend to reach the loopback sidecar",
);
assert.match(
  String(config.build?.beforeBuildCommand ?? ""),
  /prepare-sidecar/,
  "the build must prepare the sidecar before bundling",
);

// --- direct provider media must survive the WebView2 CSP ------------------
/**
 * Signalwatch deliberately loads provider media straight from the provider:
 * camera stills, and since Weather Batch 1 the NOAA radar WMS tiles. Nothing
 * is relayed through the API server.
 *
 * That makes the desktop CSP part of the provider integration surface. The
 * packaged app runs in WebView2, which enforces this policy, so a CSP that
 * omits remote images would break radar and cameras *only in the installed
 * build* — passing every test and every browser check first.
 *
 * Leaflet requests WMS tiles as <img> elements, so `img-src` is the governing
 * directive. This asserts the policy still permits them.
 */
const csp = config.app?.security?.csp ?? "";
const imgSrc = /img-src([^;]*)/.exec(csp)?.[1] ?? "";
assert.ok(
  /\bhttps:/.test(imgSrc) ||
    /mapservices\.weather\.noaa\.gov/.test(imgSrc),
  "CSP img-src must permit remote HTTPS images, or the packaged app cannot load NOAA radar tiles or provider camera stills (both load browser -> provider by design)",
);
assert.doesNotMatch(
  csp,
  /img-src[^;]*'none'/,
  "CSP img-src 'none' would disable all provider media in the desktop build",
);

// The staged runtime must match the platform being bundled. Copying a Linux
// node into a Windows .exe is the single most likely packaging mistake here,
// because prepare-sidecar.mjs copies the *build host's* runtime.
const RUNTIME_MAGIC = {
  win32: { hex: "4d5a", label: "PE/COFF (.exe)" },
  linux: { hex: "7f45", label: "ELF" },
  darwin: { hex: "cffa", label: "Mach-O" },
};

async function assertRuntimeMatchesTarget(target) {
  const name = target === "win32" ? "node.exe" : "node";
  const binary = path.join(tauriDir, "resources", "runtime", name);
  let head;
  try {
    const handle = await readFile(binary);
    head = handle.subarray(0, 2).toString("hex");
  } catch {
    assert.fail(
      `no ${name} staged in resources/runtime — run scripts/prepare-sidecar.mjs on the ${target} build host`,
    );
  }
  const expected = RUNTIME_MAGIC[target];
  assert.equal(
    head,
    expected.hex,
    `resources/runtime/${name} must be a ${expected.label} binary for a ${target} bundle`,
  );
}

const bundleTarget = process.env.VERIFY_DESKTOP_TARGET ?? process.platform;
if (process.env.VERIFY_DESKTOP_REQUIRE_RUNTIME === "1") {
  await assertRuntimeMatchesTarget(bundleTarget);
}

// The prepared sidecar, when present, must actually run and serve the API.
const runtimeName = process.platform === "win32" ? "node.exe" : "node";
const runtimeBin = path.join(tauriDir, "resources", "runtime", runtimeName);
const apiEntry = path.join(tauriDir, "resources", "api", "index.mjs");
let sidecarChecked = false;
try {
  await stat(runtimeBin);
  await stat(apiEntry);
  sidecarChecked = true;
} catch {
  console.warn(
    "  ! sidecar resources not prepared; run scripts/prepare-sidecar.mjs to verify it boots",
  );
}

if (sidecarChecked && process.env.VERIFY_DESKTOP_BOOT_SIDECAR === "1") {
  const { spawn } = await import("node:child_process");
  const net = await import("node:net");
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

  const child = spawn(runtimeBin, [apiEntry], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
    stdio: "ignore",
  });
  try {
    const deadline = Date.now() + 20_000;
    let healthy = false;
    while (Date.now() < deadline && !healthy) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/healthz`);
        healthy = response.ok;
      } catch {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    assert.ok(healthy, "the bundled sidecar must answer /api/healthz");
  } finally {
    child.kill();
  }
}

// --- cost posture ---------------------------------------------------------
const cargoToml = await readFile(path.join(tauriDir, "Cargo.toml"), "utf8");
assert.doesNotMatch(
  cargoToml,
  /license-key|subscription/i,
  "no paid dependency may be introduced",
);
assert.ok(
  config.bundle?.windows?.certificateThumbprint === undefined,
  "code signing is not configured; unsigned builds are the documented $0 default",
);

console.log(
  [
    "Desktop shell verified:",
    `  product      ${config.productName} (${config.identifier})`,
    `  frontend     ${path.relative(projectRoot, frontendDist)}`,
    `  targets      ${targets.join(", ")}`,
    "  icons        icon.ico + 32/128/256 PNGs valid",
    `  API           bundled sidecar on a runtime-chosen loopback port`,
    `  sidecar files ${sidecarChecked ? "prepared" : "NOT prepared (run prepare-sidecar.mjs)"}`,
    `  bundle target ${bundleTarget}`,
    `  service worker ${swSource === null ? "absent" : "self-destroying"}`,
    "  signing      none (unsigned, $0 posture)",
  ].join("\n"),
);
