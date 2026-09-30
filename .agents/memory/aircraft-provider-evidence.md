---
name: Aircraft provider evidence gates
description: Distinguish technical reachability from production approval and data-display rights when evaluating aircraft feeds.
---

Treat API availability, production approval, and public-display/redistribution rights as separate checks. Before marking a claim verified, inspect the saved first-party source and confirm it directly supports that specific claim. A research/search service error is not a provider response. A successful unauthenticated request from the research workspace does not prove the running API server can reach the provider or that the app is authorized to display the data. A timeout or access challenge likewise does not prove the provider lacks an API or denies all Replit traffic.

**Why:** Provider research can expose separate failures in the browsing tool, the provider endpoint, and source interpretation. Conflating them can incorrectly turn unresolved display rights or rate limits into a positive or negative access claim.

**How to apply:** Before integrating an aircraft source, verify its current official contract, get the provider-approved production access path, test reachability from the intended API-server environment, and confirm public-display and redistribution terms. Keep legal/terms interpretations unresolved where the source does not classify the proposed data handling; do not integrate until display rights, licensing obligations, and a workable access/rate-limit model are established.