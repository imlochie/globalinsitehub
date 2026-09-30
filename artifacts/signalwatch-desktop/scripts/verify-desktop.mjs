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

// --- API reachability from a custom origin --------------------------------
/**
 * Tauri serves the frontend from tauri://localhost, where a relative "/api"
 * request has no server behind it. A desktop build therefore MUST supply
 * VITE_API_BASE_URL. This is checked as a build-time requirement so the
 * failure surfaces here rather than as an empty app.
 */
const mainTsx = await readFile(
  path.join(projectRoot, "..", "signalwatch", "src", "main.tsx"),
  "utf8",
);
assert.match(
  mainTsx,
  /VITE_API_BASE_URL/,
  "the web client must honour VITE_API_BASE_URL for packaged shells",
);

const configuredBaseUrl = process.env.VITE_API_BASE_URL?.trim();
if (process.env.VERIFY_DESKTOP_REQUIRE_API === "1") {
  assert.ok(
    configuredBaseUrl,
    "VITE_API_BASE_URL must be set for a distributable desktop build",
  );
  assert.match(
    configuredBaseUrl,
    /^https?:\/\//,
    "VITE_API_BASE_URL must be an absolute origin",
  );
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
    `  API base URL ${configuredBaseUrl ?? "not set (required for distributable builds)"}`,
    "  signing      none (unsigned, $0 posture)",
  ].join("\n"),
);
