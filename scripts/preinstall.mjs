#!/usr/bin/env node
/**
 * Cross-platform preinstall guard.
 *
 * Replaces a `sh -c '...'` one-liner that could not run on a clean Windows
 * checkout: Command Prompt and PowerShell have no `sh`, so `pnpm install`
 * failed before it began unless the developer had Git Bash or WSL. This script
 * preserves the original intent exactly, using only Node APIs, so it behaves
 * identically on Windows, Linux and macOS.
 *
 * Intent preserved:
 *   1. Remove stray npm/yarn lockfiles so they cannot drift from pnpm-lock.yaml.
 *   2. Refuse installs run through npm or yarn rather than pnpm.
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1. Competing lockfiles ----------------------------------------------------
for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  // force: true makes a missing file a no-op, matching `rm -f`.
  rmSync(path.join(repoRoot, lockfile), { force: true });
}

// 2. Package manager enforcement -------------------------------------------
/**
 * npm sets npm_config_user_agent to something like:
 *   "pnpm/11.25.0 npm/? node/v24.20.0 win32 x64"
 * The original check matched the `pnpm/` prefix, so this does the same.
 *
 * The variable is absent when the script is executed directly (for example by
 * a developer or a test), which is not an install and must not fail.
 */
const userAgent = process.env.npm_config_user_agent;

if (userAgent && !userAgent.startsWith("pnpm/")) {
  const detected = userAgent.split(" ")[0] ?? userAgent;
  console.error(
    [
      "Use pnpm instead",
      "",
      `  detected package manager: ${detected}`,
      "  this workspace is pnpm-only (pnpm-workspace.yaml, catalog: protocol,",
      "  workspace:* links and an onlyBuiltDependencies allowlist).",
      "",
      "  corepack enable && pnpm install",
    ].join("\n"),
  );
  process.exit(1);
}
