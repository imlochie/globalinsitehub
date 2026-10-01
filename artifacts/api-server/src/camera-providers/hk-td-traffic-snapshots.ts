import type { CameraRecord } from "@workspace/api-zod";
import {
  describeProviderFailure,
  providerFetch,
} from "../lib/provider-fetch";
import { createMemoryCachedCameraProvider } from "./memory-cache";
import { classifyViewCapability } from "./view-capability";

/**
 * Hong Kong Transport Department traffic snapshot images, via DATA.GOV.HK.
 *
 * Admission record: `docs/research/providers/hk-td-traffic-snapshots-admission.md`.
 *
 * Why this cleared admission (all from primary sources):
 *
 *  - **Licence covers the imagery, not just the catalogue.** The DATA.GOV.HK
 *    Terms and Conditions (v1.2, 26 May 2025) permit browse, download,
 *    distribute, reproduce, hyperlink and print "for both commercial and
 *    non-commercial purposes on a free-of-charge basis", and define "Data" to
 *    include "photographs ... and other materials of DATA.GOV.HK". Each of the
 *    ~1,013 JPEGs is published as its own Data Resource of this dataset, so
 *    the media class was evaluated on its own evidence rather than inherited
 *    from the catalogue licence.
 *  - **Documented current-image contract.** The dataset page publishes the
 *    request path `https://tdcctv.data.one.gov.hk/<Key>.JPG` with a worked
 *    example, and states the response is JPEG at 320x240. That published
 *    guarantee is what earns `live-image` under invariant 4 — not the `.JPG`
 *    suffix.
 *  - **Documented refresh cadence.** The dataset and every image resource
 *    declare an update frequency of "Every 2 minutes".
 *  - **No key, no account, no cost.**
 *
 * Two provider behaviours that shape this adapter:
 *
 *  1. **"No Service" is an image, not an error.** The provider states: "If the
 *     Traffic Snapshot Images are temporarily unavailable, the 'No Service'
 *     image will be shown." Unavailability is therefore encoded in the
 *     *pixels*, and is not published in the catalogue. Unlike Digitraffic,
 *     this provider gives Signalwatch no per-camera availability field, so
 *     this adapter must never emit `unavailable` — doing so would be
 *     fabricating provider state. The honest move is to say so in the record
 *     description instead.
 *  2. **Redirects are expected.** "HTTP status 301 or 302 may be returned. In
 *     this case, redirection should be followed and the image should be
 *     retrieved from the forwarded URL." The client loads the image directly
 *     and browsers follow redirects natively, so Signalwatch neither
 *     pre-resolves nor proxies the media.
 */
const PROVIDER_ID = "hk-td-traffic-snapshots";
const PROVIDER_NAME =
  "Hong Kong Transport Department traffic snapshot images";
/** Documented camera location resource (English) for this dataset. */
const LOCATIONS_URL =
  "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml";
/** The one origin the provider documents for snapshot images. */
const IMAGE_ORIGIN = "https://tdcctv.data.one.gov.hk";
const CATALOGUE_URL =
  "https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images";
/**
 * The DATA.GOV.HK terms require identifying the source, acknowledging the
 * Government's and the Relevant Organisation's ownership of the intellectual
 * property rights, and attributing the Government, the Relevant Organisation
 * and DATA.GOV.HK. All three are named here.
 */
const ATTRIBUTION =
  "Source: Transport Department, the Government of the Hong Kong SAR, via DATA.GOV.HK (intellectual property rights owned by the Government and the Transport Department)";
/** Documented on the dataset and on every image resource: "Every 2 minutes". */
const IMAGE_UPDATE_RATE_MS = 2 * 60 * 1000;
/**
 * Bounded normalisation. The published catalogue is ~1,013 cameras; this cap
 * exists so an unexpected upstream change cannot push an unbounded set into
 * the layer. It is deliberately well above the real figure.
 */
const MAX_CAMERAS = 5_000;

