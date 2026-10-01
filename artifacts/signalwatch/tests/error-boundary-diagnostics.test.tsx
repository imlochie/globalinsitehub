import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";

/**
 * The packaged desktop shell has no devtools, so the error boundary is the
 * only place a crash can be read. These guard the detection contract.
 */
test("desktop detection does not depend on a single signal", async () => {
  const source = await readFile(
    new URL("../src/lib/desktop-diagnostics.ts", import.meta.url),
    "utf8",
  );
  for (const signal of [
    "__SIGNALWATCH_DESKTOP__",
    "tauri.localhost",
    "'tauri:'",
    "__TAURI_INTERNALS__",
  ]) {
    assert.ok(source.includes(signal), `missing desktop signal: ${signal}`);
  }
});

test("error detail stays hidden in ordinary production web builds", async () => {
  const source = await readFile(
    new URL("../src/components/error-boundary.tsx", import.meta.url),
    "utf8",
  );
  // Detail is gated behind DEV or the desktop runtime; never unconditional.
  assert.match(source, /return import\.meta\.env\.DEV \|\| isSignalwatchDesktop\(\);/);
  assert.match(source, /\{detailed \? \(/);
});

test("diagnostics carry runtime facts and no secrets", async () => {
  const source = await readFile(
    new URL("../src/lib/desktop-diagnostics.ts", import.meta.url),
    "utf8",
  );
  for (const key of ["href", "hostname", "protocol", "apiBase", "baseUrl"]) {
    assert.ok(source.includes(`${key}:`), `missing diagnostic: ${key}`);
  }
  for (const secret of ["TFNSW_API_KEY", "BARENTSWATCH", "Authorization", "token"]) {
    assert.ok(!source.includes(secret), `diagnostics must not expose ${secret}`);
  }
});

test("crash reporting bypasses React and the boundary's own gate", async () => {
  const diagnostics = await readFile(
    new URL("../src/lib/desktop-diagnostics.ts", import.meta.url),
    "utf8",
  );
  // Written straight into the DOM, so it cannot be hidden by how a boundary
  // decides to render, and it also catches chunk-load failures.
  assert.match(diagnostics, /document\.body\.appendChild/);
  assert.match(diagnostics, /addEventListener\('error'/);
  assert.match(diagnostics, /addEventListener\('unhandledrejection'/);
  assert.match(diagnostics, /if \(!isSignalwatchDesktop\(\)\) return;/);

  const main = await readFile(
    new URL("../src/main.tsx", import.meta.url),
    "utf8",
  );
  assert.match(main, /onCaughtError[\s\S]*reportDesktopCrash/);
  assert.match(main, /installDesktopCrashListeners\(\);/);
});
