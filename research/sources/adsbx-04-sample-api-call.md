# ADS-B Exchange official sample API call

**URL:** https://www.adsbexchange.com/data-products/sample-api-call/  
**Checked:** 2026-09-30  
**Evidence type:** direct retrieval of official sample documentation

The page returned HTTP 200. It documents a live aircraft-by-ICAO query and lists fields including ICAO hex, callsign, registration, aircraft type, latitude, longitude, barometric/geometric altitude, ground speed, track, vertical rate, squawk, emergency state, category, and `seen`/`seen_pos`.

The sample uses an `api-auth` header, which conflicts with the current OpenAPI specification’s `x-api-key` requirement. Confirm the correct header with the provider before using an approved credential.