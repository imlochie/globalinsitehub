# Weather layer architecture — the spatial layer kind

Status: **ACCEPTED — implemented in Weather Batch 1**
Date: 2026-10-01
Scope: the abstraction that lets Signalwatch represent continuous spatial
surfaces alongside point observations.
Preconditions: `docs/research/weather-source-admission.md` (radar = ADOPT) and
`docs/research/providers/nws-radar-wms-admission.md` (conditions closed).

This document is the architectural half of Weather Batch 1. It records what
Signalwatch assumed before the batch, why weather cannot be expressed with
those assumptions, what the new model is, and what was deliberately **not**
built. It is written so that the next person adding GFS does not have to
re-derive any of it.

---

## 1. Archaeology — what Signalwatch assumed before this batch

Every finding below was read out of the code before anything was designed.

### 1.1 The layer registry had exactly one shape of layer

`artifacts/signalwatch/src/lib/layer-registry.ts` (699 lines) is the single
UI-agnostic source of truth for *what a layer is*. Its `LayerDefinition`
carried:

```
id, label, description, status, category, observationKind,
enabledByDefault, capabilities, display, providers[], sampling?, coverage?
```

Three of those fields silently assume point observations:

| Field | Hidden assumption |
| --- | --- |
| `observationKind: string` | the layer produces records, and they all share one discriminant |
| `display.marker*` (5 of 7 keys) | the layer is drawn as **markers** |
| `sampling: { kind: "provider-balanced", maxMarkers }` | rendering cost scales with **record count** |

There was no `kind` discriminant, because there was nothing to discriminate.
`weather` existed only as a `plannedLayer("weather", "Weather", "environment",
"cloud")` placeholder with `noCapabilities` and `providers: []`.

### 1.2 `BaseObservation` hard-requires a point

From `artifacts/signalwatch/src/lib/global-layers.ts` (784 lines), whose header
comment states that *every* provider record is normalised into observations
sharing a common base:

```ts
type BaseObservation<TLayerId, TKind> = ObservationProvenance & {
  layerId: TLayerId;
  kind: TKind;
  id: string;
  key: `${TLayerId}:${string}`;
  latitude: number;    // required
  longitude: number;   // required
  label: string;
  observedAt: string | null;
  detail: string | null;
};
```

`latitude`, `longitude`, `id` and `label` are **non-optional**. Those four are
exactly the fields a radar frame does not have.

### 1.3 The data pipeline is uniformly observation-shaped

`artifacts/signalwatch/src/hooks/use-global-layer-data.ts` (170 lines) runs a
fixed-order chain:

```
use*LayerSource() x4
  -> combineLayerSources()        // flattens to GlobalObservation[]
  -> selectRenderableObservations()  // applies per-layer sampling caps
  -> findObservation()               // resolves { layerId, id } selection
  -> useEffect clearing stale selection
```

Each stage is typed on `BaseObservation`. `LayerSourceResult<TObservation
extends BaseObservation>` cannot even be instantiated without a point type.

### 1.4 The map is Leaflet, and has not been migrated to the layer engine

`artifacts/signalwatch/src/components/map-panel.tsx` (380 lines) exports
`SignalMap`:

- Leaflet (`L.map`, `preferCanvas: true`, `worldCopyJump: true`), one
  `L.tileLayer` OSM basemap, zoom control bottom-right.
- Props are still **legacy concrete types** — `events: BriefingEvent[]`,
  `cameras?: CameraRecord[]`, `selectedCameraId`, `selectedEventId` — not
  `GlobalObservation[]`.
- Markers are `L.circleMarker` objects rebuilt into an `L.layerGroup` on every
  change; popups are DOM-built; selection uses `flyTo`.

Two consequences were accepted as constraints for this batch: weather must be
added **without** a parallel weather-map component, and **without**
opportunistically rewriting the marker pipeline.

### 1.5 Per-layer modules come in parallel threes

`hooks/layer-sources/*`, `components/layer-panels/*`,
`components/observation-details/*` each hold one module per layer plus a shared
`types.ts`. Panels are assembled by `buildLayerPanels(layerData)` into
`LayerPanelModel[]`, which the layer-agnostic `GlobalLayerControl` renders.

