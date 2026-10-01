# OSIRIS code provenance ledger

Tracks every piece of Signalwatch that originated in OSIRIS, what changed, and
the admission status of the provider behind it.

OSIRIS is MIT-licensed (© 2026 simplifaisoul). **MIT covers OSIRIS's code. It
grants nothing about the upstream data those adapters fetch** — provider terms
remain independently authoritative for every source.

OSIRIS upstream commit referenced by all entries below:
`d972d9af5c6f45aebf6d60b8a60f229a8abbe2f1`.

---

## Migrated

| OSIRIS origin | Signalwatch destination | Batch / commit | What was reused | What was replaced | Provider | Admission |
| --- | --- | --- | --- | --- | --- | --- |
| `src/app/api/cctv/finland.ts` | `artifacts/api-server/src/camera-providers/digitraffic-weathercam.ts` | Batch 1 | **Endpoint knowledge only**: that `tie.digitraffic.fi/api/weathercam/v1/stations` lists stations whose `presets` carry camera images | Everything else. `stealthFetch` → `providerFetch` with an honest `Digitraffic-User` header; inferred image handling → `classifyViewCapability` with provider-documented `documentedAs`; added licence, attribution, freshness, per-camera availability, origin pinning and preset-id validation | Fintraffic Digitraffic | **ADOPT** — CC BY 4.0 verified in `research/maritime-provider-decision.md` |

| `src/app/api/weather/route.ts` | `artifacts/api-server/src/hazard-sources/nws.ts` | Batch 3 (commit labelled `batch 2`; see migration doc) | **Endpoint knowledge only**: that `api.weather.gov/alerts/active` serves active NWS alerts as GeoJSON | Everything else. Routed through `providerFetch` so the identifying User-Agent NWS *requires* is sent; added licence, attribution, CAP severity as a source-owned label, source-declared open/closed from `expires`, derived-centre disclosure, and dropping of zone-only alerts that cannot be placed | NOAA / NWS | **ADOPT** — "open data, free to use for any purpose", no key |

| `src/app/api/fires/route.ts` | `artifacts/api-server/src/hazard-sources/firms.ts` | Batch 3 | **The bulk-download approach only** — that FIRMS publishes keyless global CSVs | Everything else. Source switched from the retiring Suomi NPP product to NOAA-20; own slower cache window; bounded output with the cap disclosed; FIRMS confidence carried verbatim; FRP as the one real measurement; "detection, not confirmed fire" language throughout | NASA FIRMS | **ADOPT** — keyless bulk path, no account |

### Notes on the Batch 1 migration

- The OSIRIS original builds `https://weathercam.digitraffic.fi/${preset.id}.jpg`
  unconditionally. Signalwatch prefers the provider-published `imageUrl`, pins
  it to the documented origin, and only falls back to the documented
  `C\d{7}` pattern — so an unexpected upstream value cannot steer the image
  URL off-host or out of its path.
- The OSIRIS original takes only `presets[0]` per station. Signalwatch emits
  every preset, because each is a distinct fixed view with its own id.
- The OSIRIS original has no concept of a camera being out of service.
  Signalwatch reads the documented `collectionStatus` / `state` /
  `inCollection` fields and reports `unavailable` rather than dropping the
  record or implying it is viewable.

---

## Rejected OSIRIS mechanisms

Recorded so a future agent does not reintroduce them.

| OSIRIS origin | Why rejected |
| --- | --- |
| `src/lib/stealthFetch.ts` | Rotates fake browser User-Agents and fabricates a residential IP injected as `X-Forwarded-For` / `X-Real-IP`. Evades rate limits by misrepresenting the client, and destroys provenance. Replaced by `artifacts/api-server/src/lib/provider-fetch.ts` |
| `src/app/api/cctv/sweden.ts` | Routes through `osirisai.live`, a third-party runtime dependency and someone else's recurring cost |
| `src/app/api/maritime/route.ts` | `aisstream.io` (excluded by product decision) plus a hard-coded `PORTS` table presented inside a live dashboard |
| `conflicts` / `frontlines` | Static zone data presented as live observation |
| Skyline/YouTube/`streamlock.net` camera adapters | No redistribution right for the media |
| `scanner`, `osint/sweep`, `osint/shodan`, `osint/fingerprint`, `osint/leaks`, `osint/hudsonrock` | Active reconnaissance; outside the Signalwatch safety boundary |

---

## Not yet migrated, pending admission

| OSIRIS origin | Provider | Blocking |
| --- | --- | --- |
| `cctv/route.ts` (inline) | TfL JamCams | Primary terms unread |
| `cctv/route.ts` (inline) | WSDOT | No WSDOT-authored terms; partner-camera boundary unconfirmed |
| `cctv/route.ts` (inline) | Caltrans | No terms or image semantics established |
| `cctv/hongkong.ts`, `netherlands.ts`, `newzealand.ts`, `iceland.ts`, `lithuania.ts`, `taiwan.ts` | various government | Per-provider licence + capability check |
| `api/fires/route.ts` | NASA FIRMS | **Admitted — ADOPT.** No key needed via the bulk download path; see `providers/nasa-firms-admission.md` |
| `api/weather/route.ts` (GDACS half) | GDACS | Licence unverified; overlaps EONET semantics |
| `api/air-quality/route.ts` | OpenAQ | **ADOPT WITH CONDITIONS** — user-supplied key; blocked on confirming the hosted-API "substantially duplicate" clause with OpenAQ |
| `api/aircraft`, `api/flights` | ADSB.lol | ADOPT WITH CONDITIONS — operator contact outstanding |
