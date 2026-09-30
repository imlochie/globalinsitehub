---
name: Airplanes.live access gate
description: The official Airplanes.live docs and API were inaccessible during an integration check from this workspace.
---

The official documentation page returned a Cloudflare challenge, and the official geographic endpoint returned HTTP 403 with a request to contact Airplanes.live and include project links and a description. This does not verify the current endpoint schema, usage limits, or access policy. The official GitHub organization's archived `api-archive` repository documents the older ADSB One API at `api.adsb.one`; do not treat that as the current `api.airplanes.live` service or use it as a fallback.

**Why:** Signalwatch requires a documented, provider-approved source and must not bypass access controls or guess provider semantics.

**How to apply:** Before resuming the integration, obtain provider-approved access or accessible official documentation, then recheck the endpoint from the API server environment. Do not substitute scraping or another aircraft provider.