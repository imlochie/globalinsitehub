# ADS-B Exchange unauthenticated API access check

**URL:** https://gateway.adsbexchange.com/api/aircraft/v2/lat/37.77/lon/-122.42/dist/10  
**Checked:** 2026-09-30  
**Evidence type:** direct unauthenticated request from the Replit research workspace

The documented geographic endpoint returned HTTP 403 with `{"message":"Forbidden"}` when called without an API key. No key, account, proxy, or alternate identity was used.