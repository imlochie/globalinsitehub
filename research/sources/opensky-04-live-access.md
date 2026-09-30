# OpenSky anonymous live API access check

**URL:** https://opensky-network.org/api/states/all?lamin=51.45&lomin=-0.15&lamax=51.55&lomax=0.05  
**Checked:** 2026-09-30  
**Evidence type:** direct unauthenticated request from the Replit research workspace

The documented `/api/states/all` route with a small geographic bounding box timed out after 18 seconds and returned curl exit 28 / HTTP status 000. No credentials or alternate route were used. This is an observed workspace connectivity failure, not evidence that OpenSky blocks all Replit traffic.