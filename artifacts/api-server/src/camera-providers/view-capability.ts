import type { CameraRecord } from "@workspace/api-zod";

/**
 * Viewing capability classification.
 *
 * The single rule this enforces: a camera is only described as viewable when
 * the *provider* documents a viewing mechanism. Capability is never inferred
 * from the mere presence of a URL, and a media URL is never constructed.
 *
 * Providers declare what their URL actually is, using `documentedAs`:
 *
 *   current-image  the provider's specification says this URL returns the
 *                  current still image (QLDTraffic `image_url`, TfNSW
 *                  `image_url`)
 *   media          the provider publishes a playable media URL and states its
 *                  format
 *   viewing-page   the provider owns a page for viewing the camera, but
 *                  publishes no embeddable media
 *   unknown        the catalogue lists a location and nothing more
 *
 * Anything `unknown` stays `catalogue-only`. That is deliberately the default:
 * an unviewable camera must never present a play affordance.
 */
export type DocumentedSource =
  | "current-image"
  | "media"
  | "viewing-page"
  | "unknown";

export type ViewClassification = {
  viewCapability: CameraRecord["viewCapability"];
  mediaUrl: string | null;
  mediaType: CameraRecord["mediaType"];
  viewUrl: string | null;
};

/** Playable-in-a-browser media formats. RTSP and RTMP are deliberately absent. */
function browserPlayableMediaType(
  url: string,
): Exclude<CameraRecord["mediaType"], null | "webpage"> | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (/\.(jpe?g|png|webp)$/.test(pathname)) return "image";
  if (/\.m3u8$/.test(pathname)) return "hls";
  if (/\.(mjpg|mjpeg)$/.test(pathname)) return "mjpeg";
  return null;
}

function httpsUrl(value: string | null): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Providers publish http URLs that work over https; a webview blocks mixed
    // content, so upgrade rather than hand the UI something it cannot load.
    if (url.protocol === "http:") url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

export function classifyViewCapability(input: {
  documentedAs: DocumentedSource;
  /** The URL the provider documents, whatever kind it is. */
  url: string | null;
  /** Provider-owned viewing page, when distinct from `url`. */
  viewingPageUrl?: string | null;
}): ViewClassification {
  const url = httpsUrl(input.url ?? null);
  const viewUrl = httpsUrl(input.viewingPageUrl ?? null);

  if (input.documentedAs === "current-image" && url !== null) {
    return {
      viewCapability: "live-image",
      mediaUrl: url,
      mediaType: "image",
      viewUrl,
    };
  }

  if (input.documentedAs === "media" && url !== null) {
    const mediaType = browserPlayableMediaType(url);
    // A declared media URL that no browser can play is not a stream.
    if (mediaType === null) {
      return {
        viewCapability: viewUrl !== null ? "external-viewer" : "catalogue-only",
        mediaUrl: null,
        mediaType: null,
        viewUrl,
      };
    }
    return {
      viewCapability: mediaType === "image" ? "live-image" : "video-stream",
      mediaUrl: url,
      mediaType,
      viewUrl,
    };
  }

  if (input.documentedAs === "viewing-page") {
    const page = viewUrl ?? url;
    return page !== null
      ? {
          viewCapability: "external-viewer",
          mediaUrl: null,
          mediaType: "webpage",
          viewUrl: page,
        }
      : {
          viewCapability: "catalogue-only",
          mediaUrl: null,
          mediaType: null,
          viewUrl: null,
        };
  }

  return {
    viewCapability: "catalogue-only",
    mediaUrl: null,
    mediaType: null,
    viewUrl,
  };
}
