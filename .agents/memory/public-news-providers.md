---
name: Public news provider behavior
description: Observed reliability and rate-limit behavior for public headline sources.
---

Initial feed testing found the GDELT query returned HTTP 429 with a one-request-per-five-seconds throttle notice from this environment, while public RSS feeds from ABC News Australia, BBC News World, Sky News World, and Al Jazeera English returned successfully.

**Why:** A rate-limited aggregation endpoint can make monitoring appear unreliable even when individual publishers are responding.

**How to apply:** Prefer direct publisher RSS for low-frequency headline ingestion and preserve per-publisher status and attribution. Re-test any aggregator with an intentional throttle before switching.