# Aircraft Provider Admission Research

Research record. **No aircraft ingestion is implemented.** Researched
2026-09-30 against Signalwatch `46d00a2`.

## Scope

Clear or reject ADSB.lol and ADSB.fi as aircraft data providers for
Signalwatch. Prompted by the OSIRIS audit (`docs/research/osiris-source-audit.md`),
which found OSIRIS consuming `opendata.adsb.fi/api/v2` and
`adsb.lol/data/traces`. **OSIRIS's use of a provider is not evidence of
permission** and was not treated as such anywhere below.

Applying the rule established by the QLDTraffic camera work: *a capability is
earned from documented provider semantics, not inferred from what an adapter
can technically retrieve.*

## Signalwatch requirements

| Requirement | Why |
| --- | --- |
| $0 recurring, indefinitely | Architectural invariant |
| No feeder/hardware obligation | Reciprocity is a cost; hardware only if genuinely optional and explicitly chosen |
| Public display inside a distributed app | Windows installer, PWA, later Android |
| Server-side caching | The bundled API aggregates; the browser never calls providers |
| Honest coverage language | Coverage claims must match what the provider actually delivers |
| Clean attribution | Provenance survives into the inspector |

---

## ADSB.lol

### Identity

- Authoritative API host: `api.adsb.lol`; project site `adsb.lol`.
- Operated by an individual ("please contact **me**" in the Terms of Service
  section), community-feeder based.
- Source: <https://api.adsb.lol/docs> — "adsb.lol API", OpenAPI 3.1, v0.0.2.

### Relevant API surfaces

From <https://api.adsb.lol/docs>:

**Public v2 (no authentication documented):**

| Endpoint | Purpose |
| --- | --- |
| `/v2/lat/{lat}/lon/{lon}/dist/{radius}` | Aircraft surrounding a point, **up to 250 nm** |
| `/v2/point/{lat}/{lon}/{radius}` | Same, alternate path |
| `/v2/closest/{lat}/{lon}/{radius}` | Single closest aircraft |
| `/v2/hex/{icao}`, `/v2/icao/{icao}` | By transponder hex |
| `/v2/callsign/{callsign}` | By callsign |
| `/v2/reg/{reg}`, `/v2/registration/{reg}` | By registration |
| `/v2/type/{aircraft_type}` | By type (A320, B738) |
| `/v2/sqk/{squawk}`, `/v2/squawk/{squawk}` | By squawk (1200, 7700…) |
| `/v2/mil` | Military-registered aircraft |
| `/v2/pia` | Privacy ICAO Address aircraft |
| `/v2/ladd` | Limiting Aircraft Data Displayed aircraft |
| `/api/0/airport/{icao}`, `/api/0/routeset`, `/0/me`, `/0/my` | v0 helpers |

**Feeder-only (explicitly separate):** the direct `readsb` re-api and raw
aggregated data, described at
<https://www.adsb.lol/docs/feeders-only/re-api/> and
<https://www.adsb.lol/docs/feeders-only/beast-mlat-out/>. The docs state:
"By sending data to adsb.lol, you get access to the direct readsb re-api and
our raw aggregated data."

> **There is no public whole-network / global snapshot endpoint.** The widest
> public query is a 250 nm radius. This is the single most important technical
> finding and it constrains any Signalwatch aircraft layer built on ADSB.lol
> to regional queries.

`adsb.lol/data/traces` — the path OSIRIS uses — is **not listed** in the
official API documentation. Treated as undocumented and therefore out of
scope.

### Access

- No API key documented for v2 endpoints today.
- No account registration documented today.
- **Documented future gate**, verbatim: *"In the future, you will require an
  API key which you can get by feeding to adsb.lol."*
- Feeder-tier access requires running a receiver (hardware).

### Cost

- Verbatim: *"You can use the API for free."*
- No paid tier, sponsorship or commercial licence is mentioned.
- **No numeric rate limit is published.** `api.adsb.lol/docs` states none.
  **Unresolved.**

### Licence

Verbatim from <https://api.adsb.lol/docs>, "License":

> "The license for the API as well as all data ADSB.lol makes public is ODbL.
> This is the same license OpenStreetMap uses."

