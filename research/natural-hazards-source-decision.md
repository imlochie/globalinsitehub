# Natural hazards — source decision record

Status: **IMPLEMENTED (operational)**. Recorded 2026-09-30.

This record is the licensing and feasibility evidence behind the Natural
Hazards global layer. It follows the same standard as the maritime record: a
source is only implemented once access, permission, attribution, redistribution
and zero-cost status are each established from a first-party page.

---

## 1. Boundary: Natural Hazards vs Public Events

**Natural Hazards** = structured hazard observations published by
hazard-oriented data sources, with their own identifiers, coordinates,
timestamps and source-assigned categories.

**Public Events** = general public-source reporting (news feeds).

Rules applied:

- A hazard type is **always** the category the source assigned. It is never
  inferred from a headline or a title. A test asserts this using an EONET event
  titled "Earthquake swarm near volcano" that is classified as `Volcanoes`.
- A news story that mentions an earthquake is a **public event**, not a hazard
  record. It is not duplicated into the hazards layer.
- Only the categories the sources actually supply are represented. No category
  is declared that has no source behind it.

### Material consequence: the public-events map layer

USGS and NASA EONET were already being fetched by
`artifacts/api-server/src/routes/monitoring.ts`, and the briefing's `events`
array (`[...earthquakes, ...nasaEvents]`) was the **entire** source of the
`public-events` map layer. Every "public event" marker on the map was in fact a
hazard record.

Cleanly separating the layers therefore has a real cost, which is stated here
rather than hidden:

- The briefing API response is unchanged — the written briefing still lists
  these events, because that is a reporting surface, not a map layer.
- The **public-events map layer** now filters them out by stable provider id
  prefix (`usgs-`, `eonet-`), so they render once, under Natural Hazards.
- The remaining public-event sources are four news RSS feeds, and **RSS
  headlines carry no coordinates**. So the public-events *map layer* currently
  has no mappable records of its own.

This is an honest reflection of the data Signalwatch actually has. It is not
papered over by leaving hazard records double-rendered. Restoring mappable
public events requires a geolocated non-hazard public source; that is open work,
not something this layer should fake.

---

## 2. Source audit

### 2.1 USGS Earthquake Hazards Program — ACCEPTED

