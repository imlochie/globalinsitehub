# Research Notes: Aircraft Data Providers for Signalwatch

**Status:** complete
**Depth:** Standard

## Plan

- **Question:** Which current aircraft data providers offer a legitimate, bounded-query access path suitable for a small public situational-awareness app hosted on Replit?
- **Scope:** Airplanes.live, OpenSky Network, ADS-B Exchange, ADSB.lol, adsb.fi, and relevant government or commercial APIs. Research only; no app, API, configuration, or deployment changes.
- **Audience:** Signalwatch engineering.
- **Deliverable:** Concise comparison with official documentation, access requirements, Replit reachability, coverage, limits, terms, verification status, and one factual next-provider recommendation.
- **Follow-on question:** What do ADSB.lol’s current first-party sources establish about public display, ODbL use, operation, and approved Replit-hosted consumption?
- **Follow-on boundary:** First-party sources plus ODbL text only; no provider contact, application changes, credentials, or access-control workarounds.
- **Follow-on output:** Add an ADSB.lol Terms & Access Verification section, evidence-status lists, drafted questions (not sent), and a factual decision gate.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Airplanes.live current API access | done | 4 |
| 2 | OpenSky access, limits, and usage terms | done | 4 |
| 3 | ADS-B Exchange access and licensing | done | 6 |
| 4 | Public community APIs: ADSB.lol and adsb.fi | done | 8 |
| 5 | Government and commercial alternatives | done | 4 |
| 6 | ADSB.lol Terms & Access Verification | done | 9 |

## Coverage Checklist

- [x] Verify current official docs and endpoint availability for each candidate; blocked/timeout results are recorded as gaps, not treated as proof that a service does not exist.
- [x] Record access gates: Airplanes.live contact response; OpenSky anonymous/account tiers; ADSB.lol current public access plus production-contact note; ADS-B Exchange API key; FlightAware API key/tier; FAA SWIM onboarding.
- [x] Compare bounded queries, fields, coverage claims, and freshness/update information where first-party evidence was accessible.
- [x] Record numeric limits where published; do not infer a rate limit or SLA where the provider does not publish one in the reviewed source.
- [x] Check display/redistribution terms; ADSB.lol is ODbL 1.0, ADS-B Exchange requires written authorization for distribution, and other candidates remain unresolved.
- [x] Record actual Replit-workspace HTTP outcomes without credentials or access-control workarounds.
- [x] Separate provider claims, observed network results, third-party reports, and unresolved terms.
- [x] Recommend a next provider to investigate without implying production authorization.

### ADSB.lol Terms & Access Verification

- [x] Recheck first-party website, API contract, official repository/readme, license page, and official contact path.
- [x] Separate documented endpoint/auth/account/feeder/rate-limit facts from observed request results and provider-confirmation gaps.
- [x] Determine exactly what provider sources say about automated use, public display, normalization, caching, and attribution; retain any unaddressed terms as unresolved.
- [x] Summarize ODbL text about databases, derivative databases, produced works, attribution, and share-alike without making a legal conclusion.
- [x] Check official statements about freshness, coverage, stale records, ADS-B/MLAT, missing aircraft, and outages; distinguish feeder inputs from public API output.
- [x] Record a modest current workspace access check and assess Replit use without claiming backend/prod equivalence.
- [x] Draft precise provider questions for unclear terms; no message sent.

## Findings Log

_[@key] markers reference sources in research/sources.json._

### Airplanes.live

- The production API base returned HTTP 403 and instructed the caller to contact the provider with project links and a description. [@airplanes-live-api-root]
- Official docs, feeder page, and terms returned Cloudflare challenges; endpoint schema, exact access policy, limits, coverage, latency, and display rights remain unverified. [@airplanes-live-api-docs] [@airplanes-live-get-started] [@airplanes-live-terms]
- Status: not anonymously usable in the observed Replit workspace; do not infer approval, API-key eligibility, or feeder access from the response.

### OpenSky