Linked to <https://opendatacommons.org/licenses/odbl/1-0/> (ODbL v1.0).

#### What ODbL actually requires of Signalwatch

Relevant clauses, quoted from the licence text:

- **3.1** — rights "explicitly include commercial use, and do not exclude any
  field of endeavour." So commercial use and public display are permitted.
- **4.3 Notice for using output (Contents)** — "Creating and Using a Produced
  Work does not require the notice in Section 4.2. However, if you Publicly
  Use a Produced Work, You must include a notice … aware that Content was
  obtained from the Database … and that it is available under this License."
  Example notice given: *"Contains information from DATABASE NAME, which is
  made available here under the Open Database License (ODbL)."*
- **4.4 b** — "Extraction or Re-utilisation of the whole or a Substantial part
  of the Contents into a new database is a Derivative Database and must comply
  with Section 4.4."
- **4.4 c** — "A Derivative Database is Publicly Used and so must comply with
  Section 4.4 if a Produced Work created from the Derivative Database is
  Publicly Used."
- **4.5 b** — "Using this Database … to create a Produced Work does not create
  a Derivative Database for purposes of Section 4.4."
- **4.5 c** — "Use of a Derivative Database internally within an organisation
  is not to the public."
- **4.6 Access to Derivative Databases** — if you Publicly Use a Derivative
  Database *or a Produced Work from a Derivative Database*, you must offer
  recipients a machine-readable copy of **either** the entire Derivative
  Database **or** "a file containing all of the alterations made to the
  Database or the method of making the alterations (such as an algorithm)",
  "free of charge if distributed over the internet."
- **6.2** — insubstantial extraction is unrestricted, but "repeated and
  systematic Extraction … of insubstantial parts … may however amount to the
  Extraction … of a Substantial part."

**Practical interpretation for Signalwatch.** The rendered map is a *Produced
Work*: showing markers requires the §4.3 notice and nothing more. The open
question is the server-side store. Signalwatch's architecture normalises
provider records into its own observation model and caches them. If that
normalised store amounts to extraction of a Substantial part into a new
database, it is a *Derivative Database* (§4.4 b); because the app publicly
displays a Produced Work created from it, §4.4 c then applies, and §4.6
obliges Signalwatch to offer either the derivative database or the alteration
method free of charge.

§6.2 matters here: Signalwatch would poll repeatedly, and repeated systematic
extraction of insubstantial parts "may amount to" a substantial part.

A plausible compliant design exists — short-TTL cache only, no historical
retention, §4.3 notice in the UI, and satisfying §4.6 by pointing at the
public open-source adapter as "the method of making the alterations". **That
reading has not been confirmed with the licensor and is not a lawyer's
opinion. Recorded as a condition, not as cleared.**

### Terms of use (separate from the licence)

Verbatim: *"If you want to use the API for production purposes, please contact
me so I do not break your application by accident."*

Signalwatch ships a Windows installer and a PWA. That is production use. This
is an explicit provider request and it has **not** been satisfied — contacting
the operator is outside what this agent may do (no accounts, no emails).

### Rate limits

Not published. **Unresolved.** No documented polling interval, no per-IP or
per-token guidance, no streaming/websocket option in the public API.

Operational feasibility therefore cannot be calculated from documented limits.
Any Signalwatch design would have to pick a conservative self-imposed interval
and confirm it with the operator under the production-use contact above.

### Data semantics

Schema names visible in the OpenAPI index: `V2Response_Model`,
`V2Response_AcItem`, `V2Response_LastPosition`, `PlaneInstance`, `PlaneList`.
Field-level semantics were **not** enumerated from the rendered docs page;
doing so requires reading `api/openapi.json`. **Unresolved** — but the
endpoint set implies hex, callsign, registration, type and squawk are present,
and `LastPosition` implies a distinction between a live position and a last
known position, which is exactly the freshness distinction Signalwatch already
models for vessels.

### Coverage

Community-feeder network. Coverage depends on volunteer receiver density and
is therefore uneven; ADS-B is also line-of-sight and poor at low altitude and
over oceans. **Signalwatch must not describe this as "global aircraft
coverage."** The honest description is "aircraft reported by the ADSB.lol
community receiver network, where receivers exist."

