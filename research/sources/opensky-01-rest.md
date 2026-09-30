# OpenSky REST API — official documentation

**Source URL:** https://openskynetwork.github.io/opensky-api/rest.html  
**Retrieved:** 2026-09-30 (official documentation page)

## Verified excerpts and findings

- `GET /states/all` returns current state vectors and accepts optional `lamin`, `lomin`, `lamax`, and `lomax` geographic bounds, as well as `time` and repeated `icao24` filters.
- State-vector fields include ICAO24, callsign, origin country, time position, last contact, longitude, latitude, barometric altitude, on-ground flag, velocity, true track, vertical rate, geo altitude, squawk, SPI, and position source.
- Anonymous requests are IP-bucketed. Only the most recent state vectors are available; `time` is ignored and resolution is 10 seconds.
- Authenticated requests can retrieve state vectors up to one hour in the past and use 5-second resolution.
- Authentication is OAuth2 client credentials; basic username/password authentication is no longer accepted.
- Credits are independent for states, tracks, and flights. Quotas per endpoint are documented as: Anonymous 400/day; Standard user 4,000/day; Active feeder (>=30% monthly uptime) 8,000/day; Licensed user 14,400/hour.
- `/states/all` costs 1 credit for a bounding-box area <=25 square degrees or serial-only query, 2 for 25–100, 3 for 100–400, and 4 for >400 or global. Exhaustion returns HTTP 429 with `X-Rate-Limit-Retry-After-Seconds`.
- The documentation states that data from a user's own receivers via `/states/own` has no credit cost or time restriction, but authentication is required.

The page does not itself establish permission for a public operational application or redistribution; terms/licensing must be checked separately.