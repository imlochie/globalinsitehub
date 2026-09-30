# ADSB.lol official API evidence

Research date: 2026-09-30. Direct HTTP retrieval (webFetch was unavailable because the research service returned 429/402).

Sources:

- https://api.adsb.lol/api/openapi.json
- https://www.adsb.lol/docs/open-data/api/
- https://www.adsb.lol/privacy-license/
- https://github.com/adsblol

The live OpenAPI document identifies the service as “adsb.lol API”, version 0.0.2. Its description says the API is free, but warns that an API key will be required in the future and asks production users to contact the operator so applications are not broken accidentally. It declares ODbL 1.0 for the API and all public data.

The documented bounded endpoints include:

- GET `/v2/point/{lat}/{lon}/{radius}` (and equivalent `/v2/lat/{lat}/lon/{lon}/dist/{radius}`), with radius constrained to 0–250 nautical miles.
- GET `/v2/closest/{lat}/{lon}/{radius}`, also up to 250 nautical miles.
- Callsign, registration, ICAO hex, squawk, type, PIA, MIL, and LADD lookup routes.

The aircraft schema includes hex, lat/lon, barometric/geometric altitude, ground speed, track, callsign (`flight`), registration (`r`), squawk, `seen`/`seen_pos`, MLAT/TIS-B arrays, and related navigation/quality fields. A live request to `https://api.adsb.lol/v2/point/51.5/-0.1/10` returned HTTP 200 with the documented JSON envelope and current `now` timestamp (the selected test region happened to have zero aircraft).

The official docs page says the API is available to everyone and labels the API ODbL 1.0. The official privacy/license page states the service is provided as-is and contains the service’s license/disclaimer terms; the API OpenAPI document is the clearest current statement about production contact and future key requirements.

The official GitHub organization is verified and reports active, non-archived repositories, including `api` updated 2026-09-25, `website` updated 2026-09-20, `feed` updated 2026-09-21, and `globe_history_2026` updated 2026-09-29:

- https://github.com/adsblol/api
- https://github.com/adsblol/website
- https://github.com/adsblol/feed

Not verified: a numeric rate limit, explicit freshness/latency SLA, a separate public-display permission clause, or a guarantee that free anonymous access will continue. The ODbL obligations (including attribution/share-alike considerations for databases) need legal/product review before redistribution.