Because the widest public query is 250 nm, a worldwide view would require
tiling many queries — which interacts directly with the unpublished rate
limit.

### Provenance

Community ADS-B receivers aggregated by ADSB.lol, plus MLAT. Any
Signalwatch record must attribute ADSB.lol and carry the ODbL notice.

### Aircraft privacy restrictions

ADSB.lol publishes dedicated `/v2/pia` (Privacy ICAO Address), `/v2/ladd`
(Limiting Aircraft Data Displayed) and `/v2/mil` endpoints. PIA and LADD are
FAA privacy programmes. The provider **does not** state a restriction on
displaying them — it exposes them as filters. No provider-imposed restriction
found. **Signalwatch should still decide its own posture on military and
privacy-programme aircraft rather than defaulting to "the API allows it."**

### Signalwatch compatibility

| Question | Answer |
| --- | --- |
| Legal + technical consumption at $0 today | Yes, on documented terms |
| Cache normalized observations | Yes, subject to the §4.4/§4.6 question |
| Display publicly in the app | Yes, with the §4.3 notice |
| Retain historical observations | **Would strengthen the Derivative Database reading.** Avoid initially |
| Clean attribution | Yes |
| Operate without feeding | Yes **today**; the docs state a future API key obtainable by feeding |
| No paid third-party proxy | Yes |
| Stay within documented rate limits | **Cannot be determined — none published** |
| Works in Tauri / PWA / Android | Yes — server-side fetch, same as every other provider |
| Share-alike affects architecture | **Possibly.** See §4.6 above |

### Open questions

1. Numeric rate limits and acceptable polling interval.
2. Whether the operator considers a normalised short-TTL cache a Derivative
   Database, and whether pointing at the open-source adapter satisfies §4.6.
3. Whether, and when, the "future API key … by feeding" gate takes effect.
4. Field-level response schema (`api/openapi.json` not yet read).

### Decision

**ADOPT WITH CONDITIONS.** The licence permits commercial use, public display
and derivative databases; access is free and keyless today. Implementation is
blocked until these conditions are met, in order:

1. **Contact the operator about production use**, as the Terms of Service
   explicitly request. *This is a product-owner action; the agent cannot do
   it.* Use it to resolve the rate limit and the §4.6 question at the same
   time.
2. Implement the §4.3 ODbL notice in the aircraft inspector and layer panel.
3. Start with **no historical retention** and a short cache TTL.
4. Record the future-API-key statement as a known continuity risk: if the gate
   lands, Signalwatch would face a feeder (hardware) obligation and the layer
   would have to revert to `planned` rather than quietly acquire a reciprocity
   cost.

---

## ADSB.fi

### Identity

- Site: <https://adsb.fi/> — "community-driven flight tracker, with over 6500
  feeders around the world. We provide open and unfiltered access to worldwide
  air traffic data."
- Official open-data documentation: <https://github.com/adsbfi/opendata>
  (repository owned by the `adsbfi` organisation).
- API base: `https://opendata.adsb.fi/api/`.

### Relevant API surfaces

From the official README: `/v2/hex/[hex]`, `/v2/icao/[hex]`,
`/v2/callsign/[callsign]`, `/v2/registration/[reg]`, `/v2/sqk/[squawk]`,
`/v2/mil`, and `/v3/lat/[lat]/lon/[lon]/dist/[dist]` — "aircraft within
specified distance **up to 250 NM**". Documented as compatible with the
ADSBexchange v2 API.

As with ADSB.lol, **no public global snapshot endpoint.**

### Access

Public endpoints are accessible without a key. The README adds: "we kindly ask
you to support adsb.fi by setting up a receiver." A separate feeder endpoint
exists.

### Cost

No charge for the public endpoints. "Please contact us if you have commercial
or higher request rate requirements."

### Licence and terms

Verbatim from <https://github.com/adsbfi/opendata> — "Terms":

> "adsb.fi open data is **for personal, non-commercial use only**. You may not
> license, sell, rent, or lease any part of the data or the service. The data
> and the service are provided as-is, without any warranty. **You must cite
> adsb.fi and include a link to our home page.**"

