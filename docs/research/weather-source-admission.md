# Global Weather Source Admission

Research record. **No weather code is implemented.** Researched 2026-09-30
against Signalwatch `a627b15`, under `source-admission-standard.md`.

## Scope

Establish which sources can back a first-class Signalwatch weather layer group
split into model fields, satellite imagery, radar, and severe-weather alerts.

**Headline finding: one of the three candidate sources in the brief no longer
exists in the form described.** NOAA nowCOAST was decommissioned in April
2023. Details in its section; it changes the radar and satellite plan.

## Signalwatch weather requirements

| Requirement | Consequence |
| --- | --- |
| $0 recurring, indefinitely | No paid tiles, no usage billing |
| Global canvas for model fields | Rules out point-forecast APIs as the foundation |
| Server-side ingestion, cached | The browser must never call a weather provider |
| Honest coverage per product | Radar is regional; satellite varies; model is global |
| Run time ≠ valid time | A forecast is not "live" and must not be labelled so |
| Provider isolation | One weather product failing must not affect others |

---

## NOAA GFS

### Source
NOAA/NCEP Global Forecast System, distributed operationally through NOMADS
(<https://nomads.ncep.noaa.gov/>).

### Data products
Verified present on the NOMADS index:

| Dataset | Cycle frequency | GRIB filter |
| --- | --- | --- |
| GFS 0.25 Degree | 6 hours | `gribfilter.php?ds=gfs_0p25` |
| GFS 0.25 Degree Hourly | 6 hours | `ds=gfs_0p25_1hr` |
| GFS 0.25 Degree (Secondary Parms) | 6 hours | `ds=gfs_0p25b` |
| GFS 0.50 Degree | 6 hours | `ds=gfs_0p50` |
| GFS 1.00 Degree | 6 hours | `ds=gfs_1p00` |
| GFS sflux | 6 hours | `ds=gfs_sflux` |

Bulk HTTPS tree: `https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod`.

### Resolution / horizon / cycle
0.25°, 0.5° and 1.0° global grids; **four cycles per day (6-hourly)**. Forecast
horizon not re-verified in this pass — **unresolved**, and it determines how
far any future time control can reach.

### Variables
GFS carries surface temperature, 10 m wind components, precipitation, MSLP,
humidity and cloud cover among many others. **The exact GRIB parameter names
and levels for each Signalwatch field were not enumerated** and must be read
from the GRIB filter variable list before implementation. Unresolved.

### Access and cost
Public, keyless, no account. US Government work. **$0.**

### Download / subset options
The brief asks whether an official subset mechanism exists. **It does**: the
NOMADS *GRIB filter* is a documented per-dataset service
(<https://nomads.ncep.noaa.gov/info.php?page=gribfilter>) allowing selection by
variable, level and geographic subregion. Downloading whole global GRIB files
repeatedly is therefore unnecessary and would be the wrong design.

### Operational considerations — the blocking one

**GFS is distributed as GRIB2.** Signalwatch is a TypeScript/Node codebase
with no GRIB decoder, and no mature, well-maintained pure-JS GRIB2 library is
established in the dependency set. Adding one is a real decision, not a
detail, and the brief explicitly warns against prematurely building a
meteorological raster engine.

There is a plausible GRIB-free path: NOMADS has historically exposed GFS via
**OPeNDAP** (`/dods/...`), which can return array subsets in ASCII or binary
without GRIB decoding. **That was not verified in this pass** — the NOMADS
index page lists only "grib filter" and "https" access columns — so it is
recorded as the first thing to check, not as a solution.

### Signalwatch compatibility

| Question | Answer |
| --- | --- |
| Licence / cost | Clear. US Government, keyless, $0 |
| Global coverage | Yes, genuinely global |
| Server-side ingestion | Yes, with GRIB filter subsetting |
| Transport into Node | **Unresolved** — GRIB2 decoding or OPeNDAP |
| Fits existing layer engine | **No** — see "Architecture" below |

### Decision
**ADOPT WITH CONDITIONS.** The source is unambiguously admissible: public,
keyless, global, free. The conditions are entirely technical, not legal:

1. Determine the transport — verify whether NOMADS OPeNDAP can deliver the
   required fields without GRIB2 decoding; if not, make an explicit decision
   about a GRIB2 dependency.
2. Enumerate the exact GRIB variable/level identifiers for each field.
3. Confirm the forecast horizon.

---

## NOAA NOMADS

Covered above — NOMADS is the distribution system rather than a separate
dataset. Recorded separately only for its access mechanics.

### GRIB access
Per-dataset GRIB filter plus a bulk HTTPS tree, both keyless.

### Filtering / subsetting
The GRIB filter is the official subset mechanism and should be used in
preference to whole-file downloads.

### Rate / infrastructure considerations
NOMADS is a heavily used public service. No numeric rate limit was located in
this pass — **unresolved**. Signalwatch would fetch once per model cycle
(4×/day) per field, which is negligible, but the absence of a published limit
should be recorded rather than assumed generous.

### Decision
**ADOPT WITH CONDITIONS**, inseparable from GFS above.

---

## NOAA nowCOAST

### Status: **decommissioned in its documented form**

NWS Service Change Notice 23-12:

> "nowCOAST @ IDP will be turned off on or about **April 3, 2023** and users
> will be redirected to nowCOAST on Amazon Web Services…
>
> Unfortunately, not all the datasets on the present nowCOAST@IDP map services
> will be available on the nowCOAST cloud-based map services…
>
> it will provide only Open Geospatial Consortium (OGC) compliant Web Map
> Service (WMS), but no ArcGIS REST map services…
>
> the cloud-based nowCOAST will be monitored only **8 x 5**…"

The cutover service list was narrow — ocean forecast currents and several
sets of geo-referenced hyperlinks. **The radar, satellite and lightning
products the brief attributes to nowCOAST were not in it**, with "map services
for many of the missing data sets… added during the next 12 to 24 months" and
users "encouraged to investigate NWS' operationally supported cloud-based map
[services]".

*Evidence:* <https://www.weather.gov/media/notification/pdf_2023_24/scn23-12_nowcoast.pdf>

### Decision
**EXCLUDE as described in the brief.** This is the third time in this project
that a widely-cited source reference has turned out to be stale — after
OSIRIS's retiring Suomi NPP product and its README's phantom camera adapters.
Its replacement follows.

---

## NWS operational map services — the actual radar path

### Source
`https://mapservices.weather.noaa.gov/eventdriven/rest/services/` — folders
`radar`, `water`, `WWA`, `Utilities`.

### Radar products

| Service | Type | Notes |
| --- | --- | --- |
| `radar/radar_base_reflectivity` | MapServer | MRMS-derived, quality controlled at 1 km, **updated every 10 minutes**, WMS capabilities |
| `radar/radar_base_reflectivity_time` | ImageServer | **Time-enabled**, four-hour moving window, **OGC WMS 1.3.0** access |

### Coverage — stated by the provider

> "The coverage area for this map service is the **Continental United States,
> Canada, Alaska, The Caribbean, Guam, and Hawaii**."

This is explicitly **not global**, which settles the brief's instruction not to
label radar "global". A radar layer backed by this source covers North
America and named territories, and everywhere else must report *no source*,
not *no rain*.

### Why this is the strongest near-term weather candidate

It is **provider-rendered**. WMS returns map imagery, so Signalwatch needs no
GRIB decoder, no raster engine and no new rendering dependency — the exact
opposite of the GFS transport problem. It also carries a documented 10-minute
update cadence and a time dimension for later animation.

### Decision
**ADOPT WITH CONDITIONS** — conditions being to read the service's own usage
terms and confirm WMS `GetMap` parameters, neither of which was done in this
pass.

> **Update 2026-10-01 — both conditions cleared; this is now ADOPT.**
> The NWS disclaimer and its *Public Notice of Appropriate Use* were read, and
> WMS 1.3.0 `GetCapabilities` was read from the service itself (layer name,
> formats, CRS list, bounding box and time dimension confirmed). Full record:
> `providers/nws-radar-wms-admission.md`.
>
> Three corrections to this section arising from that pass:
> - The time-enabled ImageServer Signalwatch would call lists its coverage as
>   **CONUS, Alaska, Caribbean, Guam and Hawaii — not Canada.** The Canada
>   mention above came from the sibling MapServer. Quote the service actually
>   called.
> - The provider states both "Every 5 minutes" and "approximately every ten
>   minutes" for this product. Signalwatch takes the slower figure for polling.
> - NWS publishes no numeric rate limit but does publish an appropriate-use
>   policy whose first rule is to match the data's refresh frequency. That is
>   the binding constraint, and it is behavioural rather than numeric.

---

## EUMETSAT EUMETView

**Not researched in this pass.** Recorded as the leading satellite-imagery
candidate for European and wider coverage, with WMS/WFS/WCS interfaces. Its
licence, registration requirement and coverage are **unknown**, and under
invariant 5 they stay unknown until read. No decision.

---

## Cross-source findings

- **Model and imagery are different problems.** GFS is raw gridded data
  needing decoding and rendering; WMS services are already rendered. The
  cheapest path to a visible, honest weather layer is imagery, not model
  fields — which inverts the implementation order the brief suggests.
- **Nothing here is globally uniform.** GFS is global; NWS radar is North
  America plus named territories; satellite depends on the platform. Coverage
  must be declared per product, never per layer group.
- **Keyless throughout.** None of the admitted NOAA paths requires an account,
  so the credential distribution check does not bite here.
- **Existing NWS alerts already cover severe weather** and should be
  re-presented under the weather group rather than duplicated.

## Final weather-source map

| Weather function | Provider | Source / interface | Admission | Notes |
| --- | --- | --- | --- | --- |
| Global temperature / wind / precipitation / pressure | NOAA | GFS via NOMADS GRIB filter | **ADOPT WITH CONDITIONS** | Transport unresolved: GRIB2 decode vs OPeNDAP |
| Radar reflectivity | NOAA / NWS | `mapservices.weather.noaa.gov` radar WMS | **ADOPT** — conditions cleared 2026-10-01, see `providers/nws-radar-wms-admission.md` | CONUS + Alaska/Caribbean/Guam/Hawaii only; poll no faster than 10 min |
| Radar, other regions | — | — | **not researched** | Would be a federation; nothing admitted |
| Satellite imagery | EUMETSAT / NOAA | EUMETView, GOES | **RESEARCH** | Terms and coverage unread |
| Lightning | — | — | **unresolved** | nowCOAST's product did not survive its migration |
| Severe weather alerts | NOAA / NWS | existing `noaa-nws` hazard source | **ADOPTED, live** | Reuse; do not duplicate |

---

## Architecture finding: weather does not fit the current layer engine

Every Signalwatch layer today is a **point observation** — camera, vessel,
hazard, civic incident — rendered as a marker, sampled by
`provider-balanced` marker caps, selectable in an inspector.

Weather model fields and imagery are **continuous surfaces**. They have no
marker, no per-record identity, no selection semantics, and sampling caps are
meaningless for them. Forcing them into `BaseObservation` would be the same
category error as the earlier News Mentions problem — an aggregate pretending
to be a point — but larger.

This needs a deliberate extension: a second layer *kind* (a field/imagery
layer) alongside observation layers, sharing the registry, provenance,
coverage, freshness and attribution machinery while rendering differently and
carrying no observation list. **That design is the real first task**, and it
should be settled before any provider code, or the first weather layer will
dictate the architecture by accident.

## Recommended Weather Batch 1 — and why it differs from the brief

The brief proposes Global Model Core (temperature, wind, precipitation) first.
On the evidence, that is the **hardest** starting point: it is the one
candidate with an unresolved transport problem and it simultaneously requires
the new layer kind, a decoding strategy and a rendering strategy.

Proposed instead:

**Weather Batch 1 = the field/imagery layer kind + NWS radar via WMS.**

- Proves the new layer kind end to end with a provider that needs no decoder.
- Delivers a genuinely live, 10-minute-cadence product immediately.
- Forces the coverage question honestly from day one, because the source is
  regional and says so.
- Leaves GFS transport to be resolved on its own, without also inventing the
  layer kind underneath it.

**Weather Batch 2 = GFS model core**, once the transport question is answered.

This is a recommendation, not a decision taken unilaterally — the brief was
explicit about the intended order, and reversing it is the user's call.

---

## Weather Batch 1 — built 2026-10-01

The recommendation above was accepted. Weather Batch 1 shipped as **the
spatial layer kind + NWS radar via WMS**; GFS remains Batch 2.

Full architecture: **`docs/research/weather-layer-architecture.md`**.
Provider admission: **`docs/research/providers/nws-radar-wms-admission.md`**.

### What the spatial abstraction actually is

`LayerDefinition` now carries a required, type-safe
`kind: "observation" | "imagery" | "field"`. All three kinds share the one
authoritative layer registry, provenance, attribution, coverage, freshness and
provider health; they differ only in what they carry and how they render.

Weather registers as an **imagery** layer in the same registry as the four
observation layers. No second registry exists. `createLayerRegistry` now
validates kind consistency and throws on contradictions — a spatial layer
declaring marker sampling, the record inspector or the globe, or an
observation layer with no marker colours. Those are the four ways the two
kinds could have quietly corrupted each other.

`BaseObservation` was **not** extended. It hard-requires `latitude`,
`longitude`, `id` and `key`; a radar mosaic has none of them, and inventing a
bbox centroid would fabricate a coordinate no provider published.

The `field` contract is declared and type-checked but has no runtime. **No
GRIB2 decoder and no GFS ingestion exist in this codebase.**

### Radar admission — implemented as recorded

NOAA/NWS MRMS composite base reflectivity, WMS 1.3.0, layer
`radar_base_reflectivity_time`, `image/png`, transparent, keyless, public
domain. All provider specifics live in
`artifacts/api-server/src/weather-sources/nws-radar.ts`; nothing downstream
contains a NOAA condition.

### CRS decision

**EPSG:3857**, requested explicitly. The service also offers CRS:84 and
EPSG:4326, but WMS 1.3.0 reverses axis order for EPSG:4326
(`BBOX = miny,minx,maxy,maxx`), and 3857 is the map's native projection, so
there is no reprojection and no axis trap. A product advertising a CRS the map
cannot request is **not drawn** rather than substituted — a silently
substituted projection puts a plausible-looking surface in the wrong place.

### Coverage decision

Coverage is a **list of named boxes**, not one box. NOAA publishes a single
envelope of −176 → 150 longitude, which is the min/max of five disjoint
regions spanning the Pacific; literally it contains Europe, Africa and Asia.
Clipping to it would have requested transparent tiles over Berlin, and
transparent radar over Berlin reads as *no precipitation over Berlin*.

So the render clip is five boxes drawn generously around the regions NOAA
itself names — CONUS, Alaska, Hawaii, Caribbean, Guam — each strictly inside
the published envelope, so the clip only narrows the provider's claim. Leaflet
is given one bounded WMS layer per area and therefore issues **no request at
all** outside them. There is no code path that can paint an uncovered region.

Canada is **not** claimed. An older NOAA MapServer description mentioned it;
this service's own metadata does not.

### Freshness decision

Three timestamps are kept separate: the frame's valid time (read from the WMS
time dimension), Signalwatch's retrieval time, and model valid/run time
(`null` for radar, because MRMS base reflectivity is an observation).

Refresh interval **600 000 ms (10 min)**; stale after **1 800 000 ms (30 min,
three missed cycles)**. NOAA's metadata states both "every 5 minutes" and
"approximately every ten minutes"; the slower figure was taken. The NWS
*Public Notice of Appropriate Use* defines requesting faster than the data
refreshes as abuse and reserves the right to block IPs, so this is a terms
constraint, not a performance preference. The API-server cache TTL equals the
same interval, so N clients cause one upstream metadata request per cycle.

### What crosses the wire, and what does not

Signalwatch serves **metadata only** — `GET /monitoring/weather` returns
products, coverage, freshness and provider health. The **imagery is requested
by the browser directly from NOAA**, exactly as camera media is. Signalwatch
is not a relay for provider pixels.

### Sandbox limitation

**No `GetMap` request has ever been issued from this workspace and no radar
tile has been rendered.** Sandbox egress to provider hosts fails at TLS. All
URL and parameter construction is verified against fixtures derived from the
`GetCapabilities` document captured in the admission record.

The one thing that *was* exercised locally is the failure path: the built API
server answered `GET /api/monitoring/weather` with `availability:
"unavailable"`, `imagery: null` and `"NOAA/NWS radar could not be reached:
fetch failed."` — correct behaviour for an unreachable provider, and silent
about the weather.

**The first live provider check is the Windows/networked runtime.**
