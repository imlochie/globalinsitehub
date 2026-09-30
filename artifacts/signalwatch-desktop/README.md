# Signalwatch Desktop (Tauri)

A **thin shell** around the canonical Signalwatch web client. There is no
desktop-only product logic here by design — the desktop app serves exactly the
assets in `artifacts/signalwatch/dist/public`, so the desktop and browser
clients cannot drift apart.

## Status

Scaffolded and verified as configuration. **No `.exe` has been produced yet** —
see "Where builds run" below. `verify-desktop.mjs` checks the shell contract;
it does not and cannot claim the binary works.

## Why Tauri

Chosen over Electron for artifact size (~10 MB using the system WebView2
rather than shipping Chromium). MIT/Apache-2.0, no recurring cost.

## Where builds run

The Arena sandbox has **no Rust toolchain and no Windows host**, so it cannot
produce a Windows binary. Build on Windows (or a Windows CI runner):

```powershell
# prerequisites: Rust (rustup), Microsoft C++ Build Tools, WebView2 runtime
pnpm install
$env:VITE_API_BASE_URL = "https://<your-signalwatch-api-host>"
pnpm --filter @workspace/signalwatch-desktop run build
```

Output: `src-tauri/target/release/bundle/nsis/*.exe` (and `.msi`).

## The API base URL is mandatory

In a browser, Signalwatch is served from the same origin as its API, so
relative `/api/...` requests work and nothing needs configuring.

Tauri serves the frontend from `tauri://localhost`, where a relative `/api`
path has **no server behind it**. A desktop build must therefore supply an
absolute origin at build time:

```
VITE_API_BASE_URL=https://<api-host>
```

`src/main.tsx` applies it via `setBaseUrl()` only when set, so browser builds
are byte-for-byte unaffected.

Run the verifier with `VERIFY_DESKTOP_REQUIRE_API=1` to make a missing base URL
a hard failure for distributable builds.

**Open decision:** whether the desktop app should instead bundle the Node API
as a Tauri sidecar, making it fully self-contained and offline-capable. That is
larger work and has not been done.

## Signing

Builds are **unsigned**, which is the documented $0 posture. Windows SmartScreen
will warn on first run ("Windows protected your PC" → More info → Run anyway).
Removing that requires a commercial OV/EV code-signing certificate, a recurring
annual cost that has not been authorised. The verifier asserts no signing
thumbprint is configured so this stays a deliberate choice rather than drift.

## Verify

```bash
pnpm --filter @workspace/signalwatch-desktop run verify:desktop
```

Checks bundle identity, that the shell serves the canonical web build, NSIS
target presence, icon validity (`icon.ico` + 32/128/256 PNGs), the
`VITE_API_BASE_URL` contract, and that no paid dependency or signing
configuration has crept in.