### Rate limits

Verbatim: "The public endpoints are rate limited to **1 request per second**,
and the feeder endpoint to 1 request every 30 seconds. Making excessive
invalid HTTP requests results in a temporary IP address restriction. Requests
returning a 400, 401, 403, 404, or 429 status code count toward the limit."

### Data semantics / coverage / provenance

ADSBexchange-v2-compatible responses; community feeders (6500+ claimed);
same ADS-B coverage caveats as ADSB.lol.

### Signalwatch compatibility

Not reached. The terms are dispositive before any technical question.

### Open questions

None material. The restriction is explicit.

### Decision

**EXCLUDE.** "Personal, non-commercial use only" does not cover Signalwatch,
which is a distributed application shipped as a Windows installer and a PWA.
The homepage phrase "open and unfiltered access to worldwide air traffic data"
describes availability, not a licence grant — and it is contradicted by the
provider's own written terms. The "contact us for commercial requirements"
path leads to a negotiated arrangement, which is outside the $0 model.

This is the clearest demonstration in the OSIRIS audit of why *OSIRIS's use is
not evidence of permission*: OSIRIS consumes `opendata.adsb.fi/api/v2`
directly, against the provider's stated terms.

---

## Cross-provider findings

Factual comparison only; no ranking.

- Both publish a radius query capped at **250 nm** and **neither exposes a
  public global snapshot**. Any "world aircraft view" would require tiled
  queries against an unpublished (ADSB.lol) or 1 req/s (ADSB.fi) limit.
- Both are **community-feeder networks**, so coverage is uneven and
  concentrated where volunteers run receivers.
- Both encourage feeding; ADSB.lol states a *future* API key obtainable by
  feeding, ADSB.fi "kindly asks".
- Their licence positions are opposite: ADSB.lol is **ODbL** (commercial use
  explicitly granted, share-alike obligations attached); ADSB.fi is
  **personal, non-commercial only** (no share-alike, but no grant Signalwatch
  can use).
- Only ADSB.fi publishes numeric rate limits.
- Both require attribution, by different mechanisms: ODbL §4.3 notice vs
  "cite adsb.fi and include a link to our home page".

---

## Decision record

| Field | ADSB.lol | ADSB.fi |
| --- | --- | --- |
| Status | **ADOPT WITH CONDITIONS** | **EXCLUDE** |
| API surface considered | Public `/v2/*`, principally `/v2/lat/{lat}/lon/{lon}/dist/{radius}` | Public `/v2/*`, `/v3/lat/lon/dist` |
| Conditions | Operator contact for production use; ODbL §4.3 notice; no historical retention initially; accept future-key continuity risk | — |
| Unresolved | Rate limits; §4.6 derivative-database scope; timing of the future API key; field-level schema | None material |
| Evidence | <https://api.adsb.lol/docs>; <https://opendatacommons.org/licenses/odbl/1-0/>; <https://www.adsb.lol/docs/feeders-only/re-api/> | <https://github.com/adsbfi/opendata>; <https://adsb.fi/> |
| Date researched | 2026-09-30 | 2026-09-30 |

Explicitly **not** considered: `adsb.lol/data/traces` (undocumented), the
feeder-only re-api and beast/MLAT outputs (require feeding), OpenSky (not in
scope for this pass; its credential and rate-limit model is recorded in
`research/aircraft-provider-decision.md`).

---

## Recommended next engineering step

ADSB.lol reached ADOPT WITH CONDITIONS, so a next step exists — but it is
**not** writing an adapter.

The next step is **condition 1**: the product owner contacts the ADSB.lol
operator, as the Terms of Service request, and resolves in one exchange:

1. Acceptable polling interval / rate limit for a desktop + web application
   making tiled 250 nm radius queries.
2. Whether a short-TTL normalised server-side cache is considered a Derivative
   Database under ODbL §4.4, and whether publishing the open-source adapter
   satisfies §4.6.
3. Expected timing of the "future API key … by feeding" change.

Only after that should an implementation plan be produced. Writing the adapter
first would mean building against an unknown rate limit and an unresolved
share-alike obligation — which is exactly the failure mode this admission
process exists to prevent.