/**
 * Field names come from the provider's own data dictionary
 * (`Summary_of_traffic_snapshot_images.pdf`): Key, Region, District,
 * Description, Easting, Northing, Latitude, Longitude, url.
 *
 * Matching is on those documented names only — case-insensitively and with
 * any namespace prefix stripped. No aliases are guessed: if the provider
 * renames a field, this parser returns nothing and the provider reports an
 * honest catalogue failure rather than silently producing partial records.
 */
const REQUIRED_FIELDS = ["key", "latitude", "longitude", "url"] as const;

/** Camera keys observed in the catalogue look like H429F, K809F2, TK110F. */
const CAMERA_KEY = /^[A-Za-z0-9]{3,16}$/;

type XmlFields = Map<string, string>;

type XmlFrame = {
  name: string;
  fields: XmlFields;
  text: string;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g,
    (whole: string, body: string): string => {
      if (body.startsWith("#")) {
        const hex = body[1] === "x" || body[1] === "X";
        const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
        if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return whole;
        try {
          return String.fromCodePoint(code);
        } catch {
          return whole;
        }
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    },
  );
}

/** Lower-cased tag name with any namespace prefix removed. */
function localName(raw: string): string {
  const colon = raw.lastIndexOf(":");
  return (colon === -1 ? raw : raw.slice(colon + 1)).toLowerCase();
}

/**
 * Minimal, dependency-free XML reader that returns the records of the
 * catalogue.
 *
 * A "record" is identified by its *documented content*, not by its container
 * element name: any element whose direct children supply every field in
 * `REQUIRED_FIELDS` is a record. The data dictionary documents the fields, not
 * the wrapper, so keying on the fields is what the provider actually
 * guarantees — and it means a cosmetic rename of the wrapper element cannot
 * break the adapter.
 */
export function extractDocumentedRecords(xml: string): XmlFields[] {
  const cleaned = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    // Treat CDATA as ordinary text rather than markup.
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_whole, body: string) =>
      body.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    );

  const records: XmlFields[] = [];
  const stack: XmlFrame[] = [];
  const tagPattern =
    /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(cleaned)) !== null) {
    if (records.length >= MAX_CAMERAS) break;

    const whole = match[0];
    const closing = match[1] === "/";
    const rawName = match[2] ?? "";
    const selfClosing = match[4] === "/";

    const open = stack[stack.length - 1];
    if (open) open.text += cleaned.slice(cursor, match.index);
    cursor = match.index + whole.length;

    const name = localName(rawName);

    if (closing) {
      const frame = stack.pop();
      if (!frame) continue;
      const parent = stack[stack.length - 1];
      if (frame.fields.size > 0) {
        if (
          REQUIRED_FIELDS.every(
            (field) => (frame.fields.get(field) ?? "").trim() !== "",
          )
        ) {
          records.push(frame.fields);
        }
        continue;
      }
      // A leaf element is one of the record's fields.
      if (parent) parent.fields.set(frame.name, decodeEntities(frame.text).trim());
      continue;
    }

    if (selfClosing) {
      if (open) open.fields.set(name, "");
      continue;
    }

    stack.push({ name, fields: new Map(), text: "" });
  }

  return records;
}

function field(fields: XmlFields, name: string): string | null {
  const value = fields.get(name)?.trim();
  return value ? value : null;
}

function coordinate(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCoordinates(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null &&
    lon !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    // A (0, 0) pair is a placeholder, not a Hong Kong road.
    !(lat === 0 && lon === 0)
  );
}

/**
 * Resolves the snapshot URL for one camera.
 *
 * Returns `null` when the catalogue publishes a URL that is **not** on the
 * documented Transport Department image origin. That is the WSDOT lesson
 * applied structurally: a government camera catalogue can contain other
 * operators' cameras, whose own terms Signalwatch has not read. Rather than
 * redistributing an unexamined third-party feed under TD's attribution, the
 * camera is dropped.
 */
