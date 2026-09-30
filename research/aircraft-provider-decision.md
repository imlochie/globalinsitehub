# Aircraft Provider Feasibility Gate — Decision Record

**Status:** research and documentation only. No Aircraft layer, adapter, normalizer, fixture, contract change,
or dependency change was made as part of this pass.

**Branch:** `arena/01a0f054-globalinsitehub` (the requested `arena/signalwatch-aircraft-provider` could not be
used — this session is pinned to the branch above; see "Process notes").

**Revalidation date:** 2026-09-30. All provider statements below were re-read from first-party sources on that
date; they supersede, and in two cases materially contradict, `research/aircraft-data-provider-research.md`.

**Environment caveat:** this sandbox has no outbound network egress (`curl` to
`api.adsb.lol`, `opensky-network.org`, `api.airplanes.live` all fail at connect, exit status `000`). Therefore
**no live endpoint probe was performed in this pass.** Every statement below is documentation evidence. Any
claim that would require a live request is marked `UNRESOLVED`. Prior live probes recorded in
`research/sources/` were made from a different environment and are treated as historical, not current.

---

## 1. Gate

> ### CONDITIONAL — not cleared for implementation.

**Exact reason:** every provider re-examined either (a) forbids the intended use outright under its current
published terms, or (b) permits it only after a specific non-engineering action by a human — an operator
approval email, a paid subscription, or a written licence. No provider examined grants, under terms readable
today and without further permission, the right for Signalwatch to poll a geographic area on a schedule,
normalize and cache the result, and display it publicly.

The blocker is **rights and access authorization, not technical feasibility**. The query models, field sets and
freshness semantics needed for a useful Aircraft layer are documented and adequate (§3, §5). What is missing is
permission.

Per the Phase 7 rule, nothing in the application changed: no Aircraft layer, no provider adapter, no fixtures,
the registry status for `aircraft` stays `planned`, and the Global Layer Engine architecture is untouched.

### What would move this to READY

Any *one* of the following, evidenced in writing and recorded in this file:

1. **ADSB.lol** — a reply from the operator (`info [at] adsb.lol`) that confirms: (i) production/public display
   by Signalwatch is acceptable; (ii) an acceptable polling cadence and request budget; (iii) how the ODbL
   applies to Signalwatch's normalization and short-lived server cache (Produced Work vs Derivative Database);
   (iv) the required `User-Agent`/contact header format; and (v) whether the hosting egress used by the
   deployed API server is subject to the throttling described in §2.1. Plus a decision on what happens when the
   announced feeder-linked API key becomes mandatory.
2. **FlightAware AeroAPI Standard tier or above** — an active paid account, an accepted budget for per-result-set
   query fees at the intended polling cadence, and confirmation that the intended public map display falls
   within the tier's "storage and distribution of derivative works for business or business-to-consumer
   purposes" grant.
3. **ADS-B Exchange** — a commercial agreement *plus* advance written authorization under AUP §6.9, which
   otherwise prohibits publishing, transmitting, broadcasting or distributing data acquired from the service.

Until one of those exists, aircraft remain a **planned** layer with no source, visually and semantically
distinct from operational layers.

**Prepared, unsent follow-ups (added after the gate was recorded):**

- `research/adsblol-operator-inquiry.md` — a drafted, **unsent** technical inquiry to the ADSB.lol operator
  covering all nine open permissions and semantics questions, with a map from each answer to the blocker it
  clears. ADSB.lol is the first door because its own documentation invites production users to make contact.
- `research/flightaware-cost-envelope.md` — the AeroAPI query and cost envelope worked out from published
  pricing. Conclusion: the rights story is the cleanest of any candidate, but per-result-set billing (one set
  = 15 records, $0.050 for a search) makes a continuously-polled live map structurally unaffordable; $100/month
  buys roughly one poll every 21 minutes for a single near-empty viewport. It is a fallback and a candidate for
  user-initiated enrichment, not a base layer.