### 1.6 Provider fetching is already centralised and honest

`artifacts/api-server/src/lib/provider-fetch.ts` exposes
`providerFetch(url, { headers, timeoutMs, accept, signal })` with an honest
`SIGNALWATCH_USER_AGENT`, a 12 s timeout, `redirect: "follow"`, and
`describeProviderFailure(status, name)`. It does not retry 401/403/429. That is
precisely the behaviour the NWS *Public Notice of Appropriate Use* demands, so
weather reuses it unchanged.

### 1.7 The API boundary is spec-first

`lib/api-spec/openapi.yaml` -> orval -> `lib/api-zod/src/generated/` and
`lib/api-client-react/src/generated/api.ts`. Codegen runs fully offline and is
idempotent. Adding a weather endpoint therefore means editing the spec and
regenerating, never hand-writing a client.

### 1.8 Tests

`artifacts/api-server/tests/` (97 tests, `tsx --test`) and
`artifacts/signalwatch/tests/` (9 files, 76 tests, `tsx --test` with
`react-dom/server`). **There is no DOM in the frontend test environment** —
components are exercised through `renderToStaticMarkup`. Leaflet cannot be
instantiated there, which decided how imagery gets tested (§9).

---

## 2. Why weather cannot use `BaseObservation`

Not a style objection. Four specific semantic failures:

1. **No point exists.** A radar frame is a raster covering millions of km².
   `latitude`/`longitude` would have to be invented — a bounds centroid is a
   fabricated coordinate that no provider published.
2. **No record identity exists.** `id` and `key: "${layerId}:${id}"` assume a
   provider-issued record id. A WMS `GetMap` response is a rendering of a
   service at a time, not an enumerable record.
3. **One timestamp is not enough.** `observedAt` is a single nullable instant.
   Weather needs *three* independent times — when the source content is valid,
   when Signalwatch retrieved it, and (for models) what run produced it. A
   forecast's valid time is in the **future**; collapsing it into `observedAt`
   would make a forecast look like an observation.
4. **Absence means something different.** For point layers, "no marker here"
   means "no source reported anything here". For a continuous surface, a blank
   pixel inside coverage means *measured, nothing detected*, while a blank pixel
   outside coverage means *no source at all*. `BaseObservation` has no way to
   express the difference, and conflating them would make Signalwatch state
   "no precipitation" over regions NOAA never observed.

Point 4 is the one that matters most. It is a correctness requirement, not an
ergonomics one.

---

## 3. The model

```
Layer (registry, one authoritative registry)
  |
  +-- kind: "observation"   -> BaseObservation[]  -> markers  (unchanged)
  +-- kind: "imagery"       -> SpatialSurface     -> raster    (this batch)
  +-- kind: "field"         -> SpatialSurface     -> contract only, no runtime
```

`kind` is a required, type-safe discriminant on `LayerDefinition`. All three
kinds share the registry, provenance, attribution, coverage, freshness and
provider-health machinery. They differ only in what they carry and how they
render.

### 3.1 Shared spatial model (the minimum, nothing more)

Common to imagery and field, defined once:

| Field | Meaning |
| --- | --- |
| `id` | stable product id, e.g. `nws-radar-base-reflectivity` |
| `layerId` | owning registry layer |
| `kind` | `imagery` / `field` |
| `providerId`, `providerName` | who publishes it |
| `productId`, `productName` | which product of theirs |
| `attribution` | verbatim provider attribution string |
| `sourceUrl` | human destination for the product |
| `licence` | licence short name |
| `coverage` | scope + regions + note + observed areas |
| `coverage.areas` | **list** of named `{ west, south, east, north }` boxes in EPSG:4326 degrees; empty means global (see §5.1) |
| `sourceTimestamp` | when the provider says the content is valid |
| `ingestionTimestamp` | when Signalwatch retrieved it |
| `validTime` | model valid time — `null` for observations |
| `runTime` | model run/reference time — `null` for observations |
| `refreshIntervalMs` | documented provider cadence |
| `staleAfterMs` | age past which the surface is stale |
| `availability` | coverage/health state (§5) |
| `message` | plain-language status sentence |

