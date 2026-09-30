# Maritime Provider Feasibility Gate — Decision Record

**Status: research and documentation only.** No Maritime implementation, no adapter, no normalizer, no
fixtures, no vessel markers, no account created, no hardware purchased, no provider contacted, no dependency
or generated-contract change. `maritime` remains `planned` in the layer registry
(`artifacts/signalwatch/src/lib/layer-registry.ts`, `plannedLayerDefinitions`).

**Branch:** `arena/01a0f054-globalinsitehub`. The requested `arena/signalwatch-maritime-provider` could not be
created — this session is pinned to the branch above and work on any other branch is not tracked. Recorded as
a deviation, history not rewritten. The Replit branch is untouched.

**Date:** 2026-09-30. Methodology follows the Aircraft gate (`research/aircraft-provider-decision.md`):
permissions are quoted verbatim when they are the deciding evidence, and anything unproven is `UNRESOLVED`.

**Environment caveat:** this sandbox has no outbound egress. No endpoint was probed live. All evidence is
first-party documentation read through the research tooling on the date above.

---

## 1. Gate

> ### CONDITIONAL

**As specified — a *global* maritime layer — Maritime is not cleared.** The two providers with genuinely
global coverage each fail a non-technical condition:

- **AISStream** publishes **no terms of service at all**. `/terms` does not resolve to a licence, and there
  is a visible queue of unanswered written-permission requests from other companies asking the same
  questions we would ask (§3.2). An API with no licence grant cannot be adopted, exactly as with
  Airplanes.live in the Aircraft gate.
- **AISHub** requires a receiver meeting quality thresholds, and its published terms grant contributors the
  right to **use** the aggregated data — they do not state a public-display or redistribution right (§3.1).
  That gap is decisive and is `UNRESOLVED`.

**However — and this is materially better than the Aircraft outcome — two government sources are fully
cleared on rights today, with no reciprocity, no hardware, and no permission request:**

| | Licence | Registration | Coverage |
|---|---|---|---|
| **Fintraffic / Digitraffic (Finland)** | **CC BY 4.0** — explicitly permits distribution, remixing and commercial use with attribution | none | Finnish waterways |
| **Kystverket / BarentsWatch (Norway)** | **NLOD 2.0** — free and universally accessible open government data | free account, OAuth2 client credentials | Norwegian EZ + Svalbard + Jan Mayen, incl. satellite AIS |

So the honest position is: **Signalwatch can legally and freely show real vessels today, but only in Nordic
waters.** The gate is CONDITIONAL because the layer as specified is global and no free global path has
documented display rights. If the scope is deliberately changed to a regional, clearly-labelled layer, the
rights condition for that scope is already satisfied — see §9 for the scope decision this hands back.

**What would move the global layer to READY:** a written statement from AISHub that contributors may publicly
display and redistribute derived vessel positions (a third party reports holding exactly such a statement —
§3.1), **or** AISStream publishing terms, **or** enough regional open-data feeds to cover the intended area
honestly.

---

## 2. Decision model

Per the Aircraft gate, a provider is viable only when all six hold together:

```
permission + reciprocity/access + deployment topology + freshness + coverage + query model
```

| Provider | Permission | Reciprocity | Deployment | Freshness | Coverage | Query model |
|---|---|---|---|---|---|---|
| Fintraffic Digitraffic | ✅ CC BY 4.0 | none | ✅ any host | ✅ explicit timestamps | ⚠️ Finland only | ✅ REST + MQTT |
| Kystverket / BarentsWatch | ✅ NLOD 2.0 | none | ✅ any host (OAuth2) | ✅ documented | ⚠️ Norwegian EZ | ✅ REST + stream |
| AISHub | ❌ use granted, display `UNRESOLVED` | **receiver + quality bar** | ⚠️ `UNRESOLVED` (IP binding) | ✅ unix timestamp + `interval` | ✅ global aggregate | ✅ bbox webservice |
| AISStream | ❌ **no terms published** | free key | ✅ server-side by design | ⚠️ receipt-time only | ✅ global aggregate | ✅ bbox WebSocket |
| Danish DMA | ✅ free download | none | n/a | ❌ historical only | Danish waters | ❌ CSV archives |

