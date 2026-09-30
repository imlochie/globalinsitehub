# Public Events — provider decision record (TfNSW + QLDTraffic)

Status: **GATE PASSED. Cleared for implementation.** Recorded 2026-09-30.
No code written yet; no account created; no email sent.

Supersedes the "no geolocated public-reporting source exists" position in
`research/public-events-source-research.md` §5.

---

## 0. Rule amendment this work operates under

Authorised by the product owner, replacing the blanket "no provider accounts":

> **No paid provider accounts. Free government-data accounts are permitted when
> they are required to access an explicitly licensed public-data source.**

Scope is deliberately narrow. It does not authorise commercial accounts, free
tiers with paid upgrade paths, or accounts for non-government providers. The
$0 recurring invariant is unchanged.

---

## 1. Layer meaning (unchanged by provider choice)

**Public Events** = geolocated civic and public-domain reporting: incidents,
crashes, closures, roadworks, flooding-affected roads, major events, civic
disruptions.

TfNSW and QLDTraffic are the *current providers*, **not the definition of the
layer**. Future free civic sources join the registry without changing what the
layer means.

### Classification rule — source semantics win

A Live Traffic record reading "road closed due to flooding" is a **civic /
transport incident from a transport authority**. It is *not* reclassified as a
Natural Hazard because the word "flood" appears. Conversely a USGS or EONET
geophysical record stays a Natural Hazard.

This is the same discipline as Phase J: the category is whatever the source
assigned, never what the text resembles. Concretely, `event_type` from
QLDTraffic and the TfNSW hazard category are copied through as-is, and there is
no keyword-based reclassification path anywhere in the pipeline.

---

## 2. QLDTraffic (Queensland TMR) — **PASS, no account required**

| Gate | Finding |
| --- | --- |
| Public GeoJSON access | **Yes** — `https://api.qldtraffic.qld.gov.au/v2/events` |
| Documented data-use terms | **Yes** — API specification v1.10, 19-02-2025, status *Published* |
| Licence | **CC BY 4.0 AU.** Spec §2.1: "Use of the data must be in accordance with the Creative Commons Attribution 4.0 Australia (CC BY 4.0 AU) license." `data.qld.gov.au` records the dataset licence as Creative Commons Attribution 4.0. |
| Attribution | "State of Queensland (Department of Transport and Main Roads)" |
| GPS incident data | **Yes** — GeoJSON `FeatureCollection`; feeds cover Hazards, Crashes, Congestion, Flooding, Roadworks, Special Events |
| Usage billing | **None.** No fee, no tier, no metering tied to payment |
| Account required | **No** — see below |

### The public API key

Spec §2.1.1.1 publishes a key explicitly for this purpose:

> A public API key, shown below, is available for developers who do not wish to
> register and receive their own API key:
> `"apikey": "3e83add325cbb69ac4d8e5bf433d770b"`
> This key is globally limited to 100 requests/minute.

So Queensland needs **no account at all** — the account exception is not even
consumed here. Two honest caveats, both recorded rather than glossed:

1. The 100 req/min ceiling is **shared globally** across every unregistered
   user, so throughput is not guaranteed. Signalwatch polls server-side once per
   cache window, which is negligible against that ceiling, but availability can
   still be affected by others.
2. TMR states registration is "preferable" and brings outage/release
   notifications, and it "reserves the right to limit or restrict access … where
   access by third parties has a negative or detrimental impact". Registration
   is by **email** to `qldtraffic@tmr.qld.gov.au` — an owner action, not mine.

Rate-limit behaviour to implement: HTTP **403** = invalid key, HTTP **429** =
rate limited. Both must surface as an honest provider status, never as "no
incidents".

### Real response contract (from spec §4.1–4.3, §5.2)

Root `FeatureCollection` with footer `published` and `rights`
(`owner` / `disclaimer` / `copyright`).

Each `Feature`:
- `geometry` — **`GeometryCollection`**, geometries typically `LineString` and
  `Point`. A road event may have several non-contiguous affected segments, so a
  representative point must be derived and **labelled as derived**, exactly as
  EONET polygons were.
- `properties` — `id`, `status`, `published`, `source{source_name, source_id,
  account, provided_by, provided_by_url}`, `url`, `event_type`,
  `event_subtype`, `event_due_to`, `impact{direction, towards, impact_type,
  impact_subtype, delay}`, `duration{start, end, active_days, recurrences[]}`,
  `event_priority`, `description`, `advice`, `information`,
  `road_summary{road_name, locality, postcode, local_government_area,
  district}`, `last_updated`, `next_inspection`, `web_link`.

