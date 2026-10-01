import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { normalizeEntryPath } from "../src/lib/entry-path";

/**
 * Packaged shells (Tauri today, Capacitor later) load the app as
 * `index.html`, which matches none of the declared routes. Without
 * normalization the desktop build opens on Not Found while appearing to work.
 */
test("an index.html entry path is rewritten to its directory", () => {
  assert.equal(normalizeEntryPath("/index.html"), "/");
  assert.equal(normalizeEntryPath("/app/index.html"), "/app/");
});

test("ordinary routes are left untouched", () => {
  for (const path of ["/", "/map", "/sectors", "/sources", "/not-index.html-ish"]) {
    assert.equal(normalizeEntryPath(path), null, path);
  }
});
