# Hong Kong Transport Department traffic snapshot images — admission record

**Status: ADOPT.** Researched 2026-10-01 against Signalwatch `43105f2`, under
`source-admission-standard.md`. This is Camera Batch 2A.

Dataset: *Traffic snapshot images*, Transport Department, on DATA.GOV.HK.
<https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images>

---

## 1. The media-rights question, answered on its own evidence

The standing rule is that a licence covering a provider's catalogue or API
responses does **not** automatically authorise redistribution or display of the
associated media. Each media class is evaluated independently. For most camera
programmes that is where admission stalls: the catalogue is open data and the
imagery is unaddressed.

Hong Kong is the first camera provider where the imagery is addressed
*directly*, by two independent pieces of primary evidence.

**(a) The terms define "Data" to include the imagery.** DATA.GOV.HK Terms and
Conditions of Use, version 1.2, last updated 26 May 2025:

> "'**Data**' mean the data and all contents provided by the Government and/or
> other organisations (the 'Relevant Organisations') to the public on
> **DATA.GOV.HK**. For the avoidance of doubt, 'Data' include all data, digital
> maps, text, graphics, drawings, diagrams, **photographs**, compilation of
> data and other materials of **DATA.GOV.HK**"

**(b) The JPEGs are published as first-class Data Resources of the dataset,
not as external links.** The dataset lists 3 XML files, 3 CSV files, **1,013
JPEG files** and 1 API. Each JPEG has its own resource page carrying the same
provenance as the catalogue files — Data Provider *Transport Department*,
Format *JPEG*, Update Frequency *Every 2 minutes* — and a direct URL on
`tdcctv.data.one.gov.hk`.

So the imagery is not merely *reachable* from a licensed catalogue; it is
itself the licensed Data. The grant:

> "You are allowed to browse, download, distribute, reproduce, hyperlink to,
> and print the Data for both commercial and non-commercial purposes on a
> free-of-charge basis"

subject to complying with the terms, identifying the source, acknowledging the
Government's and the Relevant Organisations' ownership of the intellectual
property rights, indemnifying them, and giving proper attribution to the
Government, the Relevant Organisations and DATA.GOV.HK.

*Source:* <https://data.gov.hk/en/terms-and-conditions>

## 2. Admission lines

| Line | Finding |
| --- | --- |
| Identity | Transport Department, Government of the Hong Kong SAR, published through DATA.GOV.HK (coordinated by the Digital Policy Office) |
| Access | **none** — no key, no token, no allowlist |
| Registration | **none** |
| Cost | **$0** |
| Licence | DATA.GOV.HK Terms and Conditions of Use v1.2 (26 May 2025). Commercial and non-commercial reuse, redistribution and reproduction permitted free of charge |
| Rights | Browse, download, distribute, reproduce, hyperlink, print. Conditions: comply with the terms, identify the source, acknowledge IP ownership, indemnify, attribute |
| Attribution | Must name the Government, the Relevant Organisation (Transport Department) and DATA.GOV.HK. All three appear in the adapter's attribution string |
| Limits | **No published rate limit.** Recorded as unknown under invariant 5, not guessed |
| Semantics | A JPEG still, 320 x 240, of a road scene from TD CCTV and traffic detectors |
| Coverage | Hong Kong SAR, major roads. ~1,013 cameras across Hong Kong Island, Kowloon and the New Territories. **Not** a national or global source |
| Provenance | Single operator, single image origin. No partner-camera entanglement found |
| Privacy/safety | Low-resolution traffic scenes published by the operator for public situational use. Signalwatch adds no recording, no enhancement and no retention of imagery |

### Documented contract

From the dataset page:

```
Update frequency : Every 2 minutes
Format           : JPEG, 320 x 240
HTTP method      : GET
Method 1         : https://tdcctv.data.one.gov.hk/<Key>.JPG
                   example https://tdcctv.data.one.gov.hk/BC101F.JPG
Method 2         : https://tdcctv.data.one.gov.hk/image?key=<Key>
                   (same JPEG, base64-encoded in XML)
```

