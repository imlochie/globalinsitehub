# ADSB.lol live point-query reachability check

**URL:** https://api.adsb.lol/v2/point/51.5/-0.1/10  
**Checked:** 2026-09-30  
**Evidence type:** direct unauthenticated request from the Replit research workspace

The request returned HTTP 200 and the documented JSON envelope with a current `now` timestamp. The selected area and radius returned zero aircraft. This confirms a successful public HTTP response from the workspace, not a coverage guarantee, freshness SLA, or production authorization.