- Official REST docs support geographic bounding boxes and list state-vector fields including identity, position, altitude, speed, track, squawk, and timestamps. Anonymous requests are IP-bucketed, have 10-second resolution, and receive 400 credits/day; a box up to 25 square degrees costs 1 credit. [@opensky-rest-api]
- The same docs list 4,000/day for Standard users, 8,000/day for active feeders, and 14,400/hour for licensed users; authenticated access uses OAuth2 client credentials. [@opensky-rest-api] [@opensky-api-readme]
- OpenSky’s README warns that AWS and other hyperscaler traffic may be blocked. An anonymous geographic API request from this workspace and the linked terms page both timed out. These observations do not prove a blanket Replit block or establish public-display rights. [@opensky-api-readme] [@opensky-terms-page] [@opensky-live-probe]
- Status: possible low-frequency bounded-query candidate only after terms and Replit API-server reachability are confirmed.

### ADSB.lol and adsb.fi

- ADSB.lol’s current OpenAPI describes bounded `/v2/point` and `/v2/closest` queries up to 250 nautical miles and fields for identity, position, altitude, speed, track, callsign, registration, squawk, and position age. A point request from this workspace returned HTTP 200 with the documented envelope (zero aircraft in the selected test area). [@adsblol-openapi] [@adsblol-live-point-query]
- Official docs say the API is available to everyone. The OpenAPI says current use is free, a future API key will be required (available by feeding), and production users should contact the operator. No numeric rate limit or freshness SLA was found. [@adsblol-api-docs] [@adsblol-openapi]
- The API and public data are identified as ODbL 1.0; the service is provided as-is without a timeliness or availability warranty. ODbL attribution and share-alike obligations require review for Signalwatch’s data handling. [@adsblol-openapi] [@adsblol-privacy-license] [@odbl-summary] [@odbl-full-license]
- adsb.fi’s home page is reachable, but an official API contract, geographic query, auth policy, limits, license, and public-display terms could not be verified. The API-style host/path attempts were not usable from this workspace; no Cloudflare bypass was attempted. [@adsbfi-homepage] [@adsbfi-api-root]
- Status: ADSB.lol is the best candidate for written production-use confirmation; it is not cleared for integration. Do not select adsb.fi without an official API/access contract.

### ADSB.lol Terms & Access Verification

- The official API contract describes free current GET access and `/v2/point`, `/v2/closest`, and equivalent geographic routes up to 250 NM; it asks production users to contact the operator and says a future API key will be feeder-linked. The docs say the API is available to everyone. [@adsblol-openapi] [@adsblol-api-docs]
- The official API README says limits vary with environment load but gives no numeric quota, burst, or polling allowance. No automation, production-app, or Replit-hosting acceptance is stated. [@adsblol-api-readme]
- One unauthenticated point request returned HTTP 200 with an empty aircraft array from the research workspace. This does not establish backend egress, coverage, freshness, or public-use permission. [@adsblol-live-point-query]
- The API and public data are marked ODbL 1.0. The privacy/license page separately applies CC0 to feeder submissions and disclaims accuracy, timeliness, completeness, reliability, and availability warranties. [@adsblol-openapi] [@adsblol-privacy-license]
- ODbL sections 3.1, 4.2–4.5 and definitions distinguish use/display, Produced Work notices, and Derivative Database share-alike conditions. The sources do not classify Signalwatch’s normalization, public map, temporary cache, or stored observations. **Unresolved legal/terms question.** [@odbl-full-license]
- The schema contains `seen`, `seen_pos`, `mlat`, and `tisb`; field units, stale cutoffs, expiry, latency, and API coverage are not established. The feed README describes supported input modalities only. [@adsblol-api-source-models] [@adsblol-feed-readme]
- Official contact path: `info [at] adsb.lol`. Drafted eight questions covering public display/refresh, attribution, ODbL/data handling, cache duration, limits/polling, key transition, public/commercial and Replit use, and freshness fields. Nothing was sent. [@adsblol-privacy-license]
- Status: **Provider confirmation required**; no Aircraft integration until display rights, ODbL duties, and a workable access/rate model are confirmed.

### ADS-B Exchange

