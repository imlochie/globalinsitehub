# ADSB.lol live point query — access verification observation

**URL:** https://api.adsb.lol/v2/point/51.5/-0.1/10
**Checked:** 2026-09-30 via one unauthenticated direct HTTPS request (HTTP 200)
**Evidence type:** observed response, not provider permission or SLA evidence.

The documented point query returned the JSON envelope with an empty `ac` array, `msg: No error`, and current `now`/`ctime` timestamps at the time of the request. This demonstrates reachability from the research workspace only; it does not establish reachability from the deployed API server, coverage, freshness, or authorization for a public application.

Response:
{"ac":[
]
,"msg": "No error"
,"now": 1790735454000
,"total": 0
,"ctime": 1790735454000
,"ptime": 0
}