- `research/aircraft-free-path-addendum.md` — the free-path revision. The paid tier is not the answer; the open
  networks ask for reciprocity or discretion instead of money. **ADSBHub**'s published terms grant, in writing
  and unconditionally, the right to publish the data ("There are no restrictions on how the users will use the
  data"), at the price of feeding at least one station and consuming a raw TCP/SBS stream. **ADSB IQ** offers
  the best technical contract found (native `/v2/bbox`, WebSocket push, a published OpenAPI 3.1 file) and a
  grant covering personal, research and commercial projects short of republishing the feed in its entirety —
  subject to two unresolved contradictions between its docs and its Terms. The remaining blocker is three
  emails and possibly one ~$30–50 receiver, not a subscription.

---

## 2. Provider matrix

Fields are reported only where the provider's own documentation states them. `UNRESOLVED` means the source
material does not establish the answer; it is never filled in by inference from a different provider.

### 2.1 ADSB.lol

| Dimension | Finding | Evidence |
|---|---|---|
| Access / auth | No key today. OpenAPI info block: "You can use the API for free. In the future, you will require an API key which you can get by feeding to adsb.lol. If you want to use the API for production purposes, please contact me so I do not break your application by accident." | `https://api.adsb.lol/api/openapi.json` (OpenAPI 3.1.0, version 0.0.2) |
| Access / auth | Docs page states only: "License: ODbL 1.0. The API is available to everyone." No terms-of-service document beyond this and the OpenAPI info block. | `https://www.adsb.lol/docs/open-data/api/` |
| Geo restrictions | None documented. **Egress-based throttling is documented by third parties**: requests from Cloudflare Workers receive HTTP 429 even on the first request, and a generic/omitted `User-Agent` receives `403 User-Agent too generic; include valid contact info.` | `adsblol/website` issue #272; `wiedehopf/tar1090` issue #469 (both Sept 2026) |
| Query model | `GET /v2/point/{lat}/{lon}/{radius}` and alias `GET /v2/lat/{lat}/lon/{lon}/dist/{radius}`. `lat` ∈ [-90,90], `lon` ∈ [-180,180], `radius` integer ∈ [0,250] **nautical miles**. Circle only — no bounding box, no worldwide endpoint. | OpenAPI paths |
| Query model | `GET /v2/closest/{lat}/{lon}/{radius}` (single aircraft); non-spatial filters `/v2/mil`, `/v2/pia`, `/v2/ladd`, `/v2/sqk/{squawk}`, `/v2/type/{t}`, `/v2/reg/{r}`, `/v2/hex/{h}`, `/v2/callsign/{c}`. | OpenAPI paths |
| Server-side filtering | Spatial radius, squawk, type, registration, hex, callsign, military/LADD/PIA flags — each as a *separate endpoint*, not composable with the radius query. No altitude/speed filter. No pagination parameters. | OpenAPI paths |
| Response size | No documented cap in the OpenAPI. `UNRESOLVED` (a 250 NM circle over dense airspace is potentially thousands of records; cannot be measured without egress). | — |
| Rate limits | "Rate limits are dynamic based on the environment load. If you get 4xx errors, you are doing something wrong." **No numeric quota, burst allowance, or acceptable polling interval is published.** | `https://raw.githubusercontent.com/adsblol/api/main/README.md` |
| Coverage | Volunteer feeder network. No coverage guarantee, no per-region statement. `UNRESOLVED`. | — |
| Fields — identity | `hex` (string, required), `flight` (callsign, nullable), `r` (registration, nullable), `t` (ICAO type code, nullable), `category` (nullable) | OpenAPI `V2Response_AcItem` |
| Fields — position | `lat`, `lon` (both nullable numbers) | same |
| Fields — altitude | `alt_baro` (integer **or string** — the string case carries `"ground"`), `alt_geom` (integer, nullable) | same |
| Fields — motion | `gs` (ground speed, nullable), `track` (nullable), `true_heading` (nullable), `nav_heading` (nullable), `baro_rate` (nullable), `geom_rate` (nullable), `ias` (nullable) | same |
| Fields — squawk / status | `squawk` (string, nullable), `emergency` (string, nullable), `alert` (int, nullable), `spi` (int, nullable) | same |
| Fields — military / special | `dbFlags` (integer bitfield, nullable) plus the dedicated `/v2/mil`, `/v2/ladd`, `/v2/pia` endpoints. The *meaning of individual `dbFlags` bits is not documented in the OpenAPI* — `UNRESOLVED`. Military status must not be inferred from any other field. | same |
| Fields — source flags | `mlat` (array of strings — which fields are MLAT-derived), `tisb` (array of strings), `rssi` (number), `messages` (integer), `type` (string — the *reception* type, e.g. `adsb_icao`, not the aircraft type) | same |
| Freshness | `seen` (number, **required**) and `seen_pos` (number, nullable). The OpenAPI gives no units, no epoch, and no stale threshold. By readsb/ADSBExchange-v2 convention these are *seconds since last message / last position message*, and the README states the API is "a drop-in replacement" for the ADSBExchange v2 API — but ADSB.lol's own documentation never states the unit. **Treated as `UNRESOLVED` and must be confirmed with the operator before any staleness rule is written.** There is no absolute response timestamp in the item schema. | OpenAPI; README |
| Terms — API access | Free now; contact requested for production; future key gated on feeding. | OpenAPI info |
| Terms — data use | ODbL 1.0 ("the same license OpenStreetMap uses") for the API and all public data. | OpenAPI `license`; docs page |
| Terms — public display | Not addressed by any first-party document. ODbL permits public use of a Produced Work with notice; whether Signalwatch's map is a Produced Work only, or also creates a Derivative Database via normalization + cache, is **UNRESOLVED**. | ODbL 1.0 §4.2–4.5 |
| Terms — redistribution | Governed by ODbL share-alike if a Derivative Database is created and publicly used. Unclassified for this app. `UNRESOLVED`. | — |
| Terms — derived data | Same. `UNRESOLVED`. | — |
| Verdict | **Closest to usable; not cleared.** Technically the best fit (bounded circle, rich fields, no key). Gated on operator confirmation of production use, cadence, header requirements, egress throttling, and ODbL classification. | — |

### 2.2 OpenSky Network — **materially changed since the previous research**

The earlier report could not read OpenSky's terms and left them open. They are readable now and they close the
question against this use.

| Dimension | Finding | Evidence |
|---|---|---|
| Terms — API access | "**Operational REST API use:** Use of the REST API in any operational capacity — including integration into a live product, service, or automated system (even if only internal) — requires a previous written agreement, even for non-profit or governmental entities." | `https://opensky-network.org/about/terms-of-use` (tl;dr box, and §3(vi)) |
| Terms — data use | §1: licence granted "solely for the purpose of non-profit research and non-profit education". Any use by a for-profit or commercial entity requires a written licence. | same |
| Terms — redistribution | §3(iii): "You will not distribute, disclose, transfer or otherwise make available the data set(s) to any person other than those employed by your institute…" | same |
| Terms — public display | §4(i) requires citation for publications; §3(iii) forbids making data available to others. A public map is not covered by the default grant. | same |
| Terms — retention | §4(ii): expunge all copies upon completion/termination of the stated research. | same |
| Auth | OAuth2 client-credentials only; basic auth removed. Tokens expire after 30 minutes. | `https://openskynetwork.github.io/opensky-api/rest.html` |
| Query model | `GET /states/all` with `lamin/lomin/lamax/lomax` bounding box (WGS-84), optional `time`, repeatable `icao24`, `extended=1` for category. Bounding box — the natural viewport fit. | same |
| Fields | Positional array of 18: `icao24`, `callsign`, `origin_country`, `time_position`, `last_contact`, `longitude`, `latitude`, `baro_altitude` (m), `on_ground`, `velocity` (m/s), `true_track`, `vertical_rate` (m/s), `sensors`, `geo_altitude` (m), `squawk`, `spi`, `position_source` (0 ADS-B / 1 ASTERIX / 2 MLAT / 3 FLARM), `category` (0–20). | same |
| Freshness | Explicit and well-defined: `time_position` = Unix seconds of last position update, **null if no position report within the past 15 s**; `last_contact` = Unix seconds of last message of any kind; response-level `time` = the instant the vectors describe. No registration field. No military flag. | same |
| Verdict | **BLOCKED.** Best-documented freshness semantics and the only native bounding-box query, but its current terms explicitly prohibit operational use in a live product without a prior written agreement, and prohibit making the data available to third parties. Do not integrate. | — |

### 2.3 ADS-B Exchange

| Dimension | Finding | Evidence |
|---|---|---|
| Access / auth | Commercial. The product site now presents four subscription products and a "Request a tour" sales path; there is no self-serve signup on that page. Key header discrepancy from the previous pass (`x-api-key` in the OpenAPI vs `api-auth` in the sample) is **still UNRESOLVED** and must be confirmed with the provider. | `https://www.adsbexchange.com/data-products/` |
| Query model | `GET /api/aircraft/v2/lat/{lat}/lon/{lon}/dist/{dist}` (and an above-altitude variant) — radius in nautical miles. | published v2 OpenAPI |
| Freshness claim | Product page: live positions "refreshing every 250ms". This is marketing copy for the streaming product, not an API SLA. | `data-products/` |
| Terms — redistribution / public display | AUP §6.9: Customer shall not "Publish, resell, transmit, broadcast, distribute the Services or data acquired from the Services. Unless authorized by Company in advance in writing…". §6.2 also forbids operating a service-bureau/SaaS offering; §6.3 forbids derivative works based on any part of the Services. | `https://www.adsbexchange.com/acceptable-use-policy/` |
| Verdict | **BLOCKED without a contract *and* separate advance written authorization.** A public Signalwatch map is squarely within the §6.9 prohibition. | — |

### 2.4 FlightAware AeroAPI

| Dimension | Finding | Evidence |
|---|---|---|
| Access / auth | Paid, self-serve signup; API key in `x-apikey` header; base `https://aeroapi.flightaware.com/aeroapi`. Credit card required even for the Personal tier. | FlightAware AeroAPI product + portal documentation |
| Tiers / rights | **Personal:** derivative works "for personal or academic purposes only", up to $5/month free credit ($10 for ADS-B feeders), 10 result sets/minute. **Standard:** $100/month minimum, 5 result sets/second, "storage and distribution of derivative works for business or business-to-consumer purposes". **Premium:** $1,000/month minimum, adds B2B. | `https://www.flightaware.com/commercial/aeroapi/` |
| Query model | `GET /flights/search` with a query DSL supporting `-latlong "minLat minLon maxLat maxLon"` and altitude predicates; also `/flights/search/count` and `/flights/search/positions`. So a bounding-box query does exist. | AeroAPI documentation / OpenAPI spec |
| Cost model | Per-result-set billing. Polling a viewport on a schedule multiplies directly into cost; a result set is capped, so a dense viewport costs several result sets per poll. Exact per-poll cost for `/flights/search` at the intended cadence is **UNRESOLVED** until measured against a real account. | pricing page |
| Terms — public display | The Standard tier's B2C derivative-works grant is the relevant grant and appears to cover a public map, but the binding text is the AeroAPI Terms of Service attached to the account, which was not reviewed in this pass. `UNRESOLVED` pending account signup. | — |
| Verdict | **CONDITIONAL — the cleanest rights story, at a price.** It is the only candidate whose published tier language affirmatively contemplates distributing derived data to consumers. Requires a paid Standard subscription and a budget decision. | — |

### 2.5 adsb.fi — **now resolvable; previously unverified**

| Dimension | Finding | Evidence |
|---|---|---|
| Access / auth | Official open-data API documented at `https://opendata.adsb.fi/api/`, no key for public endpoints. | `https://raw.githubusercontent.com/adsbfi/opendata/main/README.md` |
| Query model | `GET /v3/lat/{lat}/lon/{lon}/dist/{dist}` — radius up to 250 NM. The `v2` lat/lon/dist form is **deprecated**; v3 is required for new integrations. Non-spatial: `/v2/hex`, `/v2/icao`, `/v2/callsign`, `/v2/registration`, `/v2/sqk`, `/v2/mil`. Feeder-only `/v2/snapshot` (all aircraft, refreshed twice a minute). | same |
| Rate limits | **Published and numeric:** public endpoints 1 request/second; feeder endpoint 1 request/30 s. 400/401/403/404/429 responses count toward the limit; excessive invalid requests cause a temporary IP restriction. | same |
| Fields | "Endpoints and responses are compatible with ADSBexchange v2 API" — i.e. the same shape as §2.1, but adsb.fi publishes no field schema of its own, so the exact field set is **UNRESOLVED**. | same |
| Terms | "adsb.fi open data is **for personal, non-commercial use only**. You may not license, sell, rent, or lease any part of the data or the service… You must cite adsb.fi and include a link to our home page." Contact them for commercial or higher-rate requirements. | same |
| Verdict | **BLOCKED for this use.** A publicly reachable Signalwatch map is not "personal use", regardless of whether it is commercial. Would require the contact path they offer. | — |

### 2.6 Airplanes.live

| Dimension | Finding | Evidence |
|---|---|---|
| Access / auth | An official Stoplight-rendered API reference exists (v2.0.0, production server `https://api.airplanes.live`) listing `GET /v2/point/{lat}/{lon}/{radius}`, `/v2/hex/{hex}` (+ `/live`, `/last`), `/v2/reg`, `/v2/callsign`, `/v2/squawk`, `/v2/mil`, `/feed/status`, and reference data (airports, airlines, countries, cities, timezones). Schemas `Aircraft` and `V2Response` are published. | `https://airplanes.live/api-docs/` |
| Terms | **`https://airplanes.live/terms/` and `https://airplanes.live/api-guide/` both return 404 today.** The `Apache-2.0` marker on the docs page applies to the API *specification document*, not the data. Third-party projects report the API is "educational and non-commercial use only", citing the now-missing `/api-guide/`. That is hearsay and is **not** accepted as the provider contract. | fetched 2026-09-30 |
| Access history | The previous pass recorded a 403 from the API root instructing the caller to contact the provider with project links and a description. | `research/sources/airplanes-live-*` |
| Rate limits / fields / freshness | Not established in this pass (schema detail is behind the Stoplight client-side renderer). `UNRESOLVED`. | — |
| Prior-generation API | The ADSB One API (`api.adsb.one`, 1 request/second) that airplanes.live previously fronted was **archived read-only on 2026-04-29**. It must not be used as the current contract. | `github.com/airplanes-live/api-archive` |
| Verdict | **UNRESOLVED — cannot be selected.** A documented API with no readable terms is not a usable provider. Requires the operator's written access terms. | — |

### 2.7 FAA SWIM

| Dimension | Finding | Evidence |
|---|---|---|
| Nature | "A single point of access for near real-time, relevant, and reliable aeronautical, flight, weather, and surveillance information" across the U.S. National Airspace System. Capabilities are named services (STDDS, SFDPS, CSS-FD) with Identity and Access Management, governance and service-level management. | `https://www.faa.gov/air_traffic/technology/swim` |
| Access | Onboarding via "Get Connected"; the SWIFT portal uses Solace JMS messaging, not an anonymous REST feed. Requires enrolment and, for some services, FAA review. | same |
| Coverage | U.S. NAS only — cannot serve a global layer. | same |
| Verdict | **Not a candidate for this layer.** A messaging-bus integration scoped to one country, not a worldwide viewport query API. Could become relevant later as a U.S.-specific enrichment source, under its own gate. | — |

---

## 3. Minimum useful aircraft observation contract (design only — not implemented)

Derived from the intersection of what ADSB.lol and AeroAPI actually supply (the two candidates with a path to
READY), and constrained to what a Signalwatch observation genuinely needs. No field is included for visual
flourish.

**Required — an observation is rejected if any is missing:**

| Field | Type | Source (ADSB.lol) | Notes |
|---|---|---|---|
| `id` | string | `hex` | ICAO 24-bit address, lowercased. Stable dedup key. |
| `latitude` | number | `lat` | Records with null `lat`/`lon` are dropped, not rendered at 0,0. |
| `longitude` | number | `lon` | |
| `observedAt` | ISO-8601 string | derived: request completion time minus `seen_pos` seconds | **Only computable once the `seen_pos` unit is confirmed (§2.1).** Until then this field cannot be produced honestly, which is itself part of the gate. |

**Optional — rendered only when present, never defaulted:**

| Field | Type | Source | Notes |
|---|---|---|---|
| `callsign` | string \| null | `flight`, trimmed | Frequently padded with spaces. |
| `registration` | string \| null | `r` | Absent from OpenSky entirely. |
| `aircraftType` | string \| null | `t` | ICAO type designator. |
| `altitudeFt` | number \| null | `alt_baro` when numeric | When `alt_baro === "ground"`, set `onGround = true` and leave altitude null. |
| `onGround` | boolean \| null | `alt_baro === "ground"` | |
| `groundSpeedKt` | number \| null | `gs` | |
| `trackDeg` | number \| null | `track` | Ground track. Not interchangeable with `true_heading`. |
| `verticalRateFpm` | number \| null | `baro_rate` ?? `geom_rate` | Record which one was used. |
| `squawk` | string \| null | `squawk` | |
| `positionSource` | enum \| null | from `mlat`/`tisb` arrays and `type` | `adsb` \| `mlat` \| `tisb` \| `other`. Affects trustworthiness of the position. |
| `staleSeconds` | number \| null | `seen_pos` | Carried through verbatim so the UI can show age rather than implying live-ness. |

**Deliberately excluded until separately justified:**

- `military` / `emergency` badges. ADSB.lol exposes `dbFlags` and an `emergency` string, but the bit meanings are
  undocumented and `emergency` values are unenumerated. Mislabelling an aircraft as military or in distress is a
  worse failure than omitting the label. Requires documented semantics first.
- Flight routes, origin/destination, operator. Not supplied by the position API; the community route sources
  carry their own separate restrictions.
- Trails/history. Requires retention, which is exactly the ODbL Derivative Database question that is unresolved.

**Presentation rule:** every aircraft observation surfaces its `staleSeconds`/`observedAt`, and the layer carries
the provider attribution string mandated by that provider's licence. An aircraft older than the configured
staleness threshold is dropped, not dimmed — a stale position on a live map is misinformation.

---

## 4. Viewport-driven spatial strategy (investigated, not implemented)

Findings, so the work is not redone later. **Not adopted; no code written.**

1. **Query-shape mismatch.** Signalwatch's map gives a bounding box and the globe gives a camera viewpoint, but
   every open candidate except OpenSky offers only a *circle*. The adapter would therefore need a
   viewport → circumscribing circle conversion (centre = viewport centre, radius = centre-to-corner great-circle
   distance, clamped to 250 NM), then a client-side rejection pass to discard results outside the true viewport.
   This over-fetches by up to ~57 % in area for a square viewport — acceptable, but it makes the unpublished
   response-size cap (§2.1) a real risk.
2. **Zoomed-out views are not servable.** At a 250 NM cap, a continental or globe-level view cannot be covered by
   one query, and tiling it into dozens of circles is exactly the behaviour an unpublished dynamic rate limit is
   designed to punish. The only defensible design is: **above a zoom threshold, the aircraft layer reports
   "zoom in to load aircraft" rather than showing a partial sample presented as complete.** A partially-tiled
   world would be indistinguishable from a sparse sky, which violates the project's honesty rule.
3. **Cadence must be server-side and shared.** Browsers must never call the provider directly (it would leak the
   user's IP into the provider's rate bucket, defeat the required contact `User-Agent`, and multiply requests by
   the number of visitors). The API server polls; all clients read the server's cached snapshot. This matches the
   existing `createMemoryCachedCameraProvider` pattern and is the reason that pattern is already generic.
4. **Rate budget.** With no published numeric limit for ADSB.lol, the only safe posture is a fixed, low,
   *provider-confirmed* cadence — the comparable public projects found in the wild settle near one request per
   10–20 seconds for a whole site, with a contact-bearing `User-Agent` and no retry storms (exponential backoff
   to several minutes). adsb.fi's published 1 req/s is the only hard number available from any open provider,
   and it is for an endpoint we may not use.
5. **Spatial partitioning.** A quantized query grid (snap the circle centre to a coarse lattice, e.g. 1°) makes
   the cache key stable across small pans, so panning does not generate a new upstream request per frame. This is
   the single highest-value technique identified and would be the first thing to build if the gate clears.
6. **Dedup and staleness.** Key on ICAO hex; when two overlapping queries return the same aircraft, keep the
   record with the smaller `seen_pos`. Drop anything past the staleness threshold at read time, not just at fetch
   time, so a frozen upstream degrades to an empty layer rather than a fossilised one.
7. **Unresolved before any of this is built:** the `seen_pos` unit (§2.1), the response-size cap, and whether the
   deployment's egress IP range is throttled. Two of the three are unmeasurable from this sandbox.

**Nothing here is unambiguous enough to implement**, and the rights gate is unresolved regardless, so per the
Phase 5 instruction no implementation followed.

---

## 5. Already-generic pieces (relevant if the gate later clears)

For estimation only — these need no change to support aircraft:

- The layer registry's three-part split (`LayerDefinition` / runtime state / observations) and the
  `capabilities` + `display` driven shared UI.
- The per-layer sampling config with selected-record retention.
- `createMemoryCachedCameraProvider`'s status model (`available` / `stale` / `unavailable`, cached-value
  retention on failure, separate retry TTL) — the shape a polling aircraft provider needs, though it is currently
  camera-typed and would need generalizing or mirroring.
