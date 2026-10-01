# Checkpoint C3 — spatial imagery on the physical globe

Status: implemented. Supersedes the Checkpoint B capability rule that barred
spatial layers from the globe entirely.

This records *why* the globe now draws admitted provider surfaces, and the
specific lies the design is built to prevent. The weather layer is the first
consumer, but nothing below is weather-specific: it is a
`SpatialImagery → renderer projection` path, and a second admitted surface
would use it unchanged.

---

## 1. What changed, in one sentence

The globe gained a *surface* renderer alongside its *marker* renderer, and
`capabilities.globe` now distinguishes which one a layer is asking for by its
`kind` rather than by a second flag.

---

## 2. The capability model

Checkpoint B rejected any spatial layer declaring `globe`, because at that
point the globe could only draw point markers and the flag could only have
meant "turn this raster into markers" — which is meaningless for a surface.

That reasoning expired when the globe acquired a surface renderer. The rule
is now:

| | observation layer | spatial layer (`imagery` / `field`) |
|---|---|---|
| `map` | may declare | may declare |
| `globe` | may declare → **point markers** | may declare → **projected surface** |
| `inspector` | may declare | **rejected** |
| `sampling` | may declare | **rejected** |

`globe: true` on a spatial layer means *"an authorised globe renderer exists
for this surface"*. It never means "turn it into markers".

The two renderers are kept apart **by kind, not by the flag**. Any marker
consumer must filter on `capabilities.globe && kind === "observation"`. The
globe's marker legend was corrected to do exactly this; without that, radar
would have appeared in the marker key with no marker colour. The
`inspector` and `sampling` bans are what actually keep a surface out of the
selection and record pipelines, and both are still enforced by
`validateLayerDefinition`.

Three Checkpoint B tests encoded the superseded rule and were updated
deliberately rather than deleted — each retains the half of its assertion
that still holds.

---

## 3. One descriptor, two projections

There is no second weather product type, and no provider metadata is restated
for the globe. `toGlobeImageryTiles` consumes the **same `RenderableImagery`**
the 2D map consumes, and the globe inherits every decision already made by the
shared availability model:

- it never re-decides whether a surface may be drawn — it reads `render`;
- it never re-derives coverage — it reads `areas`;
- it never re-resolves the frame — it reads `time`;
- it never restates attribution — it reads `attribution`.

Consequence: the two renderers **cannot** disagree about source, timestamp,
coverage, selected frame or attribution, because there is only one object
carrying those facts. They are allowed to differ in projection, and nothing
else.

The only field the globe overrides is the CRS, and it derives that from the
shared service object (`{ ...surface.service, crs: GLOBE_IMAGERY_CRS }`)
rather than writing a new endpoint, layer, version or format anywhere.

---

## 4. The projection mechanism

`three-globe`'s tiles layer (`tilesData`), exposed through
`react-globe.gl@2.38` and verified present in its `.d.ts`.

Each coverage area becomes **one latitude/longitude-bounded patch**, curved to
the sphere by `tileUseGlobeProjection` at a `tileCurvatureResolution` of 4
angular degrees. That is roughly a dozen segments across a continent — enough
that the patch follows the curvature instead of floating as a flat card.

Properties this buys, which matter more than appearance:

- **Nothing can be drawn outside coverage.** The patch *is* the clip. There is
  no code path that paints beyond a declared area, which is the same guarantee
  Leaflet's `bounds` gives on the 2D map.
- **Geography is preserved.** The patch is positioned by the provider's own
  degree bounds, not by a hand-placed quad.
- **No rectangular WMS paste.** Nothing is stretched across the sphere as a
  whole-Earth texture, and no equirectangular screenshot is used as a fake
  globe surface.

`globeTileEngineUrl` was explicitly rejected: it replaces the entire Earth
basemap with a slippy-tile engine, destroying the existing texture. It is the
wrong layer. `tilesData` is additive and bounded.

### 4.1 Why CRS:84 and not EPSG:3857 or EPSG:4326

A tile patch is a lat/lng rectangle, i.e. an equirectangular frame, so the
texture must be requested in one.

- **EPSG:3857** is what the 2D map uses, because Leaflet's tile pyramid is Web
  Mercator. Pasting a Mercator image onto a lat/lng patch would stretch it
  north–south and place the weather visibly north of where it is. Rejected.