No ranking is offered. Two rows satisfy every column except global coverage; two rows fail the permission
column outright.

---

## 3. Provider findings

### 3.1 AISHub — global aggregator, contributor network, decisive permission gap

**Access and reciprocity** (`https://www.aishub.net/join-us`, read 2026-09-30) — verbatim:

```
- Every AISHub contributor is required to provide at least one raw AIS feed in NMEA format.
- Contributors who apply for API access to the aggregated AISHub feed must meet the following
  quality requirements for their AIS data feed:
  - Coverage of at least 10 vessels (average over the last 7 days)
  - At least 90% uptime (average over the last 7 days)
  - Maximum downsampling rate of 60 seconds
  - Maximum delay of 10 seconds for AIS messages
- The following AIS feeds are strictly prohibited:
  - Synthesized or artificially generated NMEA data
  - Scraped or stolen data
  - Data from publicly available AIS sources or services
- All contributors are allowed to use the aggregated data for free.
```

Also: "AISHub is a contributor-based network. Applications without an operational AIS station and feed will
not be approved." Contribution is by **UDP push of raw NMEA to a dedicated port**, issued by email after an
application; the API key follows once the feed meets the quality bar.

**This is a harder reciprocity bar than any aircraft network.** ADSBHub asks only that you feed. AISHub asks
that you feed *at a measured standard*: ≥10 vessels averaged over 7 days, ≥90 % uptime, ≤60 s downsampling,
≤10 s delay. An inland or poorly-sited receiver may never qualify, and a coastal location is effectively
required. The prohibition on "data from publicly available AIS sources or services" also forecloses the
tempting shortcut of re-feeding Norwegian or Finnish open data back into AISHub.

**The permission gap.** The granted right is to *use* the aggregated data for free. The terms say nothing
about public display, redistribution, derived data, caching or commercial use. **Do not read "use" as
"publish"** — that is precisely the inference this project forbids. `UNRESOLVED`.

A third-party aggregator (`openwaters.io/ais`) states that *"AISHub has confirmed in writing that there are
no restrictions on use, including commercial use and redistribution. Credit 'AISHub' and carry it through if
you redistribute."* That is **hearsay about a private communication**, not a first-party term, and is
recorded here only as a lead: it suggests a direct request would likely succeed, and that "AISHub" is the
attribution string they expect. It is not evidence of a grant to Signalwatch.

**Query model** (`https://www.aishub.net/api`) — a single webservice, clean and well-suited to a viewport:

```
https://data.aishub.net/ws.php?username=…&format=1&output=json&compress=2
    &latmin=…&latmax=…&lonmin=…&lonmax=…&mmsi=…&imo=…&interval=…
```

- **Native bounding box** via `latmin/latmax/lonmin/lonmax`, defaulting to the whole world.
- `interval` = "the maximum age of the returned positions (in minutes)" — **server-side staleness filtering,
  which no other candidate offers.** This is a notably good fit for an honest freshness model.
- Optional MMSI/IMO filters; XML, JSON or CSV; ZIP/GZIP/BZIP2 compression.
- **Rate limit, verbatim:** *"NOTE! Don't access the webservice more frequently than once per minute! The web
  service will return nothing if executed more frequently!"* One request per minute — comfortably enough for
  a single shared server-side poller, and a hard ceiling on any per-viewport design.

**Fields** (human-readable format `B=1`): `MMSI`, `TIME` (unix or UTC), `LATITUDE`, `LONGITUDE`, `COG`, `SOG`,
`HEADING`, `ROT`, `NAVSTAT`, `IMO`, `NAME`, `CALLSIGN`, `TYPE`, `A`/`B`/`C`/`D` (hull dimensions), `DRAUGHT`,
`DEST`, `ETA`, plus `PAC` and `DEVICE` in AIS format. Sentinels are documented and must be honoured:
`COG=360.0`, `SOG=102.4` and `HEADING=511` all mean **not available** — rendering those as real values would
be exactly the kind of fabrication this project forbids.

**Unresolved for AISHub:** public display and redistribution rights; whether the API username/key is bound to
the contributing station's IP or usable from a cloud host; whether a home receiver can serve a remote
Signalwatch backend; what happens to API access when the feed drops below the quality bar; attribution
wording; and actual coverage density in any given sea area.