Three times are kept **separate** on purpose (§2.3). For radar, `validTime` and
`runTime` are `null` and `sourceTimestamp` carries the frame's valid instant —
a deliberate statement that MRMS base reflectivity is an observation, not a
forecast.

### 3.2 Imagery contract

```ts
type SpatialImageryService = {
  protocol: "wms";
  endpoint: string;        // GetMap base URL
  layer: string;           // WMS layer name
  version: string;         // "1.3.0"
  crs: string;             // "EPSG:3857"
  format: string;          // "image/png"
  transparent: boolean;
  timeParameter: string | null;  // "time" when time-enabled, else null
  opacity: number;         // default render opacity
};
```

`protocol` is a discriminated union with exactly one member today. A future
XYZ/WMTS source adds a member rather than overloading `wms`.

**Rendering mechanism.** Leaflet already ships `L.tileLayer.wms`. It is
viewport-driven, requests only the tiles the current view needs, honours a
`bounds` option (so it issues **no request at all** outside coverage), and
accepts an `attribution` string that Leaflet's own attribution control renders.
That satisfies the map-native requirement exactly, with no new dependency, no
React component per raster cell, and no image blob in React state.

**No proxy.** Tiles load **browser -> NOAA directly**, the same decision made
for camera media. Signalwatch does not relay the imagery. The API server is
used only for *metadata* (which frame is current, is the service healthy) —
that is the part Signalwatch genuinely owns, and it is cached server-side so
the provider sees one metadata request per TTL regardless of how many clients
are open.

### 3.3 Field contract (design only — nothing fetched)

```ts
type SpatialFieldDescriptor = {
  variable: string;        // "temperature_2m"
  unit: string;            // "K"
  grid: { width: number; height: number };
  resolutionDegrees: number;
  valueRange: { min: number; max: number } | null;
  missingValue: number | null;   // how the provider encodes "no data"
  modelId: string | null;        // "gfs"
  runId: string | null;          // "2026-10-01T06:00:00Z"
};
```

It is declared, exported and type-checked. **No GRIB2 decoder, no GFS
ingestion, no field provider, no field renderer** exists. The point is that
when GFS arrives it fills in `field` on an existing registry provider and
reuses coverage, freshness, provenance and health unchanged.

---

## 4. Shared vs specialised

| Concern | Shared across all kinds | Specialised per kind |
| --- | --- | --- |
| Registry identity, label, description, category, status | yes | — |
| Provider identity, attribution, licence, catalogue URL | yes | — |
| Coverage scope/regions/note | yes | bounds only for spatial kinds |
| Freshness vocabulary | yes | thresholds differ |
| Provider health reporting | yes | — |
| Capability flags | yes | imagery sets `inspector: false`, `globe: false` |
| Enablement + layer control panel | yes | panel body differs |
| Record identity / `key` | — | observation only |
| Marker colours, sampling caps | — | observation only |
| WMS service descriptor | — | imagery only |
| Grid/variable/unit/run | — | field only |

---

## 5. Coverage semantics

Five states, shared by both spatial kinds:

| State | Meaning | Render |
| --- | --- | --- |
| `covered` | inside declared coverage, provider healthy, surface fresh | draw the surface |
| `outside-coverage` | viewport is wholly outside declared bounds | draw nothing; say "no source here" |
| `stale` | surface older than `staleAfterMs` | draw, but label it stale |
| `unavailable` | provider or metadata request failed | draw nothing; say the provider failed |
| `unconfigured` | layer admitted but no product configured | draw nothing; say so |

The hard rule, from the radar admission record (binding constraint 5): **never
fill uncovered regions and never imply "no precipitation" where there is simply
no source.** This is enforced structurally, not by discipline — the Leaflet
`bounds` option means the browser never even requests a tile outside the
declared area, so there is no code path that can paint one.

A viewport straddling the boundary renders the covered part honestly and leaves
the rest empty, with the coverage note stating where the data stops.

### 5.1 Why coverage is a list of boxes, not one box

This was found during implementation and changed the model, so it is recorded
rather than quietly fixed.