- `Promise.allSettled` registry fan-out with synthesized failure status.
- The single explicit hook invocation per layer source in `useGlobalLayerData()`.

What would be new: a viewport→query translator, a query-grid cache keyed by quantized circle, an aircraft
observation type and normalizer, the provider adapter, an OpenAPI path + regenerated clients, and marker/inspector
presentation. No implementation plan is written here because the gate is not READY.

---

## 6. Open questions carried forward

1. ADSB.lol: units and epoch of `seen` / `seen_pos`. **Blocks the `observedAt` contract field.**
2. ADSB.lol: meaning of `dbFlags` bits. **Blocks any military/special-status display.**
3. ADSB.lol: maximum response size / aircraft count for a 250 NM circle.
4. ADSB.lol: acceptable production cadence, required `User-Agent` contact format, and whether the deployment
   egress is in a throttled range.
5. ADSB.lol / ODbL: does normalization + a short-lived server cache create a Derivative Database, or only a
   Produced Work?
6. ADSB.lol: timing and eligibility for the announced feeder-linked API key.
7. Airplanes.live: current written access terms (site pages 404).
8. ADS-B Exchange: correct auth header (`x-api-key` vs `api-auth`), and current self-serve availability.
9. FlightAware: real per-poll cost of `/flights/search -latlong` at the intended cadence, and the binding AeroAPI
   ToS text behind account signup.
10. All: live reachability from the deployed API server's egress — untestable in this sandbox.

---

## Process notes

- **Branch:** the requested `arena/signalwatch-aircraft-provider` was not created. This session is fixed to
  `arena/01a0f054-globalinsitehub`; work on any other branch would not be tracked. All Phase C output is on the
  pinned branch, on top of the Phase B baseline (`bdd8450`).
- **No live probes** were possible (no sandbox egress). Documentation evidence only.
- The two findings that changed the picture versus the previous research are **OpenSky** (terms now readable and
  prohibitive) and **adsb.fi** (official API and terms now readable, personal-use-only). Neither reversal was
  made to favour a convenient provider; both narrow the options.
