# ADSB.lol API repository models — source fields

**URL:** https://github.com/adsblol/api/blob/main/src/adsb_api/utils/models.py
**Raw URL:** https://raw.githubusercontent.com/adsblol/api/main/src/adsb_api/utils/models.py
**Retrieved:** 2026-09-30 by direct first-party raw GitHub request (web search/fetch service returned HTTP 402)
**Evidence type:** official ADSB.lol API source

The source model defines aircraft fields `seen`, optional `seen_pos`, `mlat`, and `tisb`, matching the public OpenAPI schema. The model provides no comments or documented thresholds explaining stale-position handling, expiry, or display policy. This is evidence about the API shape, not a guarantee about response freshness.