- The official product page describes global live and historical data products, location-based filtering, and live-position refreshes at 250 ms. [@adsbx-data-products]
- The current v2 OpenAPI documents a radius query in nautical miles and rate-limit tiers of 12 RPM or 120 RPM, with token-bucket behavior. It specifies `x-api-key`; the official sample-call page instead uses `api-auth`. An unauthenticated point request from this workspace returned HTTP 403. Confirm the header and entitlement with the provider; no key was used. [@adsbx-openapi] [@adsbx-access-probe] [@adsbx-sample-call]
- The API sample lists aircraft identity, callsign, registration, type, coordinates, altitude, speed, track, vertical rate, squawk, emergency, and seen/position-age fields. The OpenAPI terms link points to the current JETNET terms page. [@adsbx-sample-call] [@adsbx-terms-of-use]
- The provider’s AUP prohibits publishing, reselling, transmitting, broadcasting, or distributing services or data acquired from them unless authorized in advance in writing. A public Signalwatch map therefore needs explicit written permission under the applicable agreement. [@adsbx-acceptable-use]
- Status: key/plan required; public display is not authorized by the reviewed default terms.

### Government and commercial alternatives

- FAA SWIM overview and access pages returned HTTP 200 from this workspace. Its SWIFT portal uses Solace JMS; no live service connection was attempted. The pages describe near-real-time flight, weather, and surveillance information for the NAS; some service requests are reviewed under FAA policy. The access page is dated 2024-09-20, so onboarding details may have changed. It is not a verified drop-in anonymous REST/ADS-B feed. [@faa-swim-overview] [@faa-swim-getting-access]
- FlightAware AeroAPI product and developer pages returned HTTP 200 from this workspace; no live API request was attempted. The product page describes an on-demand, usage-based API with an API-key example and current flight/track/position data, plus derivative-work distribution by tier: Personal for personal/academic use, Standard for business/B2C, Premium for B2C and B2B commercial use. A geographic point/radius endpoint, exact request cap, and Signalwatch-specific permission were not verified. [@flightaware-aeroapi] [@flightaware-aeroapi-docs]
- Status: FlightAware is a potentially licensable commercial alternative if its plan permits the app’s public use and query pattern; FAA SWIM is a separate U.S. NAS integration path rather than an anonymous public API.

## Conflicts & Open Questions

- ADS-B Exchange’s current OpenAPI requires `x-api-key`, while its official sample page says `api-auth`; the operator must confirm the current header before any test using an approved key.
- ADSB.lol’s OpenAPI describes free current use but asks production users to contact the operator and says a future key will be feeder-linked; its README says rate limits vary with environment load. Exact public-display/production eligibility, numeric limits, polling allowance, cache/normalization treatment, and key timing remain open. [@adsblol-openapi] [@adsblol-api-readme]
- No provider-published exemption or interpretation was found for public display, normalization, caching, or the ODbL database/individual-content boundary; no API migration or endpoint-deprecation notice was found. [@adsblol-openapi] [@adsblol-privacy-license] [@odbl-full-license]
- A 402 from the research search/fetch service was not an ADSB.lol response and was not used as evidence about provider access; direct first-party captures were inspected and cited.
- OpenSky anonymous access and quotas are documented, but its API timed out from this workspace and its linked terms page could not be reached. No conclusion about data redistribution or Replit blocking is justified.
- FlightAware’s B2C tier language is promising for a public app, but it does not by itself establish whether a public situational-awareness map, geographic polling, and normalized data are permitted.
- FAA SWIM is a near-real-time service path, but the reviewed access page is dated 2024-09-20; current enrollment, licensing, and exact surveillance product fields need confirmation.
- Airplanes.live’s API root gives a contact instruction, but current endpoint, credentials, quota, license, and public-display policy remain unknown.
- adsb.fi’s current official API/access contract remains unverified.

## Gaps

- No credentials were used. No API authentication, paid plans, provider contact, or app integration was attempted.
- Direct page access from the Replit workspace is not proof of availability from the running API server or of production permission.
- ADSB.lol public-display rights, ODbL application to Signalwatch data, numeric rate limits, acceptable polling, freshness semantics, and Replit-hosted production use remain unresolved pending provider confirmation.
- Several providers’ official pages were blocked or timed out. The report records the exact evidence and does not infer missing policy from an access failure.