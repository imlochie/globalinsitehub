import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDir = path.join(appRoot, "dist", "public");
const manifest = JSON.parse(
  await readFile(path.join(distDir, "manifest.webmanifest"), "utf8"),
);
const html = await readFile(path.join(distDir, "index.html"), "utf8");
const viteConfig = await readFile(path.join(appRoot, "vite.config.ts"), "utf8");

assert.equal(manifest.id, "/", "PWA id should be rooted at the app origin");
assert.equal(manifest.start_url, "/", "PWA should start at the workspace route");
assert.equal(manifest.scope, "/", "PWA scope should cover existing routes");
assert.equal(manifest.display, "standalone", "PWA should open as an app");
assert.equal(manifest.theme_color, "#070a10");
assert.ok(
  manifest.shortcuts?.some((shortcut) => shortcut.url === "/map"),
  "PWA should retain a direct shortcut to /map",
);

const expectedIconSizes = new Map([
  ["192x192", [192, 192]],
  ["512x512", [512, 512]],
]);
for (const icon of manifest.icons ?? []) {
  const dimensions = expectedIconSizes.get(icon.sizes);
  if (!dimensions) continue;

  const iconPath = path.join(distDir, icon.src.replace(/^\/+/, ""));
  const png = await readFile(iconPath);
  assert.equal(
    png.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${icon.src} should be a PNG`,
  );
  assert.deepEqual(
    [png.readUInt32BE(16), png.readUInt32BE(20)],
    dimensions,
    `${icon.src} dimensions should match its manifest size`,
  );
  expectedIconSizes.delete(icon.sizes);
}
assert.equal(expectedIconSizes.size, 0, "192px and 512px icons are required");

const appleTouchIcon = await readFile(
  path.join(distDir, "apple-touch-icon.png"),
);
assert.equal(
  appleTouchIcon.subarray(0, 8).toString("hex"),
  "89504e470d0a1a0a",
  "Apple touch icon should be a PNG",
);
assert.deepEqual(
  [appleTouchIcon.readUInt32BE(16), appleTouchIcon.readUInt32BE(20)],
  [180, 180],
  "Apple touch icon should be 180x180",
);

assert.match(html, /rel="manifest"/, "built HTML should link the manifest");
assert.match(html, /apple-touch-icon\.png/, "iOS touch icon should be linked");
assert.match(
  html,
  /registerSW\.js|serviceWorker/,
  "built HTML should register the service worker",
);
assert.ok(
  (await readFile(path.join(distDir, "sw.js"), "utf8")).length > 0,
  "generated service worker should be present",
);
assert.match(viteConfig, /navigateFallback:\s*'index\.html'/);
assert.match(viteConfig, /navigateFallbackDenylist/);
assert.match(viteConfig, /pathname\.startsWith\('\/api\/'\)/);
assert.match(viteConfig, /handler:\s*'NetworkOnly'/);

console.log(
  "PWA output verified: standalone manifest, /map shortcut, 192/512 icons, iOS icon, service worker, and network-only API configuration.",
);