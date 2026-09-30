# ADSB.lol OpenAPI fields — observation-age and source flags

**URL:** https://api.adsb.lol/api/openapi.json
**Retrieved:** 2026-09-30 by direct first-party HTTPS request (web search/fetch service returned HTTP 402)
**Evidence type:** official live OpenAPI contract

The current OpenAPI aircraft item schema includes `seen` (required numeric age field), optional `seen_pos` (numeric or null), `lastPosition.seen_pos`, and `mlat` and `tisb` arrays. It does not define prose semantics, units, staleness thresholds, expiry behavior, or a freshness SLA for these fields. Therefore the fields expose observation/source-related data, but this contract alone does not authorize Signalwatch to infer a maximum display age or treat a record as current.