The NWS radar service publishes a single geographic bounding box:

```
west -176.000000   east 150.004790   south 8.995680   north 72.000000
```

That is not an extent. It is the **min/max of five disjoint regions** that
happen to sit on opposite sides of the Pacific — Guam near +145, the Caribbean
near −65. Taken literally the box spans **326° of longitude** and contains
Europe, Africa, the whole of Asia and most of the Atlantic and Indian Oceans.

Had that box been used as the render clip, Leaflet would have requested tiles
over Berlin. The service would have answered — with a transparent PNG, because
it has no data there. On screen, transparent radar over Berlin is
indistinguishable from *radar showing no precipitation over Berlin*. That is
precisely the one claim this layer must never make, and it would have arrived
through an API that looked entirely correct.

So `coverage.areas` is a list. The five boxes are drawn generously around the
regions NOAA itself names, each one strictly inside the published envelope, so
the clip only ever **narrows** the provider's claim. The renderer creates one
Leaflet WMS layer per area; a layer whose bounds miss the viewport issues no
requests, so the cost of five layers instead of one is nil.

`deriveWeatherCoverage` concatenates areas across products and never merges
them into an envelope, for the same reason. A test asserts that merging the
CONUS and Guam boxes would wrongly mark central Europe as covered, so the
shortcut cannot be reintroduced silently.

---

## 6. Freshness semantics

Reuses the existing vocabulary (`available` / `stale` / `unavailable`) rather
than inventing a parallel one, but **not** the point-observation thresholds —
a camera catalogue entry and a radar frame age at completely different rates.

Radar, from the admission record:

- `sourceTimestamp` — frame valid time, read from the WMS time dimension.
- `ingestionTimestamp` — when the API server read capabilities.
- `refreshIntervalMs` = **600 000** (10 min). NOAA's own metadata states both
  "every 5 minutes" and "approximately every ten minutes"; the admission record
  resolved that inconsistency by taking the **slower** figure. The UI does not
  get to poll faster because it would look nicer.
- `staleAfterMs` = **1 800 000** (30 min, three missed cycles).

The NWS *Public Notice of Appropriate Use* explicitly defines abuse as
requesting faster than the data refreshes, and reserves the right to block IPs
or query types. The cadence is therefore a **terms** constraint, not a
performance preference.

---

## 7. API boundary

```
browser  --(tiles, direct)-->  NOAA WMS GetMap
browser  --(metadata)-->  Signalwatch GET /monitoring/weather  --> NOAA WMS GetCapabilities (cached)
```

Signalwatch owns metadata, health and freshness; NOAA serves the pixels. The
split follows the existing camera precedent: Signalwatch publishes the
catalogue and the provider serves the media.

`GET /monitoring/weather` returns products, not records. It has no `limit` and
no `q` parameter, because there is nothing to paginate or text-search — another
sign the observation contract was the wrong shape.

Capabilities are cached for one refresh interval behind the same
single-flight pattern as `hazard-sources/feed-cache.ts`, so N clients cause one
upstream request per TTL.

---

## 8. Provenance boundary

Unchanged in substance: provider id, name, attribution, licence, source URL and
coverage all come from the registry/adapter, never from the renderer. The
renderer receives a descriptor and draws it.

One deliberate deviation from the observation layers: `ObservationProvenance`
types `providerStatus` as a closed union of the four existing concrete
per-layer status types. Rather than widen that union (which would couple
weather to four unrelated layers), the spatial model carries its own
`availability` + `message` pair. The *vocabulary* is shared; the type is not
forced.

NOAA/NWS specifics — endpoint, layer name, CRS, format, time behaviour, bbox,
attribution string — live **only** in
`artifacts/api-server/src/weather-sources/nws-radar.ts`. There is no
`if (provider === "noaa")` anywhere in the renderer, the panel, or the hooks.

---

## 9. Rendering and testing responsibilities

