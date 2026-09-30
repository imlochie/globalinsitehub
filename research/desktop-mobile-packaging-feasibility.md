# Windows .exe + Android APK packaging — feasibility gate

Status: **RESEARCH COMPLETE, AWAITING SCOPING DECISIONS.** Nothing implemented.
Baseline `2421319d3654fa8f10f08f3554dc2c8fb41a2723`. Recorded 2026-09-30.

---

## 0. Headline: neither artifact can be produced in the Arena sandbox

This is an environment limit, not a project blocker, and it is stated up front
so no one waits for a binary that cannot appear here.

| Requirement | Sandbox state | Consequence |
| --- | --- | --- |
| JDK | **absent** (`java: command not found`) | no Gradle build |
| Android SDK / `sdkmanager` / `adb` | **absent**, `ANDROID_HOME` unset | no APK |
| `dl.google.com` | **blocked** by the egress allowlist (HTTP 000) | the SDK cannot even be downloaded |
| Wine | **absent** | `electron-builder` cannot produce a Windows installer from Linux |
| Rust / cargo | **absent** | Tauri cannot build |
| NSIS | **absent** | no Windows installer packaging |
| `registry.npmjs.org` | reachable (HTTP 200) | npm dependencies *can* be installed |
| Disk | 20 GB free | not the constraint |

So the deliverable from Arena is **configuration, scripts, native project
generation and verification harnesses** that run correctly in a
toolchain-equipped environment. The binaries themselves must be produced on
Replit, a developer machine, or CI.

That split is the same honesty convention already used for providers:
*contract-verified here, artifact-verified where the toolchain exists.*

---

## 1. What already exists

- `artifacts/signalwatch` — Vite + React web app. **Now an installable PWA**
  (merged at `2421319`): manifest, service worker, 192/512 icons, `/map`
  shortcut, `verify-pwa.mjs` gate.
- `artifacts/signalwatch-mobile` — **Expo SDK 57** app (`expo-router`,
  React Native 0.86.3, React 19.2.3), managed workflow. `app.json` has a
  `slug`, `scheme`, and an Android `adaptiveIcon`, but **no `android.package`
  identifier and no `versionCode`** — both are required before any APK.
- `artifacts/signalwatch-mobile/assets/images/icon.png` — genuine 1024×1024
  brand asset (the source used to repair the PWA 512 icon).

---

## 2. Windows .exe — options

### Important prior question: is a PWA enough?

As of `2421319`, Signalwatch is already installable on Windows via Edge or
Chrome ("Install app"), producing a windowed, icon-bearing desktop entry with
an offline service worker. That is **$0, already built, already verified**.

A packaged `.exe` buys: distribution without a browser, offline installation
from a file, file associations, and a conventional installer. If those are not
actually needed, the cheapest correct answer is "we already shipped it".

### Option A — Electron + electron-builder

- Licence: MIT, free. No recurring cost.
- Produces `.exe` (NSIS installer or portable).
- Wraps the existing Vite build directly; lowest engineering risk.
- Cost: ~150 MB artifact; ships a Chromium runtime.
- **Cannot be built here** (needs Wine on Linux, or a Windows machine/runner).

### Option B — Tauri

- Licence: MIT/Apache-2.0, free.
- Much smaller artifact (~10 MB); uses the system WebView2 on Windows.
- Requires Rust, and cross-compiling Linux→Windows is awkward; realistically
  needs a Windows build host.
- Higher setup cost, better end result.

### Option C — PWA only (status quo)

- Already done, $0, zero new dependencies.

### Code signing — the one genuinely paid item