- **EPSG:4326** is geographic but is a trap under WMS 1.3.0, which flips it to
  **latitude-first** axis order. A `west,south,east,north` bbox would silently
  mean something else. This is the exact hazard `spatial-layers.ts` already
  documents avoiding. Rejected.
- **CRS:84** is defined as **longitude-first**, so the bbox convention used
  everywhere else in the codebase stays valid. Adopted.

NOAA advertises all three in its GetCapabilities, so this needs no new
provider permission — it is the same admitted service, requested in a
projection it already publishes.

**This is verified, not assumed.** The service descriptor carries
`supportedCrs`, the list the provider advertises in its own GetCapabilities,
recorded in `nws-radar.ts` alongside the rest of the NOAA facts so that no
renderer has to carry provider-specific knowledge. The globe projects only
when `CRS:84` appears in that list and **fails closed otherwise** — including
when the list is empty, meaning "not established from provider
documentation".

The failure mode this prevents is worse than an error: requesting an
unadvertised projection can return a *plausible image in the wrong
projection*, which would place weather confidently in the wrong location on
a layer whose entire value is being in the right place. Drawing nothing is
the correct failure.

### 4.2 Texture size

Longest edge capped at 2048 px, aspect ratio preserved. Matching MRMS's ~565 m
resolution across the continental United States would need ~11,000 px, far past
common GPU limits and far past what a globe-scale view can show. 2048 sits
inside the 4096 floor WebGL implementations must support and still resolves a
few kilometres per pixel at continental extent.

---

## 5. Coverage: five areas, never an envelope

NOAA publishes five disjoint areas: **Continental United States, Alaska,
Hawaii, Caribbean, Guam**. They become five patches and are never merged.

This is not tidiness. The bounding box of Alaska and Guam contains most of the
Pacific Ocean. Drawing one envelope patch would paint a transparent raster
across ocean NOAA does not observe, and a transparent radar raster reads as
*"no echoes here"* — a weather claim Signalwatch has no source for.

Outside coverage the surface is **not drawn at all**, and the globe says
`"No radar source for this part of the globe"`. An absent surface is a
statement about Signalwatch's sources. It is never a report that conditions
are clear.

A mutation that merges the areas into one envelope fails four tests.

---

## 6. Composition with the lighting model

Render order: **Earth surface → weather surface → solar illumination →
atmosphere → observations.**

The weather patch sits at `tileAltitude` 0.006 globe radii — above the surface,
below the observation markers, with `depthWrite: false` so markers above it
still resolve correctly.

The load-bearing decision is the **material**:

> `MeshLambertMaterial`, **not** `MeshBasicMaterial`.

A basic material ignores lighting. Radar would glow at full intensity across
the night side and cut a bright hole straight through the terminator — the
weather would be lit when the Earth beneath it was not. A Lambert surface is
lit by the *same* `DirectionalLight` placed by `solar-geometry.ts`, so weather
on the night side is correctly dim and the day/night boundary survives
underneath it.

Weather is therefore subordinate to the lighting model rather than an
exception to it. It does not replace, fake, or override the illumination, and
C2's physical solar model is untouched by this checkpoint.

### 6.1 Known unverified precondition — CORS

WebGL will not sample a cross-origin texture unless the response is
CORS-clean, so the loader sets `crossOrigin = "anonymous"`. **If NOAA does not
return an `Access-Control-Allow-Origin` header on `GetMap`, the texture load
fails outright — it does not degrade.**

This could not be verified in the build sandbox: egress to
`mapservices.weather.noaa.gov` failed at the TLS layer
(`SSL_ERROR_SYSCALL`), the same condition under which `verify:radar` reports
`note` rather than `ok`. **It is therefore recorded as unverified, not as
working.**

Rather than hide this behind a visual approximation, the failure is made
explicit: the texture `onError` path records the affected area and the globe
states

> `Radar surface could not be drawn for <area> · source unavailable to this
> renderer, not a report of clear conditions`

If manual check **E** below shows CORS is absent, that is a **renderer
limitation to report, not to work around**. Do not proxy the imagery through
the API to defeat it — that would break the standing invariant that provider
imagery goes browser→NOAA directly, and would make Signalwatch a redistributor
of NOAA imagery rather than a client of it.

### 6.2 Mobile and WebGL degradation

