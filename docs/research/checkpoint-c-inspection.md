# Checkpoint C — architecture inspection

**Inspected at:** `342cf25`
**Status:** inspection only. No code changed, no provider implemented.
**Answers:** the twelve questions in the Checkpoint C brief, §20.

This exists because the brief says *"Do not replace the current globe renderer
wholesale unless inspection proves the existing renderer cannot support the
required physical model."* That question cannot be answered from memory, so
every claim below was read out of the tree at `342cf25` or fetched from a
provider's own documentation this session.

Two findings change the plan materially, and both are in §1 and §11.

---

## 0. Executive summary

| # | Question | Answer |
| --- | --- | --- |
| 1 | Globe architecture | **Two** globes. The inner one is already three.js/WebGL and **can** carry the physical model. Do not replace it. |
| 2 | Map architecture | Imperative Leaflet, defaults already centralised in `map-scale.ts`. Australia-first is a constant change plus a profile. |
| 3 | Spatial-layer architecture | Sound and reusable. `RenderableImagery` is renderer-agnostic apart from its rectangular viewport. |
| 4 | Weather path | API registry is **already multi-provider** (`loaders[]`). Adding a second product is additive. |
| 5 | Default orientation | Map `[18, 0]` z2; globe `{lat: 18, lng: 12, altitude: 2.2}`. Both Atlantic-centred, both single constants. |
| 6 | Time utilities | None shared. `date-fns` is declared but unused in the frontend. Solar is greenfield. |
| 7 | Solar insertion point | New pure `lib/solar-geometry.ts`; rendered via react-globe.gl's `lights()`. |
| 8 | Regional priority insertion | New `lib/regional-priority.ts` consumed by `map-scale` defaults and the globe's initial view. |
| 9 | Shareable 2D↔3D | Product, coverage, the five availability states, messages, attribution, freshness, provider identity. |
| 10 | Must stay separate | Viewport geometry, tile-pyramid vs texture, scale bands vs altitude, solar vs provider time. |
| 11 | Australian weather | **BOM radar is EXCLUDED.** Its own copyright notice names radar images as licence-restricted and the real-time service is paid. |
| 12 | Order | C1 → C2 → C3 are safe now. C4/C5 need a provider that does not yet exist. |

---

## 1. Current globe architecture

**There are two globes, not one.** The brief assumes an SVG globe; that is only
half right.

```
pages/sectors.tsx
  └── components/interactive-sector-globe.tsx      1208 lines, SVG chrome + mode switch
        ├── mode "globe"  → lazy → satellite-sector-globe.tsx   543 lines, react-globe.gl (three.js)
        ├── mode "map"    → SignalMap (Leaflet)
        └── mode "network" | "spectrum" → SVG illustrations
```

`interactive-sector-globe.tsx` is a container. Its SVG elements are the panel
chrome and the illustrative sector diagram. The actual globe in `mode: "globe"`
is **`satellite-sector-globe.tsx`, which is real WebGL** via `react-globe.gl`
2.38 → `three-globe` 2.45.2 → `three` 0.186.1.

### Does the existing renderer support the required physical model?

**Yes. It must not be replaced.** Verified against the installed packages:

| Requirement (§7–§12) | Existing capability |
| --- | --- |
| Separate EARTH system | `globeImageUrl`, `showGraticules`, `showAtmosphere`, `atmosphereColor`, `atmosphereAltitude`, country polygons |
| Separate SOLAR system | `react-globe.gl` exposes **`lights()`**, plus `scene()`, `camera()`, `renderer()`, `controls()` |
| Separate WEATHER system | `three-globe` exposes **`customLayerData` / `customThreeObject` / `customThreeObjectUpdate`**, and `tilesData` |
| Reprojection onto a sphere | a custom `THREE.Mesh` with sphere-UV geometry; not a flat image pretending to be a texture |

`lights()` is the important one. The globe currently sets **no lights at all**,
so it is lit by the library defaults (ambient + directional). The material is
already a `MeshPhongMaterial`, which responds to light. Placing a
`DirectionalLight` at the subsolar vector therefore produces a **real**
terminator from the lighting equation rather than a drawn arc — the day/night
boundary becomes a physical consequence, which is exactly what §18 demands.