Signalwatch uses Method 1: the client loads the provider's JPEG directly, so no
media is proxied and no base64 re-encoding is introduced.

Camera metadata resource (English), with a published data dictionary:

```
https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml
fields: Key, Region, District, Description, Easting, Northing,
        Latitude, Longitude, url
```

*Data dictionary:*
<https://static.data.gov.hk/td/traffic-snapshot-images/en/Summary_of_traffic_snapshot_images.pdf>

This published current-image contract is what earns `live-image` under
invariant 4. The `.JPG` suffix earns nothing.

## 3. Two provider behaviours that shaped the implementation

### "No Service" is an image, not an error

> "If the Traffic Snapshot Images are temporarily unavailable, the 'No Service'
> image will be shown."

This is the opposite of Digitraffic. Digitraffic publishes `collectionStatus`,
`state` and `inCollection` in its catalogue, which is why it became the first
provider able to emit a genuine, provider-sourced `unavailable`. Hong Kong
encodes unavailability **in the pixels** and publishes no per-camera
availability field at all.

Consequence, recorded so it is not mistaken for an oversight: this adapter
**must never emit `unavailable`**. Signalwatch has no catalogue evidence for
that state here, and synthesising it would be fabricating provider state —
precisely what `view-capability.ts` forbids. The honest alternative is to say
so in the record description, which the adapter does, so a user who sees a
"No Service" frame understands it is the provider's own output and not a
Signalwatch failure.

This also sharpens a general lesson: `unavailable` is not a camera-layer
feature to be implemented everywhere. It is a claim that requires a provider
to publish availability, and most do not.

### Redirects are expected

> "HTTP status 301 or 302 may be returned. In this case, redirection should be
> followed and the image should be retrieved from the forwarded URL."

The client loads the image directly and browsers follow redirects natively, so
Signalwatch neither pre-resolves the redirect nor proxies the result. Nothing
in the adapter needs to change for this; it is recorded because a future
"why is the final URL different?" question has a documented answer.

## 4. The partner-camera guard, applied structurally

The WSDOT research produced a general hazard: *a government camera catalogue
can contain other operators' cameras that the publishing authority does not
license.* No evidence of that was found here — every catalogue URL observed is
on the single origin `https://tdcctv.data.one.gov.hk`, and the dataset's Data
Provider is the Transport Department alone.

"No evidence found" is weaker than "cannot happen", so the guard is enforced in
code rather than assumed: a catalogue entry whose URL is **not** on the
documented TD image origin is dropped, not published under TD attribution. The
behaviour is pinned by a test.

## 5. Verification honesty

Outbound TLS from this workspace to arbitrary provider hosts is blocked —
`example.com` fails identically to `static.data.gov.hk` — so **no live request
to the Transport Department was made, and none is claimed.** Everything above
comes from primary provider pages read through the research fetcher.

One consequence: the research fetcher strips XML tags, so the exact element
names in `Traffic_Camera_Locations_En.xml` could not be read, only the field
order and values. The parser therefore keys on the **documented data-dictionary
field names** (case-insensitively, namespace prefixes stripped) and identifies
a record by its documented *content* rather than by a guessed container element
name. If those fields are absent, the parser returns nothing and the provider
reports an honest catalogue failure rather than publishing half-understood
records. That fail-closed path is covered by a test.

## 6. Decision

**ADOPT.** No key, no account, no cost; licence read in primary form and
explicitly covering the imagery as well as the catalogue; a documented
current-image contract; a documented refresh cadence; a single named operator;
and a documented unavailability behaviour that Signalwatch can describe
honestly instead of inventing.

Conditions folded into the implementation rather than left outstanding:

1. Attribution names the Transport Department, the Government of the Hong Kong
   SAR and DATA.GOV.HK.
2. Images are loaded directly by the client; Signalwatch never proxies them.
3. Catalogue entries off the documented TD image origin are dropped.
4. `unavailable` is never emitted; the "No Service" behaviour is described in
   the record instead.
5. Normalisation is bounded.
6. Coverage is described as Hong Kong major roads, never as national or global.