### 3.2 AISStream — best technical fit, no licence at all

**Technically it is close to ideal for Signalwatch** (`https://aisstream.io/documentation`):

- `wss://stream.aisstream.io/v0/stream`, WebSocket only, no REST.
- **Bounding boxes are required** in the subscription — geography is a first-class concept, not an
  afterthought. Optional `FiltersShipMMSI` (≤200) and `FilterMessageTypes` (25 types).
- Free API key by registration; **no paid tier**.
- The documentation explicitly mandates the architecture we already want: *"The API key belongs in a
  server-side environment variable… **Direct browser connections are not permitted**. Connect from your own
  server and proxy only the information each client needs."*
- Limits: 3 subscribed connections per account, 3 open connections per originating IP, subscription must
  arrive within 3 s, subscription updates ≤1/s (updates **replace**, not merge), messages dropped if the
  client reads too slowly. From September 2026 uncompressed connections face per-user bandwidth limits.
- *"The service currently provides no SLA or uptime guarantee, and events are not durably replayed."*

**And yet it cannot be adopted.** There is no published licence, terms of service, or acceptable-use policy.
`https://aisstream.io/terms` does not serve readable terms. Multiple companies have open, unanswered GitHub
issues on `aisstream/issues` (#289, #299, #306, dated Aug–Sep 2026) asking for written confirmation of
commercial use, public display of positions to their users, and caching — one of them noting that
*"/terms, /terms-of-service and /tos all return 404, and the privacy policy contains no licence grant."*

That is the whole finding. A free, technically excellent, globally-scoped feed whose operator has not stated
what anyone may do with the data, and is visibly not answering when asked. Signalwatch would be adding a
public vessel layer on the strength of an endpoint responding — the exact failure mode the standing rules
forbid. **`UNRESOLVED` → not adoptable.**

### 3.3 Kystverket / BarentsWatch (Norway) — cleared rights, regional coverage

**Licence and access** (`kystverket.no/en/sea-transport-and-ports/ais/access-to-ais-data/`) — verbatim:

> "Everyone can access AIS data from vessels within the Norwegian economic zone and the protection zones off
> Svalbard and Jan Mayen. However, this access does not include data on fishing vessels under 15 metres and
> recreational craft under 45 metres.
>
> The data are free and universally accessible, and are regulated under the Norwegian Licence for Open
> Government Data (NLOD). Access does not require user registration."

NLOD 2.0 is a standard open-government licence permitting copying, distribution, modification and commercial
use with attribution — i.e. **public display and redistribution are granted by the licence itself**, with no
request needed. Raw data is additionally available over TCP at `153.44.253.27:5631`.

**The BarentsWatch Live AIS API** (`developer.barentswatch.no/docs/AIS/live-ais-api/`) is the practical path.
Documented limitations, verbatim:

> - Geographic area within Norwegian economical zone, fiskerivernsonen ved Svalbard and vernesonen ved Jan
>   Mayen
> - No fishing vessels under 15 meters
> - No leisure crafts or sailing vessels under 45 meters
> - No data older than 14 days

Sources include Kystverket terrestrial stations in Norway and Svalbard, Equinor offshore stations, **and
Norwegian satellites** — so offshore coverage is better than a purely terrestrial network.

**Deployment topology is clean:** register a free user, create an API client, then OAuth2 **client
credentials** against `https://id.barentswatch.no/connect/token` with `scope=ais`, and a bearer token on each
request. Nothing is bound to a physical location or IP — a cloud-hosted Signalwatch backend works. This is
the single most deployable candidate found across both the aircraft and maritime gates.

**Note the scope caveat:** the *closed* component (everything else, including small fishing and recreational
vessels) requires an application stating purpose, is mainly granted to public authorities and ports, and
carries an explicit non-distribution condition. Signalwatch must use the **open** component only and must not
conflate the two.

**`UNRESOLVED`:** live endpoint field list and update cadence (the OpenAPI at `live.ais.barentswatch.no`
could not be read from this sandbox), rate limits, and whether the live API is a poll or a stream.

### 3.4 Fintraffic / Digitraffic (Finland) — the cleanest licence found in either gate

**Licence** (`digitraffic.fi/en/terms-of-service`) — verbatim:

> "Fintraffic's open data is licensed under the Creative Commons 4.0 By license. It gives the right to
> **distribute, remix, tweak, and build upon our data, even commercially**, as long as you credit the source
> for the original creation."

Required attribution: *"Source: Fintraffic / digitraffic.fi, license CC 4.0 BY"*, preserving the copyright
notice and disclaimers, linking the licence, and **indicating that changes were made** — which matters here,
because normalizing AIS into a Signalwatch observation *is* a modification and must be declared.

**Access:** no API key, no registration, no reciprocity. Two shapes, both useful:

- **REST:** `https://meri.digitraffic.fi/api/ais/v1/locations` (+ `/api/ais/v1/vessels` metadata).
- **MQTT over WebSocket:** `wss://meri.digitraffic.fi:443/mqtt`, topics `vessels-v2/<mmsi>/locations`,
  `vessels-v2/<mmsi>/metadata`, `vessels-v2/status` with wildcard subscriptions, plus a `status` topic
  reporting when data was last updated in epoch seconds.

**Provider-side filtering that must be disclosed to users** (`digitraffic.fi/en/marine-traffic/ais/`):

- Class A position and metadata messages only.
- **All fishing vessels (type 30) are filtered out.**
- **Vessel types are deliberately coarsened** — 20–29 → 20, 40–49 → 40, 60–69 → 60 (Passenger), 70–79 → 70
  (Cargo), 80–89 → 80 (Tanker), 90–99 → 90 (Other), while 30–39 and 50–59 keep their original values
  (including 35 Military, 50 Pilot, 51 SAR, 55 Law enforcement).

That last point is a genuine honesty constraint: a Signalwatch "cargo/tanker/passenger" label derived from
Digitraffic is a *coarsened provider classification*, not the vessel's own reported subtype, and the
inspector should not imply more precision than the source carries.

**`UNRESOLVED`:** REST update cadence and whether `/locations` supports a bbox parameter (the Swagger at
`meri.digitraffic.fi/swagger/` could not be read from this sandbox); the documented request to send a
`Digitraffic-User` identifying header should be confirmed and honoured.

### 3.5 Danish Maritime Authority — historical only

Free continuously-updated **historical** AIS as zipped CSV at `aisdata.ais.dk`. The live shore-based system is
now under the Danish Emergency Management Agency and no public live feed is documented on the page read.
**Not a candidate for a live layer**; a legitimate free source for any future historical/analysis feature.

### 3.6 Commercial providers

Deliberately not investigated in depth, per the brief and the Aircraft finding that commercial fallbacks
should not dominate a hobby-budget architecture. The open landscape here is *better* than it was for
aircraft, not worse, so there is no need to reach for a paid tier.

---

## 4. Minimum useful vessel observation contract (design only)

Built from fields the cleared providers actually document.

**Required:**

| Field | Type | Source |
|---|---|---|
| `id` | string | MMSI, as a string (never a number — leading zeros are meaningful) |
| `latitude` / `longitude` | number | position report; records without a valid position are dropped |
| `receivedAt` | ISO-8601 | AISHub `TIME`; for streams, our own server receipt time |
| `lastSeen` | ISO-8601 | most recent message for this MMSI |

**Optional — rendered only when present, never defaulted:**

`mmsi`, `imo` (drop when `0` — the AISHub sample shows `IMO="0"` as the not-supplied sentinel), `callsign`,
`vesselName` (≤20 chars, often padded), `vesselType` (raw AIS code **plus the provider that classified it**),
`navStatus` (AIS NAVSTAT code), `courseOverGround` (drop when `360.0`), `speedOverGround` (drop when `102.4`),
`heading` (drop when `511`), `draught`, `destination`, `eta`, `dimensions` (A/B/C/D).

**Explicitly excluded:**

- **Any "military", "dark vessel", "suspicious" or "sanctioned" indicator.** AIS type code 35 means the
  *transmitting vessel self-reported* type 35. That is not an intelligence assessment and must never be
  presented as one.
- Inferred routes or track prediction. `DEST` and `ETA` are **free-text fields typed by the crew**, routinely
  abbreviated, stale or wrong; they may be shown only labelled as *reported by the vessel*, never as fact.
- Flag state derived from the MMSI MID prefix — a reasonable convention, but an inference. Only if a provider
  supplies it.
- Cargo/passenger status beyond the raw type code, and any cross-provider identity enrichment.

**Provenance is mandatory per observation**, not per layer: with multiple regional feeds, each vessel must
carry which source produced it, so the map can answer "why is this area empty?" honestly.

---

## 5. Freshness model

The project rule — *fresh enough → visible; too old → removed; unknown age → not presented as live* —
is achievable here, and maritime is **better** than aircraft on this point:

- **AISHub** supplies an explicit `TIME` (unix epoch or UTC string, unambiguous — unlike ADSB.lol's
  undocumented `seen_pos`) **and** server-side `interval` filtering by maximum position age in minutes. Both
  a real timestamp and a server-side stale filter.
- **Digitraffic** exposes a `status` topic reporting last-update epoch seconds, and AIS messages carry
  timestamps.
- **Stream sources** (Digitraffic MQTT, AISStream) have no provider age field, so the model is the same one
  adopted for a possible ADSBHub path: `receivedAt` = our receipt, `lastSeen` = latest message per MMSI,
  `staleAfter` = explicit configured threshold.

**Maritime staleness is not aircraft staleness.** A moored vessel legitimately reports every 3 minutes, and
Class A transmit intervals range from ~2 s under way to ~3 min at anchor. A 30-second threshold borrowed from
aircraft would erase every anchored ship in a harbour. The threshold must be minutes, and should probably
vary with `NAVSTAT`/`SOG` — stationary vessels tolerate a longer window than one making 20 knots. This needs
a deliberate decision, not a copied constant.

---

## 6. Architecture patterns by provider

| Provider | Implied architecture |
|---|---|
| AISHub | **Polling** — one shared server-side request/minute, bbox + `interval`, cached; fits the existing camera-style shape almost exactly |
| Digitraffic REST | **Polling** — same shape |
| Digitraffic MQTT | **Subscription** — persistent MQTT-over-WebSocket, in-memory vessel state, freshness expiry, viewport filtering |
| AISStream | **Subscription** — persistent WebSocket with bbox subscription, replace-not-merge semantics, reconnect with backoff |
| Kystverket TCP | **Raw stream** — IEC 62320-1 over TCP, parser required |
| BarentsWatch live API | `UNRESOLVED` — poll or stream not established from the docs read |

**The one-per-minute AISHub limit makes per-viewport querying impossible** and forces the shared-snapshot
design we already prefer: one poller, one world (or region) picture, all viewports served from it.

---

## 7. Global coverage — stated plainly

**AIS aggregation is not uniform global visibility, and the layer must never imply that it is.**

- **Terrestrial AIS is line-of-sight**, roughly 20–40 NM from a coastal receiver. Open ocean is invisible to
  terrestrial-only networks. Satellite AIS covers it, and among the free candidates **only BarentsWatch
  documents satellite sources** — for Norwegian waters.
- **Aggregator coverage follows volunteers**, so it is dense near populated coasts (North Sea, Med, US/Japan
  coasts) and thin elsewhere — Southern Ocean, much of the South Atlantic, large stretches of the Indian
  Ocean and African coastline.
- **The cleared sources are explicitly regional**: Finnish waterways; Norwegian EZ plus Svalbard and Jan
  Mayen. Using them is honest only if the map says so.
- **Every free source filters something**: Norway excludes fishing <15 m and leisure/sailing <45 m; Finland
  excludes all fishing vessels and coarsens type codes. An empty patch of sea may mean no coverage, no
  transmitting vessel, or a filtered vessel class — and the UI cannot distinguish those without saying so.

Query support: AISHub and AISStream both take bounding boxes (AISStream *requires* them); Digitraffic MQTT
scopes by MMSI topic rather than geography, so geographic filtering happens on our side. No candidate needs
tiling, because the sensible design is one shared regional/global fetch rather than per-viewport queries.

---

## 8. Free-path / reciprocity analysis

| | What we must contribute | What it unlocks | IP-bound? | If our feeder drops |
|---|---|---|---|---|
| Digitraffic | **nothing** | full open REST + MQTT | no | n/a |
| BarentsWatch | **nothing** (free account) | open AIS live + historic | no — OAuth2 client credentials | n/a |
| AISHub | AIS receiver meeting ≥10 vessels / ≥90 % uptime / ≤60 s downsampling / ≤10 s delay | aggregated global webservice | `UNRESOLVED` | `UNRESOLVED` — presumably access lapses |
| AISStream | free account | global WebSocket | no | n/a |

**The headline result of this gate:** unlike aircraft, **the two best-licensed maritime sources cost nothing
and ask for nothing** — no receiver, no email, no permission. The reciprocity model only appears when you
reach for global coverage.

An AIS receiver is also a poorer investment than an ADS-B one: AIS needs a coastal site with sea view, and
AISHub's measured quality bar means an unlucky location may never qualify. If a receiver is ever bought, it
should be justified by the aircraft case first.

---

## 9. Architecture implications for the Global Layer Engine

Recommendations only; nothing implemented.

1. **The existing `LayerSourceResult` abstraction is sufficient for the cleared path.** Digitraffic REST and
   BarentsWatch are request/response with a cache — the same shape as cameras. Maritime could ship on the
   current architecture without any engine change.
2. **A stream path would need a new primitive**, and it should not be bolted onto the fetch/cache shape. A
   generic `createStreamingProviderRuntime` — persistent connection, in-memory keyed state, freshness expiry,
   reconnect with backoff, and a status model reusing `available`/`stale`/`unavailable` — would serve
   Digitraffic MQTT, AISStream, and a possible ADSBHub aircraft path equally. **That is a real shared need
   across both movement layers**, and it is the strongest argument for building it once, properly, rather
   than per-provider. It should not be built until a provider is actually chosen.
3. **`observedAt` should mean "when the vessel reported this position"** where the provider supplies a
   timestamp, and "when our server received the message" otherwise — and the observation must record *which*
   of the two it is. Never synthesize one from an unknown unit.
4. **Freshness expiry belongs in the provider runtime, not the renderer** — expired records should never
   reach the store, so a frozen upstream degrades to an empty layer rather than a fossilised one.
5. **Viewport filtering should stay a read-side concern** over a server-side regional/global store, given the
   1-request-per-minute ceiling.
6. **Multiple regional feeds can coexist without touching the shared renderer**, provided provenance is
   per-observation (§4) and dedup is keyed on MMSI with a documented precedence rule for the same vessel seen
   by two networks. This is the multi-provider shape worth designing toward — it lets the map show *where
   coverage comes from* instead of implying one network sees the whole ocean.

**Scope decision handed back to the owner.** Two options, both defensible, and this record deliberately does
not choose:

- **(a) Regional-honest now.** Implement Maritime on Digitraffic + BarentsWatch, labelled as Nordic coverage,
  with CC BY / NLOD attribution. Rights are already cleared; no permission needed. Real ships on the map this
  week — in two seas.
- **(b) Global-gated.** Hold Maritime at `planned` until AISHub confirms display rights or AISStream
  publishes terms, then build global with regional feeds as enrichment.

Option (a) only remains honest if the layer states its coverage prominently. A world map with vessels only
around Scandinavia, unlabelled, would mislead exactly as badly as fabricated data.

---

## 10. Unresolved questions

1. AISHub: does contributor access include **public display and redistribution** of derived positions?
2. AISHub: is the API username/key usable from a cloud host, or bound to the contributing station's IP?
3. AISHub: what attribution string, and what happens to access if the feed drops below the quality bar?
4. AISStream: is there **any** licence, and does it permit public display and caching?
5. BarentsWatch: live endpoint field list, cadence, rate limits; poll or stream?
6. Digitraffic: does `/api/ais/v1/locations` accept a bounding box, and what is its update cadence?
7. Digitraffic: exact `Digitraffic-User` header convention.
8. All: real-world coverage density per sea area — undeterminable without live access.
9. Appropriate staleness thresholds by navigational status (§5).

---

## 11. Deviations and process notes

- Requested branch `arena/signalwatch-maritime-provider` unavailable; work is on the pinned
  `arena/01a0f054-globalinsitehub`. No history rewritten, Replit branch untouched.
- No live probes (no sandbox egress). Documentation evidence only.
- No accounts created, no hardware bought, no provider contacted — per the brief.
- `maritime` remains `planned`. No fixtures, no markers, no generated-contract change.