The weather surface is mounted **inside** the existing WebGL guard in
`interactive-sector-globe.tsx`: the globe is lazily loaded only when
`webglAvailable` is true, wrapped in `WebGLErrorBoundary` with a static
fallback. The `imagery` prop is passed to `SatelliteSectorGlobe`, which lives
inside that branch, so on a device without WebGL **none of this code runs at
all**.

The resulting degradation chain is honest and unchanged from before C3:

```
no WebGL  ->  globe falls back to the static view (still usable)
          ->  weather is simply absent from the globe renderer
          ->  the 2D map continues to serve NOAA radar normally
```

**No low-fidelity weather approximation was invented.** There is no
simplified raster, no coloured overlay and no "weather-ish" shading standing
in for radar on weak devices. A surface is either the admitted provider
imagery, correctly projected, or it is absent and said to be absent.

The 2D path is structurally insulated: it reads the service descriptor and
never the globe capability, which is asserted by *granting the globe
capability does not change what the 2D map requests*. If that test ever
fails, the globe has become load-bearing for the map, which the mobile-first
constraint forbids (see `mobile-first-constraint.md`).

---

## 7. Performance safeguards

No raster is regenerated per frame. A surface is rebuilt only when the
**imagery identity** changes, expressed by `globeImagerySignature`: the
texture URL (which already encodes endpoint, layer, CRS, bbox, size, format
and frame), plus opacity, attribution and patch geometry.

Deliberately **excluded** from that signature, because none of them changes
what is fetched:

- camera position, rotation, zoom;
- the solar clock, which ticks every 60 s;
- availability messages and freshness text.

The camera and the Sun are not inputs to the projection *at all*, which is the
structural reason neither can trigger a NOAA request — not a guard that could
be forgotten, but an absence of any wire between them. `tilesTransitionDuration`
is 0, so data changes do not animate geometry, and `tileLabel` carries
`triggerUpdate: false` upstream.

This matters because the NWS *Public Notice of Appropriate Use* treats
request cycles that ignore the data refresh frequency as **abuse**, not merely
waste. The admitted cadence is 10 minutes; globe rotation must never become a
request multiplier.

Materials and their textures are disposed on teardown.

---

## 8. Tests

`artifacts/signalwatch/tests/globe-imagery.test.tsx` (33 tests) plus three
updated in `spatial-layer.test.tsx`. Frontend suite: **226 passing**.

Coverage maps to the checkpoint clauses:

| Clause | Test |
|---|---|
| §2 spatial + globe is valid | *a spatial layer may now declare both map and globe* |
| §2 inspector still banned | *a spatial layer still may not declare inspector* |
| §2 sampling still banned | *a spatial layer still may not declare sampling* |
| §2 observation invariants intact | *observation layers keep their existing marker invariants* |
| §2 no marker leak | *globe on a spatial layer does not add it to the marker legend set* |
| §3 one shared descriptor | *globe patches are derived from the same RenderableImagery* |
| §12 unauthorised layer not projected | *imagery whose layer has no globe renderer is not projected* |
| §4 five areas | *the five NOAA areas become five separate patches, never one envelope* |
| §4 exact clip | *each patch covers exactly its declared area and nothing outside it* |
| §5 projection | *globe textures are requested in a longitude-first geographic CRS* |
| §8 Australia | *Australia with NOAA radar yields no patch at all, not a blank one* |
| §12 Europe | *Europe with NOAA radar is also outside coverage* |
| §9 2D/3D agreement | *globe and map agree on provider, frame, coverage and attribution* |
| §9 undrawable frames | *a frame the map will not draw is not drawn on the globe either* |
| §10 identity stability | *rotating the globe and advancing the Sun never change imagery identity* |
| §11 real changes detected | *a new provider frame does change imagery identity* |
| §12 not selectable | *radar is not selectable and never enters the observation pipeline* |
| §12 not counted | *projecting a surface produces no observation records* |
| §15F geography | *a known CONUS coordinate falls in the CONUS patch and nowhere else* |
| §15F geography | *a known CONUS coordinate maps to the expected point in the texture* |
| §15F geography | *patch centroids project onto the globe at their own coordinates* |
| §15F geography | *Guam and the Caribbean sit on opposite sides of the globe* |
| §15G unsupported CRS | *a service that does not advertise CRS:84 is not projected* |
| §15G unsupported CRS | *a service with no established CRS list fails closed on the globe* |
| §15G unsupported CRS | *a product in an unrenderable CRS produces no surface anywhere* |
| §15G provider failure | *an unavailable provider produces no globe surface* |
| §14 fallback | *granting the globe capability does not change what the 2D map requests* |
| §14 fallback | *the globe projection is a pure read and mutates no shared state* |
| §14 fallback | *no surfaces at all is a silent state, not an error message* |