function resolveImageUrl(key: string, published: string | null): string | null {
  if (published !== null) {
    try {
      const url = new URL(published);
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.origin !== IMAGE_ORIGIN) return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  // Fall back only to the request path the provider documents.
  return CAMERA_KEY.test(key) ? `${IMAGE_ORIGIN}/${key}.JPG` : null;
}

export function parseHkTdTrafficSnapshots(xml: string): CameraRecord[] {
  if (typeof xml !== "string" || xml.trim() === "") return [];

  const cameras: CameraRecord[] = [];
  const seen = new Set<string>();

  for (const fields of extractDocumentedRecords(xml)) {
    const key = field(fields, "key");
    if (key === null || !CAMERA_KEY.test(key)) continue;

    const id = `${PROVIDER_ID}-${key}`;
    if (seen.has(id)) continue;

    const latitude = coordinate(field(fields, "latitude"));
    const longitude = coordinate(field(fields, "longitude"));
    if (!isValidCoordinates(latitude, longitude)) continue;

    const mediaUrl = resolveImageUrl(key, field(fields, "url"));
    if (mediaUrl === null) continue;

    seen.add(id);

    const classification = classifyViewCapability({
      // The dataset page documents this path as returning the current JPEG
      // snapshot for the camera, so the contract — not the file extension —
      // is what earns `live-image`.
      documentedAs: "current-image",
      url: mediaUrl,
    });

    const region = field(fields, "region");
    const district = field(fields, "district");
    const description = field(fields, "description");

    cameras.push({
      id,
      provider: PROVIDER_ID,
      displayName: description ?? key,
      description:
        "Traffic snapshot image published by the Hong Kong Transport Department through DATA.GOV.HK. The provider refreshes the image about every 2 minutes and renders its own \"No Service\" frame while a camera is temporarily unavailable, so an out-of-service camera appears as that frame rather than as a missing image.",
      country: "Hong Kong SAR, China",
      countryCode: "HK",
      // Documented as the District Council region and district of the image.
      region,
      subregion: null,
      district,
      locality: null,
      postcode: null,
      latitude: latitude as number,
      longitude: longitude as number,
      // The catalogue publishes no bearing for these cameras.
      direction: null,
      sourceUrl: classification.mediaUrl ?? CATALOGUE_URL,
      encoding: "JPEG",
      format: "IMAGE",
      imageUpdateRateMs:
        classification.viewCapability === "live-image"
          ? IMAGE_UPDATE_RATE_MS
          : null,
      streamKind:
        classification.viewCapability === "live-image" ? "image" : "unknown",
      viewCapability: classification.viewCapability,
      mediaUrl: classification.mediaUrl,
      mediaType: classification.mediaType,
      viewUrl: classification.viewUrl,
      feedStatus: "not-probed",
      publicAccess: "catalogue-listed",
      attribution: ATTRIBUTION,
      catalogueUrl: CATALOGUE_URL,
    } as CameraRecord);
  }

  return cameras;
}

export const hkTdTrafficSnapshotProvider = createMemoryCachedCameraProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  catalogueUrl: CATALOGUE_URL,
  availableMessage:
    "Hong Kong Transport Department traffic snapshot catalogue is available. Images are published by the provider and loaded directly by the client; Signalwatch never proxies them.",
  describeFailure: () =>
    "The Hong Kong Transport Department traffic snapshot catalogue could not be loaded; no camera imagery was requested.",
  async load() {
    const response = await providerFetch(LOCATIONS_URL, {
      accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    });
    if (!response.ok) {
      throw new Error(describeProviderFailure(response.status, PROVIDER_NAME));
    }
    const cameras = parseHkTdTrafficSnapshots(await response.text());
    if (cameras.length === 0) {
      // Fail closed and loudly: the documented data-dictionary fields were not
      // found, so the catalogue shape has changed and must be re-read before
      // any record is published.
      throw new Error(
        `${PROVIDER_NAME} returned no records matching its documented data dictionary.`,
      );
    }
    return { cameras };
  },
});
