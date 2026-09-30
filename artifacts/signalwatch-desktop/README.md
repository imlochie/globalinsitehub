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
pnpm --filter @workspace/signalwatch-desktop run build
```

`beforeBuildCommand` builds the web client and then runs
`scripts/prepare-sidecar.mjs`, which builds the API and copies **the build
host's** Node runtime into `resources/runtime`. That runtime must therefore be
`node.exe` — i.e. **the Windows bundle must be prepared on Windows.** The
script says so explicitly when run on another platform.

Output: `src-tauri/target/release/bundle/nsis/*.exe` (and `.msi`).

## Self-contained: the API ships inside the app

The shell starts the **real Signalwatch API** from bundled resources at launch:

```
Signalwatch.exe
  ├─ React/Vite UI            (artifacts/signalwatch/dist/public)
  ├─ Node runtime             (resources/runtime/node.exe)
  └─ Signalwatch API          (resources/api/index.mjs)
          └─ live public providers over the user's internet connection
```

The port is chosen at runtime (`127.0.0.1:0`), so two instances never collide,
and the origin is injected into the page as `window.__SIGNALWATCH_API_BASE__`
before it mounts. The API binds loopback only and is killed when the app exits.

**The executable does not depend on any hosted service.** It does not depend on
Replit running.

### Self-contained is not offline-live-data

The bundled API still reaches the public providers — cameras, civic incidents,
natural hazards, AIS — over the user's internet connection. Without
connectivity the app runs, but those layers degrade honestly and report their
providers as unavailable, exactly as they do on the web. Nothing is cached and
replayed as if it were current.

### Why the Node runtime is shipped rather than a single-file binary

The API is bundled as ESM and pino emits sibling worker modules
(`pino-worker.mjs`, `pino-file.mjs`, `pino-pretty.mjs`) loaded at runtime.
Node's Single Executable Application feature supports only **one embedded
CommonJS script**, so it cannot represent this app. Shipping the runtime is
larger (~119 MB) but actually runs. That is a deliberate trade, and it is the
main reason the bundle is closer to Electron's size than Tauri's usual ~10 MB.

## Build-time API origin (fallback)

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

This build-time variable remains as a fallback for shells that talk to a fixed
remote host. The desktop build does not need it — the sidecar takes priority.

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
target presence, icon validity (`icon.ico` + 32/128/256 PNGs), the sidecar
contract (free-port selection, origin injection, shutdown on exit, bundled
resources, loopback CSP), and that no paid dependency or signing configuration
has crept in.

Add `VERIFY_DESKTOP_BOOT_SIDECAR=1` to actually launch the prepared sidecar and
require it to answer `/api/healthz`.