### 8.1 Mutation evidence

Tests were verified to bite, not merely to pass:

| Mutation | Failures |
|---|---|
| merge the five areas into one envelope | 4 |
| leave the texture in Web Mercator | 1 |
| drop the `render` guard (paint outside coverage) | 3 |
| signature ignores the texture URL | 1 |
| drop the globe-capability check | 1 |
| assume CRS:84 support instead of verifying it | 2 |
| patch centroid uses the west edge instead of the centre | 1 |
| patch height stretched 1.3x (Mercator-like) | 1 |

All restored; 226/226 after each.

The geography tests use `geoToGlobeVector` from the C2 solar module as an
independent oracle, so patch placement is pinned to the same coordinate
convention that was verified against three-globe's own source — a patch
cannot be positioned by a different convention from the markers and lights
around it. The texture test also computes the Mercator `v` for the same
coordinate and asserts the two differ, so the test fails if it is ever
rewritten in a way that would pass under either projection.

---

## 9. Windows manual acceptance

Static tests cannot prove what WebGL draws. Build with
`pnpm --filter @workspace/signalwatch-desktop build` and launch
`artifacts\signalwatch-desktop\src-tauri\target\release\signalwatch-desktop.exe`
directly.

Record each as PASS, FAIL, or `BLOCKED: <reason>`. **Never record an unrun
check as PASS.**

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Launch the current release build | Application starts | PENDING |
| 2 | Open the 3D globe | Globe renders, lit by the solar model | PENDING |
| 3 | Confirm the initial orientation | Australia-first, per C1 | PENDING |
| 4 | Enable Weather | Layer activates; no error | PENDING |
| 5 | Confirm Australia | **No NOAA radar surface**; the readout states there is no radar source, never "clear" | PENDING |
| 6 | Rotate to CONUS | Radar surface appears | PENDING |
| 7 | Confirm placement | Radar sits over the correct geography — check a known city against the echo pattern, not merely "a texture loaded" | PENDING |
| 8 | Rotate the globe repeatedly | Surface stays locked to geography | PENDING |
| 9 | Watch the Network panel while rotating | **No new `GetMap` requests** from rotation; no flicker or reload | PENDING |
| 10 | Observe the Sun and terminator | Terminator still visible and physically placed | PENDING |
| 11 | Confirm coexistence | Radar dims into the night side; it is readable but does not erase the terminator or glow as a bright rectangle | PENDING |
| 12 | Click the radar surface | **Nothing is selected**; no inspector opens; observation counts unchanged | PENDING |
| 13 | Click an observation marker | Still selectable exactly as before | PENDING |
| 14 | Switch to the 2D map | NOAA behaviour unchanged; same provider, frame and attribution as the globe reported | PENDING |

### 9.1 Additional checks this checkpoint requires

| # | Check | Expected | Result |
|---|---|---|---|
| 15 | DevTools → Network on first load | `GetMap` goes **directly to mapservices.weather.noaa.gov**, returns 200, and carries `Access-Control-Allow-Origin`. If the texture errors with a CORS message, record **FAIL — renderer limitation** and report it; do not proxy it | PENDING |
| 16 | Wait 60 s without touching the camera | Solar readout advances; **no new `GetMap` requests** | PENDING |
| 17 | Rotate to the Pacific between Alaska and Guam | Nothing drawn; no transparent sheet across the ocean | PENDING |
| 18 | Rotate to Europe | No radar surface; no-source wording | PENDING |

## 10. Explicitly not done

Per the checkpoint's own prohibitions: no BOM or Australian radar, no Waze,
Google, Petrol Spy or emergency navigation; the globe stack was not replaced;
no second spatial data model was created; radar was not turned into markers;
no global weather was faked; no admission rule was weakened; no paid
dependency was added.

Australian weather remains **out of scope until C4/C5**, and the Australian
acceptance test asserts exactly that: with NOAA as the only admitted radar
provider, Australia must report *no radar source here*.
