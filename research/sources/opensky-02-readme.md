# OpenSky API repository README — official

**Source URL:** https://raw.githubusercontent.com/openskynetwork/opensky-api/master/README.md  
**Retrieved:** 2026-09-30

## Verified excerpts and findings

- The README says OAuth2 is required from March 18, 2026; basic username/password authentication is no longer supported.
- Users create an API client and download credentials from their OpenSky account. Requests without credentials remain possible anonymously with reduced rate limits.
- The README explicitly says OpenSky may block AWS and other hyperscalers because of generalized abuse from those IPs. This makes Replit-hosted backend reachability an unresolved operational risk that must be tested with approved credentials; it must not be worked around.
- It links the terms of use as https://opensky-network.org/about/terms-of-use.