| Layer | Responsibility |
| --- | --- |
| `nws-radar.ts` (API) | provider specifics; capabilities parse; status |
| `wms-capabilities.ts` (API) | narrow, fail-closed reader for the time dimension and layer name |
| `/monitoring/weather` | product list + health, spec-first DTO |
| `lib/spatial-layers.ts` (frontend) | pure model: freshness, availability, bounds maths, **WMS parameter construction** |
| `weather-layer-source.ts` | react-query binding -> `SpatialLayerSourceResult` |
| `map-panel.tsx` | hands a descriptor to `L.tileLayer.wms`; knows no provider |
| `weather-layer-panel.tsx` | product context, provenance, coverage, freshness |

Because the frontend test environment has no DOM, Leaflet itself is not
instantiated in tests. Instead every decision Leaflet acts on is computed by
pure functions in `lib/spatial-layers.ts` and tested directly: CRS selection,
format, transparency, version, the optional time parameter, bounds
construction, bounds intersection, freshness thresholds and availability
states. `buildWmsGetMapUrl` pins the exact query string. **No WMS image is ever
fetched or snapshotted in tests.**

---

## 10. Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Force weather into `BaseObservation` with a bbox centroid | fabricates a coordinate no provider published; destroys the covered/uncovered distinction (§2) |
| A second registry for spatial layers | two sources of truth for label/status/coverage; the brief explicitly forbids it |
| A separate `WeatherMap` component | duplicates viewport, basemap, zoom and attribution handling; guarantees drift from `SignalMap` |
| Proxy tiles through the API server | Signalwatch becomes a CDN for NOAA, adds egress cost and latency, and contradicts the camera-media precedent |
| Fetch GeoTIFF/GRIB and render client-side | needs a decoder and client-side interpolation; both explicitly out of scope and both heavy |
| Add a GIS framework (OpenLayers, deck.gl, MapLibre) | Leaflet already does WMS natively; a second map engine is a rewrite, not a feature |
| Emit one React component per raster cell | thousands of nodes for one frame; the reason the raster path exists at all |
| Clip to the provider's single published bounding box | it is a min/max of disjoint regions spanning 326° of longitude; would request transparent tiles over Europe, which reads as "no precipitation" (§5.1) |
| Merge coverage areas into one envelope when deriving layer coverage | same over-claim, one level up; pinned against by a test |
| Fall back to the map's default CRS when a product advertises an unsupported one | labels the request with one projection while the extent is computed in another, putting a plausible surface in the wrong place. The surface is skipped instead |
| Poll every 5 minutes (NOAA's faster stated figure) | NOAA's own metadata contradicts itself; the appropriate-use notice makes over-polling abuse. Took the slower figure |
| `EPSG:4326` for `GetMap` | WMS 1.3.0 reverses axis order for 4326 (`BBOX=miny,minx,maxy,maxx`). EPSG:3857 is offered, matches Leaflet's native CRS, and sidesteps the trap entirely |
| Make `kind` optional with an `"observation"` default | silently lets a future spatial layer register as a point layer; the compiler should force the decision |
| Reuse `sampling` to bound imagery cost | `maxMarkers` is meaningless for a raster; imagery cost is bounded by the viewport |
| Widen `ObservationProvenance["providerStatus"]` to include weather | couples weather to four unrelated layer status unions (§8) |

---

## 11. Deliberately not built in this batch

GFS ingestion; GRIB2 decoding; EUMETSAT; satellite imagery; additional radar
networks; lightning; forecast UI or timeline scrubbing; weather animation;
global radar federation; any observation-layer migration of `SignalMap`.

---

## 12. Verification honesty

No `GetMap` request has ever been issued from this workspace, and no rendered
radar tile has been seen. Sandbox egress to provider hosts fails at TLS. All
URL and parameter construction is verified against fixtures and the captured
`GetCapabilities` document recorded in
`docs/research/providers/nws-radar-wms-admission.md`. **The first live provider
check is the Windows/networked runtime.**

What *was* exercised end to end locally: the API server was built and started,
and `GET /api/monitoring/weather` returned a well-formed response in which the
radar product reported

```
"availability": "unavailable",
"imagery": null,
"message": "NOAA/NWS radar could not be reached: fetch failed."
```

That is the sandbox's blocked egress, and it is the correct behaviour for an
unreachable provider: no surface offered, the failure named, and no implied
statement about the weather. It confirms the failure path, the route, the zod
contract and the server-side cache. It confirms nothing about what NOAA
actually returns.

### 12.1 Promoting radar to "operationally verified"

Weather Batch 1 is *structurally* complete. NOAA radar stays **admitted and
implemented** rather than **operationally verified** until the provider has
been exercised for real, because this is the point at which the integration
crosses from a contract to an actual external raster.

Most of that is now automated. Run on a networked host:

```
pnpm --filter @workspace/api-server run verify:radar
# or against a deployment:
API_BASE_URL=https://host/api pnpm --filter @workspace/api-server run verify:radar
```

`artifacts/api-server/scripts/verify-radar-live.mjs` issues the **first
`GetMap` requests this project has ever made** and checks:

| # | Check | How |
| --- | --- | --- |
| 0 | the script identifies exactly as the server does | reads `SIGNALWATCH_USER_AGENT` out of `provider-fetch.ts` and fails on drift |
| 1 | GetCapabilities reachable, WMS 1.3.0, layer still published, EPSG:3857 still advertised, frame time readable | live XML |
| 2 | GetMap returns a real PNG of the requested dimensions, not a 200 ServiceException | PNG IHDR parse |
| 3 | an explicit `TIME` is accepted | second GetMap |
| 4 | the out-of-coverage request *succeeds* — demonstrating why the clip exists | one deliberate central-Asia GetMap |
| 5 | product contract: five areas, all inside the published envelope, none claiming Europe; WMS/3857/png/transparent; endpoint direct to NOAA and not relayed; `validTime`/`runTime` null; frame time distinct from receipt time | `/monitoring/weather` |
| 6 | the metadata cache absorbs client polling | two consecutive requests must share an `ingestionTimestamp` |
| 7 | the desktop CSP permits direct provider imagery | static read of `tauri.conf.json` |

A provider outage is reported as a note, not a failure; a *wrong answer* is a
failure. Verified against a stub serving envelope-as-coverage, 5-minute
polling, EPSG:4326, a relayed endpoint and a receipt-stamped frame time: all
eight violations were caught, exit 1.

Four things the script cannot establish, which remain a human check in the
packaged Windows build:

1. the radar is drawn in the geographically **correct place** — needs a
   reference raster or an eye;
2. panning to Europe draws nothing and the panel reads "no radar source";
3. devtools shows `GetMap` going direct to `mapservices.weather.noaa.gov`,
   never through `/api`, and **no** request for a tile outside the five areas;
4. tiles actually render inside **WebView2**.

### 12.2 The shell is part of the provider integration surface

Because imagery is deliberately browser → NOAA, the desktop CSP and the
service worker sit in the request path and can break radar in ways that pass
every unit test and every dev-server check. Both are now asserted rather than
assumed:

- `verify-desktop.mjs` requires the Tauri CSP's `img-src` to permit remote
  HTTPS images. Tauri serves from `tauri.localhost` and WebView2 enforces the
  policy, so an `img-src` without remote origins would break NOAA radar *and*
  provider camera stills only in the installed build.
- `verify-pwa.mjs` requires the **only** Workbox runtime route to be the
  network-only `/api/` rule, and the generated worker to register no
  `CacheFirst`, `StaleWhileRevalidate` or `NetworkFirst` strategy. A caching
  route over provider imagery would serve stale radar while the UI reported a
  fresh frame time, and a revalidating one would re-request tiles on the
  worker's schedule rather than NOAA's — which the appropriate-use policy
  treats as abuse.

Both assertions were confirmed to fail when deliberately violated.

One governance observation, recorded rather than acted on: the desktop
`img-src` is a blanket `https:` wildcard, not a provider allowlist. That is
pre-existing, it predates radar, and it is what also lets camera stills load.
Narrowing it to the admitted provider hosts would be a genuine tightening, but
it would silently break any camera provider not on the list, so it is left to
an explicit decision rather than folded into a weather batch. The assertion
above is written to accept *either* form — a wildcard or an allowlist naming
NOAA — so tightening it later will not trip the verifier, and removing remote
images entirely will.
