# ADSB.lol official API repository README — verification capture

**URL:** https://raw.githubusercontent.com/adsblol/api/master/README.md  
**Repository:** https://github.com/adsblol/api  
**Checked:** 2026-09-30  
**Evidence method:** direct HTTPS retrieval from the official GitHub organization

## Relevant official text

- The README identifies the repository as the source code for the ADSB.lol API and links to `https://api.adsb.lol/docs`.
- Under “Rate limits,” it says: “Rate limits are dynamic based on the environment load.”
- It says that, in the future, an API key will be required and that one can be obtained by feeding adsb.lol. It describes this as a way to ensure the API is used responsibly and by contributors.
- It says that 4xx errors indicate the caller is doing something wrong, but gives no numeric request-per-minute or daily quota.

## Limits of this evidence

The README does not state a public-display license grant, a freshness/latency target, a cache policy, or whether a Replit-hosted backend is an approved consumer. The dynamic-load statement is a provider description, not a numeric service-level commitment.