Notes for normalization:
- `event_type` is the source-assigned category — copy it, never infer.
- `event_priority` (e.g. "Low") is a **source-supplied** priority. It may be
  displayed as the source's own field. It must **not** be renamed "severity",
  scored, or compared against hazard magnitudes.
- `published` / `last_updated` are source times; Signalwatch receipt time stays
  separate, as with every other layer.
- `source.provided_by` shows records may originate from TMR, Transport for NSW,
  or a Local Government Authority — so per-record attribution matters and the
  footer `rights.owner` says exactly that.

---

## 3. Transport for NSW — **PASS on terms, needs one free account**

| Gate | Finding |
| --- | --- |
| Documented public-data licence | **Yes — CC BY 4.0.** `opendata.transport.nsw.gov.au/datalicence`: "the data on the Open Data Hub is made available under the Open Data Policy and is licensed under a Creative Commons Attribution 4.0 License." |
| Redistribution | **Explicitly permitted**: "The Creative Commons Attribution license for the datasets allows for redistribution and reuse of a licensed work on the condition that Transport for NSW is attributed as the source." |
| Attribution | "Transport for NSW" |
| GPS incident data | **Yes** — dataset *Live Traffic Hazards*: "Incidents, Fires, Floods, Alpine Conditions, Major Events and Roadworks information including GPS coordinates in GeoJSON format" |
| Usage billing | **None** — free open data programme |
| Free account / API key | **Required.** The dataset and developer guide are login-gated; unauthenticated calls return HTTP 401 ("The application calling the API has not been authenticated") |

This is the single place the amended rule is actually used: a **free**
government-data account is required to obtain an API key.

**I have not created it.** Registration needs an email address and identity that
are the owner's, not mine. Implementation will therefore follow the proven
BarentsWatch pattern: read `TFNSW_API_KEY` from the environment, and when it is
absent report the provider as `unavailable` with an honest message — the layer
still runs on Queensland data, and NSW simply reports that it is unconfigured.

Also recorded from the provider forum: the live feed carries roughly the last
~24 hours, and historical reporting drops latitude/longitude. So this is a
**current-conditions** source, and no historical claim will be made.

---

## 4. Zero-cost audit

| Cost axis | QLDTraffic | TfNSW |
| --- | --- | --- |
| Provider charge | No | No |
| Subscription | No | No |
| Usage-based billing | No | No |
| Free tier that becomes paid at real workload | No | No |
| Account required | **No** (public key) | Yes — **free**, government open data |
| Paid upgrade path | None | None |
| Contribution / hardware requirement | No | No |

**$0 recurring, no paid upgrade path, no commercial relationship.** Both are
Australian government open-data programmes under CC BY 4.0.

---

## 5. Coverage honesty

Coverage is **regional**, and must be stated that way exactly as maritime is:

- QLDTraffic — Queensland state-controlled and reported roads.
- TfNSW — New South Wales road network (when configured).

An empty map outside Queensland and NSW means **Signalwatch has no civic
incident source there**, not that no incidents exist. Coverage is derived from
the providers that actually answered, never declared statically.

---

## 6. Implementation plan (next step)

1. `artifacts/api-server/src/public-event-providers/` — `qldtraffic.ts`,
   `tfnsw.ts`, shared `types.ts`, `registry.ts`, mirroring the maritime and
   hazard provider shape (independent settlement, per-provider status).
2. `GET /monitoring/public-events` → OpenAPI → regenerate Orval → layer source.
3. `PublicEventObservation` reworked onto real civic-incident fields
   (source-assigned `eventType`, source `priority` kept as the source's own
   field, impact, road summary, derived-point flag, distinct source/receipt
   times).
4. Provider-status-aware panel; remove the "no mappable records" warn state once
   records actually place.
5. Tests: representative-point derivation from `GeometryCollection`, no
   keyword reclassification, provider independence, 403/429 surfacing honestly,
   coverage derivation, bounded responses.
6. Docs: `replit.md`, `global-layer-engine.md`, and the rule amendment.

**Open item for the owner:** register at
`opendata.transport.nsw.gov.au`, create an application, and provide
`TFNSW_API_KEY`. Queensland needs nothing.