This also means the three visual systems stay genuinely independent: solar is
lighting, weather is a custom layer, Earth is the base material. Nothing needs
to be baked into one texture.

### Things that will bite

- **The Earth textures are fetched from a third-party CDN at runtime:**
  `cdn.jsdelivr.net/npm/three-globe/example/img/earth-{topology.png,blue-marble.jpg}`.
  That is an undeclared external runtime dependency, a CSP surface, and an
  offline-desktop failure mode. It is not a Checkpoint C blocker but it is a
  latent defect worth recording.
- **There is a non-WebGL fallback.** `webglAvailable` plus a
  `WebGLErrorBoundary` degrade to a static `<img>` of Earth. That fallback has
  no lighting, so it cannot show a terminator. The honest options are to label
  it as a non-physical fallback or to omit the solar readout there — not to
  draw a fake terminator on it.
- **The globe receives no imagery today.** `SatelliteSectorGlobe` is passed
  only `observations`. The `imagery` prop on the container goes to the
  **Leaflet** branch. Radar has never reached the globe.

---

## 2. Current map architecture

`components/map-panel.tsx` (~565 lines) owns an imperative Leaflet map: six
effects plus a `rasterSignature` memo and a band `useState`. Per the standing
constraint, **`SignalMap` is not to be rewritten.**

Relevant to Australia-first, all the defaults are already centralised:

```ts
// lib/map-scale.ts
MAP_DEFAULT_CENTER = [18, 0]            // Atlantic, off west Africa
MAP_DEFAULT_ZOOM   = 2                  // == MAP_SCALE_BAND_ZOOM.global.minZoom
MAP_MIN_ZOOM = 2   MAP_MAX_ZOOM = 18   MAP_FOCUS_ZOOM = 8
```

Only `map-panel.tsx` consumes them (lines 99, 140–141, 358, 370). So the
initial camera is **one value in one module**, which is the clean insertion
point the brief asks for. Panning and zooming are untouched by changing it, so
"the global map remains the same map" holds by construction.

Scale bands, unchanged from Checkpoint A:

| Band | Zoom | Question |
| --- | --- | --- |
| global | 2–3 | What is happening? |
| regional | 4–7 | Where? |
| city | 8–11 | Which part of town? |
| street | 12–15 | Which road? |
| streetContext | 16–18 | What does it look like from here? |

An Australia-wide extent (roughly 113°E–154°E, 44°S–10°S) sits at **zoom 4**,
the bottom of `regional` — a continent-scale view, not a city view, which is
what §2 asks for.

---

## 3. Current spatial-layer architecture

`lib/spatial-layers.ts` (~490 lines, pure). The pipeline:

```
SpatialProduct (API)
  → resolveAvailability(product, viewport, now, {band, scale})
      unavailable → unconfigured → no-imagery → outside-coverage
                  → beyond-resolution → stale → covered
  → toRenderableImagery(...) → RenderableImagery | null
  → imageryRenderSignature(surfaces) → stable string identity
```

`RenderableImagery` carries `render`, `availability`, `freshness`, `message`,
`service`, `areas`, `attribution`, `opacity`, `time`. Coverage is a **list of
disjoint boxes** (`areas: SpatialBounds[]`), never an envelope — an empty list
means global.

### The registry invariant that blocks globe weather

`lib/layer-registry.ts` validates, and **throws**:

```ts
if (definition.capabilities.globe) {
  throw new Error(
    `Layer "${id}" is ${definition.kind} and must not declare the globe
     capability: the globe renders point markers only.`,
  );
}
```

This was correct for Checkpoint A: it is what stops radar becoming markers.
But §8 now wants weather on the globe by a *different* path. **The throw must
stay.** The resolution is to split the capability rather than relax it:

- `capabilities.globe` — keeps its current meaning, *point markers*, and keeps
  throwing for imagery and field layers;
- a new capability, e.g. `globeSurface` — *reprojected spatial surface*,
  permitted only for `kind: "imagery" | "field"`, and forbidden for
  observation layers.

Each capability then has exactly one renderer and the "radar must never become
marker data" guarantee is preserved by the same mechanism that enforces it
today, inverted for the new case.