An unsigned `.exe` triggers Microsoft SmartScreen ("Windows protected your
PC"). Removing that requires an OV or EV code-signing certificate, which is a
**recurring annual cost from a commercial CA**.

Under the standing $0 invariant this means: **ship unsigned and document the
SmartScreen warning honestly**, or treat signing as an explicit, separately
approved purchase. Signing is *not* required to produce a working `.exe`.

---

## 3. Android APK — options

### Option A — Local Gradle build (recommended for $0)

```
expo prebuild --platform android      # generates the native project
cd android && ./gradlew assembleRelease
```

- Toolchain: JDK + Android SDK + Gradle — all free, no account, no service.
- **Genuinely $0 in perpetuity**, which is the only option that fully satisfies
  the invariant without conditions.
- Requires a machine with the SDK (not this sandbox).
- Release signing needs a keystore. A **self-generated keystore is free**;
  it is only Play Store *distribution* that costs money (see below).

### Option B — EAS Build (Expo Application Services)

First-party pricing (expo.dev/pricing, verified):

| Plan | Cost | Builds |
| --- | --- | --- |
| Free | **$0/month** | **Up to 15 Android and 15 iOS builds**, low-priority queue, 45-min timeout |
| Starter | $19/month + usage | $45 build credit |
| Production | $199/month + usage | $225 build credit |

**Assessment against the invariant:** the free tier is real and genuinely $0,
but it is a *capped* tier. The standing rule prohibits "free tiers that become
paid at real Signalwatch workload". Fifteen builds is workable for occasional
manual releases; it is **not** workable for automated CI on every push, which
would exhaust the cap and force the $19/month plan.

→ EAS is therefore **CONDITIONAL**: acceptable as an occasional manual release
mechanism, **not** acceptable as the default automated build path. It also
requires an Expo account, which is outside the current narrow account
exception (that covers *free government data sources*, not build services).

### Distribution costs, for completeness

- Google Play Console: **US$25 one-time** registration. Not recurring, but a
  real purchase, and not required for direct APK distribution.
- Direct APK sideloading: $0.

---

## 4. Blocking gaps in the current mobile app

Independent of toolchain, these must be resolved before an APK is meaningful:

1. **No `android.package`** in `app.json` (e.g. `au.com.signalwatch.mobile`).
   Required; also effectively permanent once published.
2. **No `versionCode`** / version strategy.
3. **No keystore strategy.** A release APK needs signing config; the keystore
   must never be committed.
4. **CONFIRMED PARITY GAP — the Expo app predates the Global Layer Engine.**
   Measured by API consumption:

   | App | Monitoring hooks used |
   | --- | --- |
   | `artifacts/signalwatch` (web) | briefing, **cameras, maritime, hazards, public-events** |
   | `artifacts/signalwatch-mobile` (Expo) | **briefing only** (6 call sites) |

   The Expo app has three tabs (index, map, sources) and **zero** references to
   cameras, maritime, hazards, public events or the layer registry. Packaging
   it today would ship an "Signalwatch" APK containing none of the layer work —
   no cameras, no vessels, no hazards, no civic incidents. That would
   misrepresent the product to anyone who installed it.
5. **`app.json` splash/adaptive-icon background is `#F5F3EF`** (near-white)
   while the product is a dark interface with a `#070a10` theme colour — a
   visible inconsistency with the PWA.

Point 4 is the one I would resolve first: packaging an app is pointless until
we know the app is the current product.

---

## 5. Recommendation

1. **Audit the Expo app for layer-engine parity before packaging anything.**
2. **Android:** prepare the local Gradle path (`android.package`, versioning,
   keystore documentation, `expo prebuild` validation, a `verify-apk` harness
   mirroring `verify-pwa.mjs`). Treat EAS free tier as an optional manual
   convenience, never the default.
3. **Windows:** decide between Electron (fast, large) and Tauri (small, more
   setup) — or confirm the existing PWA already satisfies the need. Ship
   unsigned unless signing is explicitly approved as a purchase.
4. Arena produces config + scripts + verification; binaries are produced and
   validated where a toolchain exists, and reported as artifact-verified only
   once actually built.

---

## 6. Unresolved — needs a decision

- Windows target: Electron, Tauri, or PWA-only?
- Is an unsigned `.exe` acceptable (SmartScreen warning), or is signing in
  scope as an approved cost?
- Android: local Gradle only, or is an Expo account authorised for occasional
  EAS free-tier builds?
- Is Play Store distribution in scope (US$25 one-time), or direct APK only?
- Does the Expo app need to reach layer-engine parity with the web app before
  packaging, or is packaging the current mobile app as-is acceptable?