| Question | Finding |
| --- | --- |
| Endpoint | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` |
| Access | Public HTTPS GeoJSON. No key, no account, no registration. |
| Licence | "USGS-authored or produced data and information are considered to be in the U.S. Public Domain and can be freely used without permission. All we ask is that you acknowledge the USGS as the source." |
| Attribution | `Credit: U.S. Geological Survey` (a suggested credit line from the same policy). The trademarked USGS identifier/logo is **not** used. |
| Public display | Permitted — public domain. |
| Redistribution | Permitted without further permission. |
| Freshness | The feed documentation states summary feeds are "Updated every minute." |
| Coverage | Worldwide, **magnitude 2.5 and above, past 24 hours**. Global reach, bounded completeness. |
| Rate limits | None published for the static summary feeds. Signalwatch fetches once per 60 s regardless of user count. |
| Cost | $0. No tier, no metering, no account that could later be billed. |

Caveat recorded: the "Feed Life Cycle Policy" link on the USGS GeoJSON page
(`/earthquakes/feed/policy.php`) returns **404**, so no deprecation-policy
commitment could be read. This does not block use of a public-domain feed, but
it means the feed's lifecycle guarantees are **UNRESOLVED**.

Fields consumed: `id`, `properties.time` (origin time), `properties.updated`,
`properties.mag` + `properties.magType`, `properties.status` (review state),
`properties.place`, `properties.title`, `properties.type`, `properties.url`,
and `geometry.coordinates = [lon, lat, depth_km]`.

Note: the previous briefing parser **discarded depth, magType and review
status**. The hazard layer preserves all three.

### 2.2 NASA EONET v3 — ACCEPTED

| Question | Finding |
| --- | --- |
| Endpoint | `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60` |
| Access | Public HTTPS JSON. **No API key** (unlike `api.nasa.gov`). |
| Licence | NASA ESDIS Data Use guidance: ESDIS content "is generally not copyrighted"; "NASA should be acknowledged as the source of the material"; unless marked otherwise, data from a NASA-led mission is licensed **CC0**. |
| Attribution | `Source: NASA Earth Observatory Natural Event Tracker (EONET)` |
| Public display | Permitted for informational purposes without explicit permission, provided use is factual and does not imply NASA endorsement. Signalwatch makes no endorsement claim. |
| Redistribution | "If not copyrighted, NASA material may be reproduced and distributed without further permission from NASA." |
| Freshness | Event-driven, not periodic. Geometry entries carry their own date; EONET notes the time "will most likely be 00:00Z unless the source provided a particular time", so day-level precision must be assumed. |
| Coverage | Worldwide, but a **curated tracker, not an exhaustive census**. This request is bounded to 60 open events. |
| Rate limits | None published. Signalwatch fetches once per 60 s via the shared cache. |
| Cost | $0. |

**NASA's disclaimer is carried into the product verbatim in substance** — it
appears in the hazard inspector for every EONET record:

> All EONET metadata and services are intended to be used for visualization and
> general information purposes only and should not be construed as "official"
> with regards to spatial or temporal extent … often these representations are
> approximations at best.

Fields consumed: `id`, `title`, `description`, `closed`, `categories[0].title`,
`sources[0].url`, `link`, and the **latest** `geometry[]` entry's `date`,
`type`, `coordinates`, `magnitudeValue`, `magnitudeUnit`,
`magnitudeDescription`.

Correction found during testing: EONET v3 publishes magnitude on the **geometry
entry**, not on the event. The parser reads the geometry first and only falls
back to the event level. This was caught by a test built from the documented
payload shape.

### 2.3 Sources considered and NOT implemented

- **GDACS, Copernicus EMS, ReliefWeb, NOAA/NWS alerts, EMSC** — not audited to
  the standard above in this phase. They are plausible future free additions but
  **no source is implemented merely because its endpoint responds**.
- No paid or freemium hazard provider was evaluated, per the $0 invariant.

---

## 3. Coordinate reliability and timestamp semantics

**Coordinates.** USGS records are true point epicentres. EONET geometries are
`Point` **or** `Polygon`. The previous briefing parser used
`lastCoordinatePair()`, which walked nested arrays and returned the *last*
vertex — for a polygon that is an arbitrary corner, not the event location.

The hazard parser instead computes the arithmetic mean of the polygon vertices
and **marks the record as approximate**, appending to its description:
"Position is the centre of an EONET area geometry, not a precise point." No
synthetic extent is drawn, because Signalwatch cannot currently render one, and
inventing a radius would be fabricated precision.

**Timestamps.** Three distinct times are preserved and never conflated:

| Field | Meaning |
| --- | --- |
| `occurredAt` | When the **source** says the hazard was observed. |
| `updatedAt` | When the source last revised the record (USGS only). |
| `receivedAt` | When the Signalwatch API server received it. |

A test asserts `occurredAt !== receivedAt` for a real-shaped USGS record.

**Current vs historical.** Only stated where source semantics support it. EONET
documents `closed` (null while open), so EONET records carry
`activityStatus: "open" | "closed"` and the inspector says "Source reports event
open/ended". An earthquake is a point in time and USGS publishes no such state,
so USGS records carry `activityStatus: null` and **no activity claim is made**.

**Freshness window.** USGS: rolling 24 hours, magnitude 2.5+, regenerated every
minute. EONET: open events, no fixed window. The server caches upstream for 60 s;
the browser refetches every 180 s with a 120 s stale time.

---

## 4. Severity — deliberately not normalized

`magnitudeValue` is always stored with `magnitudeUnit`. An `mww` 5.1 earthquake
and a 2400-`acres` wildfire are both "magnitudes" in their own source's terms
and are **not** points on one scale. Signalwatch therefore:

- does **not** compute a severity score,
- does **not** rank hazards against each other,
- does **not** fuse USGS and EONET magnitude systems,
- renders one restrained marker style for all hazards, with the type and the
  unit-qualified magnitude shown in the inspector.

The untouched provider record travels with every observation.

---

## 5. Cross-source identity

- Within a source, records are deduplicated by the provider's own identifier.
- Across sources, **nothing is merged**. USGS and EONET publish different event
  universes (EONET has no earthquake category), and no shared identifier exists
  between them. Where two sources describe the same real-world event, both
  records are kept and each carries explicit provenance, rather than being
  fuzzy-merged on title similarity. A test covers this using two identically
  titled records from different sources.

---

## 6. Failure behaviour

Sources are fetched with independent settlement and parsed independently. If one
source fails:

- that source reports `status: "unavailable"` with the reason,
- the other source's hazards are returned unchanged,
- derived coverage reflects only the sources that answered,
- the layer panel shows "Some hazard sources unavailable" (warn), not a healthy
  green state and not an empty map.

If **every** source fails, derived coverage is explicitly
`{scope: "local", regions: [], note: "No hazard source is currently reachable,
so no coverage can be claimed."}` — an empty response is never presented as "no
hazards".

---

## 7. Zero-cost audit

| Cost axis | USGS | NASA EONET |
| --- | --- | --- |
| Provider charge | No | No |
| API key / account | No | No |
| Subscription | No | No |
| Usage-based billing | No | No |
| Free tier that becomes paid at real workload | No | No |
| Contribution / feeder requirement | No | No |
| Hardware requirement | No | No |

Both are public-sector open data with no metering and no commercial
relationship. Signalwatch makes one request per feed per 60 s from the server
regardless of how many browsers are connected, so cost cannot scale with usage.
**$0 recurring, with no paid upgrade path assumed anywhere in the design.**

---

## 8. Adding another free hazard source

1. Audit it against §2's table first. Do not implement on the strength of a
   working endpoint.
2. Add `artifacts/api-server/src/hazard-sources/<source>.ts` exporting a
   coverage object, a source definition (id, name, attribution, licence,
   licenceUrl, catalogueUrl) and a parser
   `(payload: unknown, receivedAt: Date) => HazardRecord[]`.
3. Add its fetch to `feed-cache.ts` so it is settled independently and shares
   the cache window, then register it in `registry.ts`.
4. Add it to `naturalHazardLayerDefinition.providers` in
   `artifacts/signalwatch/src/lib/layer-registry.ts`.
5. Nothing else changes: the endpoint, normalization, coverage derivation,
   markers, sampling, inspector and panel are all source-agnostic.
6. Add tests for its coordinate validity, identity stability, timestamp
   semantics and independent failure.

---

## 9. Unresolved

- **USGS feed lifecycle policy** — the official policy link 404s, so no
  deprecation guarantee could be verified.
- **Live verification** — see the limitation note in `replit.md`. The sandbox
  egress allowlist blocks both provider hosts, so the contract is verified but
  the layer has **not** been observed carrying real upstream records here.