---

## 4. Current Weather path

```
NOAA WMS GetCapabilities
  └── api-server/src/weather-sources/nws-radar.ts      buildRadarProduct()
        └── weather-sources/registry.ts                loaders[] + single-flight cache
              └── routes/weather.ts                    GET /api/monitoring/weather
                    └── hooks/use-weather-surfaces.ts
                          └── hooks/layer-sources/weather-layer-source.ts   WEATHER_SCALE
                                └── use-global-layer-data.ts    weatherSurfaces / weatherImagery
                                      ├── layer-panels/weather-layer-panel.tsx
                                      └── map-panel.tsx   L.tileLayer.wms, browser → NOAA direct
```

**The server registry is already multi-provider.** This is the single most
useful finding for §3:

```ts
type ProductLoader = (now: Date) => Promise<SpatialProduct>;
const loaders: ProductLoader[] = [ /* one entry today */ ];
// Promise.allSettled -> one failing provider never empties the layer
```

`deriveWeatherCoverage` already unions provider coverage correctly: it never
upgrades scope, and it concatenates `areas` rather than merging them into a
bounding box, with the comment noting that merging disjoint regions is "exactly
the over-claim this model exists to avoid".

So the §3 structure — Weather containing several regional products — **is the
existing design**. An Australian product would be one more `loader`. No
restructuring is required.

Provider identification (§3, last line) is also already satisfied:
`SpatialProduct` carries `providerId`, `providerName`, `productName`,
`attribution`, `licence`, `sourceUrl`, and the panel renders
`data-testid="weather-product-provider-${product.id}"` per product.

Checkpoint B's work means the UX states in §4 already exist and are tested:
Available / Active / reachable / unavailable / "No radar source here" /
"Not drawn at this zoom", with the "never imply clear weather" rule pinned.

---

## 5. Current default map / globe orientation

| Surface | Constant | Value | Shows |
| --- | --- | --- | --- |
| 2D map | `MAP_DEFAULT_CENTER` / `MAP_DEFAULT_ZOOM` | `[18, 0]`, z2 | Atlantic, Africa/Europe |
| Globe | `initialView` (module-local, `satellite-sector-globe.tsx:103`) | `{lat: 18, lng: 12, altitude: 2.2}` | Africa/Europe |

Both are single literals. Note the globe's is **module-private** and also used
by the "reset view" control, so a regional profile must feed it rather than
replace it — §13 requires Australia to be the *initial* orientation, not a
permanent lock.

Also at `satellite-sector-globe.tsx:69–77` there is a hard-coded list of nine
illustrative `SectorLocation`s (Brisbane, New York, London, Seoul…). These are
decorative, not data. §18 permits them only while they remain explicitly
labelled illustrative — the container already labels them "Illustrative
sector", which should be preserved and not quietly reused for the regional
profile.

---

## 6. Existing time/date utilities

There is **no shared clock abstraction**. The pattern is an injected `now`
parameter, which is good for testability:

- `lib/spatial-layers.ts` — `now: Date` threaded through availability and
  freshness;
- `lib/global-layers.ts` — `now: number = Date.now()` defaults;
- `lib/monitoring.ts` — `Date.now()` for relative labels.

`date-fns@3.6.0` is declared in `package.json` but **not imported anywhere in
the frontend source**. No timezone library is present. Nothing in the tree
computes anything astronomical — `subsolar`, `terminator`, `declination`,
`sunPosition` return **zero** matches across `artifacts/` and `docs/`.

Solar geometry is therefore greenfield, with an established convention
(`now` injected, never read ambiently) to follow.

---

## 7. Best insertion point for solar geometry

**New pure module `artifacts/signalwatch/src/lib/solar-geometry.ts`**, peer to
`map-scale.ts`, with no React import and no `Date.now()` inside it.

This matches §9 ("Do not bury astronomical math inside React rendering code")
and the existing frontend test constraint: the test runner has **no DOM**, so
anything that must be unit-tested has to be pure. `map-scale.ts` is the
precedent — 27 tests, no rendering.

Proposed contract, as the brief sketches it:

```ts
export type SolarPosition = {
  subsolarLatitude: number;   // degrees, + north
  subsolarLongitude: number;  // degrees, + east, normalised to (-180, 180]
  declination: number;        // degrees
  hourAngle: number;          // degrees at Greenwich
};
export function calculateSolarPosition(timestampUtc: Date): SolarPosition;
```

Boundaries that keep it honest:

- input is an absolute instant; the function must not consult the host
  timezone. `Date` is already a UTC instant internally, so the rule is simply
  *never call `getHours()`/`getMonth()`* — use `getUTC*` or the epoch value.
  This is the trap §9 names.
- the temporal source stays outside the module. A `GlobeTimeState`
  (`{mode: "live" | "paused" | "simulated", instant: Date}`) lets §11's
  scrubber arrive later without touching the renderer or the math.
- **solar time and provider frame time must not share a field.** Radar time is
  provider data; solar time is derived from the selected temporal state. They
  coincide in LIVE mode and diverge the moment simulation exists.

Rendering side (§10): convert the subsolar point to a unit vector and position
a `THREE.DirectionalLight` at it through `globeRef.current.lights([...])`. The
terminator then falls out of the lighting rather than being drawn, and the
subsolar point is by definition where the light is normal to the surface.

The coordinate-inversion hazard in §10 is real and testable without a browser:
three-globe's own lat/lng→vector convention is already exercised by the
existing `pointsData` markers, so the solar vector must be built with the
**same** helper the markers use, and a test should assert that a light placed
at a known observation's coordinates lands on that observation.

---

## 8. Best insertion point for regional priority

**New `artifacts/signalwatch/src/lib/regional-priority.ts`**, pure, peer to
`map-scale.ts`.

```ts
export type RegionalPriorityProfile = {
  id: "australia" | "north-america" | "europe" | "asia";
  label: string;
  mapCenter: readonly [number, number];
  mapZoom: number;              // validated against MAP_SCALE_BAND_ZOOM
  globeView: { lat: number; lng: number; altitude: number };
  extent: SpatialBounds;        // the region itself, for tests and coverage copy
  preferredLayers: readonly LayerId[];
  layerOrder: readonly LayerId[];
  preferredProviders: readonly string[];
};
```

Consumers, deliberately few:

1. `map-scale.ts` — `MAP_DEFAULT_CENTER`/`MAP_DEFAULT_ZOOM` derive from the
   active profile instead of being literals. `map-panel.tsx` then needs no
   change at all.
2. `satellite-sector-globe.tsx` — `initialView` derives from
   `profile.globeView`.
3. `global-layer-control.tsx` — ordering only.

