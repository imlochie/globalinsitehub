# NOAA/NWS radar — operational verification record

**Provider status:** ADMITTED · IMPLEMENTED · **AWAITING OPERATOR SIGN-OFF**
**Admission record:** `nws-radar-wms-admission.md`
**Architecture:** `../weather-layer-architecture.md`, `../map-scale-architecture.md`
**Checkpoint:** B

This file is the single place where NOAA radar is promoted from *admitted and
implemented* to *operationally verified*. It is not promoted until the
operator table in §4 is filled in from a real Windows run.

Nothing in this document may be filled in by an agent. The sandbox has no
provider egress and no browser, so every claim below that requires either
would be fabricated.

---

## 1. What the automated gate proves

Run in the Linux workspace at the Checkpoint B commit.

| Gate | Result |
| --- | --- |
| root typecheck | PASS |
| API tests | PASS — 118/118 |
| frontend tests | PASS — 149/149 |
| API build | PASS |
| frontend build | PASS |
| `verify:desktop` | PASS |
| `verify:pwa` | PASS |
| `verify:radar` | PASS (contract held; NOAA unreachable from the sandbox, reported as notes) |

`verify:radar` from the sandbox confirms the six checks that do not need
provider egress:

- the verifier identifies with the server's exact User-Agent;
- five named coverage areas are published;
- the refresh cadence is 600 000 ms;
- `validTime` and `runTime` are null — radar is not presented as a forecast;
- the metadata cache holds across consecutive requests;
- the desktop CSP permits direct provider imagery.

The remaining checks reported `fetch failed`, which is the sandbox's missing
egress and **not** a provider outage. They must be re-run on the networked
Windows host.

## 2. What the automated gate cannot prove

No amount of Node-side testing establishes any of these. They are the entire
reason this document exists.

1. **Geographic placement.** A 200 response carrying a valid PNG of the
   requested dimensions says nothing about whether the precipitation is over
   Kansas or over the Gulf. Confirming it needs a reference raster or a human
   eye.
2. **Europe behaviour as a human sees it.** The code path is unit-tested; the
   rendered result is not.
3. **WebView2 rendering.** The CSP is asserted statically. Whether WebView2
   actually paints the tiles is a runtime fact about a browser engine that
   does not exist in this workspace.
4. **Request origin.** That tiles go browser → NOAA and never through `/api`
   is enforced by construction and asserted in the product contract, but only
   DevTools can show it happening.
5. **Anti-churn.** `imageryRenderSignature` is unit-tested to be stable
   across viewports, but whether Leaflet consequently stops re-requesting
   tiles during real panning is observable only in a network panel.

---

## 3. Operator procedure (Windows)

### 3.0 Build a fresh executable

The installed shortcut may point at an older build. Do not trust it.

```cmd
cd C:\Users\lochi\Downloads\signalwatch
git pull
pnpm --filter @workspace/signalwatch-desktop build
```

`beforeBuildCommand` chains `build-frontend.mjs` (which defaults `PORT` and
`BASE_PATH` itself — no `set` needed) and then `prepare-sidecar.mjs`, which
wipes and repopulates `src-tauri/resources/`. That directory is gitignored,
so it never arrives from a pull and only exists if the sidecar step has run
on that machine.

Launch the freshly built binary **directly**, not the shortcut:

```cmd
artifacts\signalwatch-desktop\src-tauri\target\release\signalwatch-desktop.exe
```

If it exits silently, capture stderr — redirection works even though the
release build has no console:

```cmd
...\signalwatch-desktop.exe 2> "%USERPROFILE%\Desktop\sw-stderr.txt"
```

### 3.1 Re-run the live verifier with real egress

```cmd
pnpm --filter @workspace/api-server run verify:radar
```

Expect the three `fetch failed` notes to become `ok` lines. A provider
outage is a note, not a failure; a wrong answer is a failure.

### 3.2 Acceptance checks

