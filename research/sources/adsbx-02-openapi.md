# ADS-B Exchange official API v2 OpenAPI specification

**URL:** https://gateway.adsbexchange.com/api/aircraft/v2/docs/openapi.json  
**Checked:** 2026-09-30  
**Evidence type:** direct retrieval and inspection of official OpenAPI JSON

The API is version v2 and the server is `https://gateway.adsbexchange.com/api/aircraft/v2`. The radius route is `/lat/{lat}/lon/{lon}/dist/{dist}`; its radius parameter is in nautical miles. The operation requires an API-key security scheme under the `x-api-key` HTTP header.

The API description documents token-bucket limits for “Limited Access”: 12 requests/minute (one replenished every five seconds, burst five, 19,008/day) or 120 requests/minute (two per second, burst ten, 190,080/day). Limits are shared across endpoints on a key. The description identifies a 429 response when the bucket is empty.

The specification links its terms of service to `https://www.adsbexchange.com/terms-of-use/`.