What it must **not** do, per §1 ("Do not hard-code Australian assumptions into
generic renderers"): no renderer may branch on `profile.id`. The profile is
data read once for initial state; it is not a mode. A test should assert that
switching the active profile changes the initial camera and nothing else, and
that every band/zoom in a profile is valid.

Open question for the user, not for me to assume: whether the active profile is
a build-time product configuration value, a user setting, or both. §2 says
"explicit product configuration value" and "do not tie this to the user's
personal location", which I read as build-time default with room for a later
user override.

---

## 9. What 2D Weather and 3D Weather can share

Everything upstream of geometry. The expensive, correctness-critical parts are
already renderer-neutral:

| Shared | Why it transfers |
| --- | --- |
| `SpatialProduct` and the whole API path | no rendering assumption |
| `coverage.areas` (disjoint boxes) | a box clips a sphere as well as a plane |
| the five `SpatialAvailability` states | semantic, not geometric |
| `describeAvailability` / `message` | the "no source here ≠ clear" rule must be identical on both surfaces |
| `evaluateFreshness`, `staleAfterMs` | time, not space |
| attribution, licence, `providerName` | provenance |
| the Available/Active/reachable model | Checkpoint B's panel work |
| `imageryRenderSignature` *as a pattern* | the globe needs its own anti-churn identity for the same reason |

A shared `resolveSurfaceAvailability(product, visibleRegion, now, …)` is
plausible if `visibleRegion` is abstracted from "rectangle" to "does this area
intersect what the user can see". `isOutsideCoverage` already takes
`areas × viewport`, so the generalisation is small.

## 10. What must stay separate

| Separate | Why |
| --- | --- |
| Viewport geometry | Leaflet has a rectangular extent; a globe shows a spherical cap, with the back half hidden. A lat/lon rectangle is the wrong shape for "visible". |
| Scale band vs camera altitude | Bands are defined from Leaflet zoom and tile resolution. Globe altitude is a different quantity; reusing `MapScaleBand` there would be a magic-number import in new clothes. |
| Tile pyramid vs reprojected texture | 2D uses `L.tileLayer.wms` and Leaflet's own URL building. 3D needs one or more reprojected rasters as textures. Different request shapes, different cadence accounting. |
| Solar vs provider time | §11. One is calculated, one is observed. |
| Solar vs weather provider | §16, explicitly. Solar geometry must not live in a weather module; it is planetary, not meteorological, and it is available with no provider at all. |
| Globe surface vs map surface renderer | §16 "Do not make the globe a second copy of the 2D map." |
| `capabilities.globe` vs `globeSurface` | §3 above — markers and surfaces are different renderers and must stay separately validated. |

---

## 11. Australian provider research

### 11.1 BOM radar — **EXCLUDE** (researched this session, authoritative sources)

Fetched `https://www.bom.gov.au/copyright` and
`https://www.bom.gov.au/catalogue/data-feeds.shtml`.

The Bureau's own copyright notice disposes of the obvious plan:

> **Restricted content** — "Some of our content – such as **radar images**,
> high-resolution maps, and other specialised data – **may be subject to a data
> licence agreement**. … You need a data licence agreement to: **access the
> material**; reproduce or publish it in any form – for example, online,
> broadcast, print."

> **Default terms** — "Unless we state otherwise, you can download, copy and
> use our content for personal use, or use within your organisation. **You must
> not supply it to any other person** or use it for any commercial purpose."

> **Unauthorised use** — "we do not allow you to use automated or manual
> techniques to **hack, scrape or otherwise extract material from our site**."
> If they suspect unauthorised use they may end access "including by blocking
> an IP address", without notice.

> **Marks** — "You must not use our name, abbreviation, marks, symbols, logo
> … unless we expressly allow you to."

Three independent disqualifications, any one of which is sufficient:

1. **Radar images are explicitly named as licence-restricted.** This is not an
   ambiguity to be interpreted favourably; the Bureau names the exact product
   class Signalwatch wanted.
2. **The real-time radar service is paid.** `bom.gov.au/resources/data-services`
   puts radar behind Registered User Services — "This **paid** service gives
   you access to … radar data". That fails the $0 recurring-cost baseline as a
   *baseline* capability.
3. **`api.weather.bom.gov.au` explicitly refuses.** It returns the header
   *"This API is owned by the Bureau of Meteorology. You must not use, copy or
   share this API without express permission from the Bureau."* Under standing
   invariant 6, an honestly identified client being refused is a **rejection
   signal, not an obstacle to route around**.

The free anonymous FTP service exists and carries radar directories, but it
inherits the default terms above, and "you must not supply it to any other
person" is squarely in tension with shipping an application that displays it.
Whether a personal desktop build fetching for its own operator is "personal
use" is a question for the Bureau, not for me to decide favourably by default.

**Classification:** BOM is **EXCLUDED as an imagery/observation provider**. It
remains viable as a **Reference Provider** — linking out to the Bureau's own
radar page is ordinary web use — subject to the trademark restriction, meaning
a plain text link, not Bureau branding.

**Consequence for the brief:** §3's "Australian weather provider" cannot be
BOM radar on current terms. §5 (traffic) is a better first Australian
capability, and it is in much better shape.

### 11.2 Australian traffic — genuinely promising

Both found this session, both with published licences:

**QLDTraffic** — `https://api.qldtraffic.qld.gov.au/v1/`, `/v2/events`.
Licensed **CC BY 4.0 (AU)** in its own published API specification. Notably it
publishes a **public API access key** for developers who do not want to
register, globally rate-limited to **100 requests/minute**, with registration
"preferable" for outage notification. Carries road events with
source-faithful `event_type` values (`Hazard`, `Crash`, …), a `source` object
naming the originating system, plus traffic web cameras and flood cameras.
This is the strongest $0 Australian candidate found. The shared public key
being *globally* limited is a real architectural consideration — a shipped app
on a shared key is a poor citizen, which argues for operator-supplied keys.

**Transport for NSW Open Data Hub** — Live Traffic Hazards (incidents, fires,
floods, alpine conditions, major events, roadworks) and Live Traffic Cameras,
both GeoJSON, both **CC BY 4.0**. Requires free registration for a key. The
portal terms state "Your rights are not transferable", which points to a
**user-supplied credential architecture** (permitted to evaluate under standing
invariant 8) rather than a shipped shared key.

Neither is admitted yet. Both need the full admission procedure — ingestion,
redistribution, caching, attribution, rate limits, credential scope,
geographic coverage — recorded before any code.

### 11.3 Australian-region satellite — a lead, not a plan

Himawari-9 (geostationary at 140°E, covers Australia) is on the AWS Registry of
Open Data: *"Himawari data is produced and managed by JMA. **NOAA has rights to
distribute this data freely and openly to the public.** … NOAA and JMA request
attribution."* That is a clean licence, and it routes around BOM entirely.

The catch is that this is L1b full-disk netCDF, not rendered map tiles.
Turning it into a globe or map surface means a real processing pipeline. Record
it as a research lead for the weather roadmap's Satellite entry; it is not a
Checkpoint C implementation.

### 11.4 Research still required before any Australian weather implementation

1. Whether any Australian radar or precipitation product exists under CC BY —
   check `data.gov.au`, Geoscience Australia, and the Digital Atlas of
   Australia, none of which were examined this session.
2. Whether the Bureau grants a no-cost data licence agreement for
   non-commercial personal use — an operator inquiry, which per standing
   instruction is **not to be sent without the user's explicit decision and
   real contact details**.
3. Himawari-9 transport, decoding, resolution, run metadata, units and
   missing-value behaviour, to the same standard the brief sets for GFS.

---

## 12. Minimal implementation order

Revised from the brief's C1–C8 in one respect: **C4/C5 cannot proceed as
written**, because the assumed provider is excluded.

| Step | Scope | Blocked? |
| --- | --- | --- |
| **C1** | `regional-priority.ts` + Australia profile; map and globe initial views derive from it; tests for centre, zoom, ordering, and that global navigation still works | ready |
| **C2** | `solar-geometry.ts` pure module + tests (equinox/solstice, known UTC instants, longitude progression, hemisphere orientation); `lights()` wiring; terminator; subsolar marker; `GlobeTimeState` shaped for later simulation | ready |
| **C3** | Split `capabilities.globe` from `globeSurface`; provider-neutral globe surface descriptor; reprojection path; coverage clipping on the sphere; "no weather source here" on the globe | ready — needs no new provider, NOAA radar is a sufficient first subject |
| **C4′** | Admission research for **QLDTraffic** and **TfNSW** (replaces the assumed Australian weather research) | ready |
| **C5′** | First Australian traffic/incident capability under Navigation, source-faithful classification per §6 | after C4′ |
| **C6′** | Australian weather re-examined: `data.gov.au` / Geoscience Australia sweep, and a decision on whether to ask the Bureau | needs a user decision on contact |
| **C7** | Street-context framework | unchanged |

C1 and C2 are independent of each other and of every provider question, which
makes them the right next commits. C3 depends on C2 only for ordering in the
compositing stack (§12: Earth → weather → night mask → atmosphere →
observations).

---

## 13. Guarantees from `342cf25` that must survive

Re-verified green at `342cf25` during this inspection, after repairing a
sandbox reset:

root typecheck · API tests 118/118 · frontend tests 149/149 · API build ·
frontend build · `verify:desktop` · `verify:pwa` · `verify:radar` (contract
held).

Invariants not to break:

- radar never becomes marker data, and the registry still throws if asked;
- NOAA coverage stays five disjoint areas, never a world envelope, and never
  implies Australian coverage;
- imagery stays browser → provider direct; no tile proxying through the API;
  the service worker does not cache provider imagery;
- observations / imagery / field stay separate pipelines, now joined by solar
  and navigation as further distinct kinds;
- "no source here" never reads as "clear";
- `SignalMap` is not rewritten;
- no provider-specific branches in shared rendering code.