| # | Check | Procedure | Expected |
| --- | --- | --- | --- |
| A | Weather activation | Open the map, find Weather in the layer control | Reads **Available** + **Inactive** while off. Never "Planned". |
| A2 | Activation | Toggle Weather on | Reads **Available** + **Active**; radar appears over an admitted region |
| B | Geographic placement | View the continental United States | Radar features align with the basemap. "A PNG loaded" is **not** acceptable evidence |
| C | Coverage honesty | Pan to Europe | No imagery. Panel headline reads **No radar source in this view**; body reads **No radar source here**. Never "clear", "no rain", "no precipitation" |
| D | Scale honesty | Zoom past level 16 over the United States | Radar stops drawing. Headline reads **Not drawn at this zoom**, with the 565 m explanation |
| E | Direct provider traffic | DevTools → Network, filter `GetMap` | Requests go to `https://mapservices.weather.noaa.gov/...`. Never `/api/`, never a localhost relay |
| F | Request discipline | Pan around the United States, then to Europe | GetMap requests only within the five declared regions. Europe produces **zero** NOAA requests |
| G | Anti-churn | At a fixed zoom inside coverage: pan, stop, pan, stop | No burst of duplicate GetMap requests for already-visited tiles on each stop. This is what `imageryRenderSignature` exists to prevent |
| H | WebView2 | Observe the packaged app, not a dev browser | Radar imagery renders inside WebView2 |

Note for check G: Leaflet legitimately requests tiles for newly exposed
area, and the browser image cache may be bypassed on a hard reload. What
would indicate failure is the **same** tile URLs being re-requested after
every pan stop, which is the signature of layer teardown and recreation.

---

## 4. Operator result — TO BE COMPLETED ON WINDOWS

Leave as `PENDING` until run. Record `BLOCKED: <reason>` rather than
converting an unverified check into a pass.

```
Verification date (local)   : PENDING
Operator                    : PENDING
Windows build commit        : PENDING
Executable path             : PENDING
WebView2 runtime version    : PENDING

verify:radar result         : PENDING
NOAA GetCapabilities        : PENDING
NOAA frame time reported    : PENDING   (provider time, not local time)
Local verification time     : PENDING

A   weather activation      : PENDING
B   geographic placement    : PENDING
C   coverage honesty        : PENDING
D   scale honesty           : PENDING
E   direct provider traffic : PENDING
F   request discipline      : PENDING
G   anti-churn              : PENDING
H   WebView2 rendering      : PENDING
```

**Provider timestamps and local verification timestamps are different
things and must stay in different fields.** The NOAA frame time describes
when the atmosphere was observed; the verification date describes when a
human looked at the screen.

---

## 5. On promotion

When every row in §4 reads PASS, change the header of this file and of
`nws-radar-wms-admission.md` to **OPERATIONALLY VERIFIED**, and record the
run above.

Coverage does **not** change on promotion. It remains five disjoint areas:

- Continental United States
- Alaska
- Hawaii
- Caribbean (Puerto Rico and the U.S. Virgin Islands)
- Guam

There is no claim of global radar, and verification of these five regions is
not evidence about anywhere else.

## 6. If a check fails

Classify before patching. The architectural layer responsible is usually
identifiable from the symptom:

| Symptom | Likely layer |
| --- | --- |
| Radar in the wrong place | provider adapter — CRS or bbox axis order |
| Nothing draws anywhere, provider reachable | registry / layer source / `render` resolution |
| Draws over Europe | coverage model — areas merged into an envelope |
| Draws at zoom 18 | scale policy not reaching `toRenderableImagery` |
| Tiles blocked only in the packaged app | CSP (`img-src`), WebView2 |
| Tiles served from cache past the cadence | service worker runtime route |
| Duplicate requests on every pan | render signature — viewport leaked into tile identity |
| Old UI after a rebuild | stale bundle or WebView2 data directory |
| Correct data, wrong words | UI semantics only — do not touch the provider contract |

The right fix is the smallest structural one that preserves the contract in
§3 of the admission record. Do not change provider semantics to make the UI
easier.
