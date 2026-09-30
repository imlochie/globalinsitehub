# adsb.fi verification evidence

Research date: 2026-09-30. Direct HTTP retrieval; webSearch returned HTTP 402 and webFetch returned HTTP 429/402.

Sources attempted:

- https://adsb.fi/
- https://adsb.fi/robots.txt
- https://adsb.fi/sitemap.xml
- https://api.adsb.fi/
- https://github.com/adsb-fi

The public homepage returned HTTP 200 and identifies itself as “adsb.fi - Home of the Flight Tracking Community”. The public `robots.txt` is reachable. No official API documentation, geographic endpoint contract, authentication policy, request limits, public redistribution/display terms, or current data license was independently verified from a first-party API document during this run.

The sitemap and an example API-style path returned Cloudflare challenge pages, and `api.adsb.fi` returned HTTP 404 behind Cloudflare. These observations do not prove that no API exists; they only mean that this research environment could not verify an official API contract or whether a normal external Replit server can use one. No Cloudflare bypass or scraping was attempted.

Status: needs further verification. Do not select adsb.fi for Signalwatch until the operator publishes or confirms an official API/application-access path, geographic query support, limits, and public-display/redistribution terms.