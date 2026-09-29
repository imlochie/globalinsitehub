import { Router, type IRouter } from "express";
import {
  GetMonitoringBriefingQueryParams,
  GetMonitoringBriefingResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const USGS_API =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const EONET_API =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60";
const CACHE_TTL_MS = 60_000;
const NEWS_FEEDS = [
  {
    id: "abc-news",
    name: "ABC News Australia",
    attribution: "ABC News public top-stories RSS feed",
    url: "https://www.abc.net.au/news/feed/51120/rss.xml",
  },
  {
    id: "bbc-world",
    name: "BBC News World",
    attribution: "BBC News public world RSS feed",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    id: "sky-news-world",
    name: "Sky News World",
    attribution: "Sky News public world RSS feed",
    url: "https://feeds.skynews.com/feeds/rss/world.xml",
  },
  {
    id: "al-jazeera",
    name: "Al Jazeera English",
    attribution: "Al Jazeera English public RSS feed",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
] as const;

type Headline = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  language: string;
  imageUrl: string | null;
  summary: string | null;
};

type MonitoredEvent = {
  id: string;
  title: string;
  category: string;
  source: string;
  url: string;
  occurredAt: string;
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  detail: string | null;
};

type SourceStatus = {
  id: string;
  name: string;
  category: string;
  attribution: string;
  url: string;
  status:
    | "online"
    | "unavailable"
    | "configured"
    | "provider-needed"
    | "not-integrated";
  itemsReceived: number;
  checkedAt: string;
  message: string;
};

type PublicFeeds = {
  generatedAt: string;
  headlines: Headline[];
  events: MonitoredEvent[];
  sources: SourceStatus[];
};

type CachedFeeds = {
  expiresAt: number;
  value: PublicFeeds;
};

let cachedFeeds: CachedFeeds | undefined;
let refreshInFlight: Promise<PublicFeeds> | undefined;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(9_000) });
  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(9_000) });
  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`);
  }
  return response.text();
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([\da-f]{1,6});/gi, (_entity, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d{1,7});/g, (_entity, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(xml: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i"),
  );
  return match?.[1] ?? "";
}

function parseRssHeadlines(
  xml: string,
  feed: (typeof NEWS_FEEDS)[number],
): Headline[] {
  const items = xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi);
  const headlines: Headline[] = [];

  for (const match of items) {
    const item = match[1] ?? "";
    const title = decodeXml(xmlTag(item, "title"));
    const url = httpUrl(decodeXml(xmlTag(item, "link")));
    if (!title || !url) continue;

    const publishedAt = new Date(decodeXml(xmlTag(item, "pubDate")));
    const rawSummary = decodeXml(xmlTag(item, "description"));
    headlines.push({
      id: url,
      title,
      source: feed.name,
      url,
      publishedAt: Number.isNaN(publishedAt.getTime())
        ? new Date().toISOString()
        : publishedAt.toISOString(),
      language: "en",
      imageUrl: null,
      summary: rawSummary ? rawSummary.slice(0, 360) : null,
    });
  }

  return headlines;
}

function parseEarthquakes(payload: unknown): MonitoredEvent[] {
  const features = asArray(asRecord(payload).features);

  return features.flatMap((featureValue) => {
    const feature = asRecord(featureValue);
    const properties = asRecord(feature.properties);
    const coordinates = asArray(asRecord(feature.geometry).coordinates);
    const longitude = asNumber(coordinates[0]);
    const latitude = asNumber(coordinates[1]);
    const time = asNumber(properties.time);
    const url = httpUrl(properties.url);
    const id = asText(feature.id);

    if (!id || !url || time === null) return [];

    return [
      {
        id: `usgs-${id}`,
        title: asText(properties.title, "Earthquake"),
        category: "Earthquake",
        source: "USGS Earthquake Hazards Program",
        url,
        occurredAt: new Date(time).toISOString(),
        latitude,
        longitude,
        magnitude: asNumber(properties.mag),
        detail:
          typeof properties.place === "string" ? properties.place : null,
      },
    ];
  });
}

function lastCoordinatePair(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    return [value[0], value[1]];
  }

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const pair = lastCoordinatePair(value[index]);
    if (pair) return pair;
  }
  return null;
}

function parseEonetEvents(payload: unknown): MonitoredEvent[] {
  const events = asArray(asRecord(payload).events);

  return events.flatMap((eventValue) => {
    const event = asRecord(eventValue);
    const id = asText(event.id);
    const title = asText(event.title).trim();
    const geometry = asArray(event.geometry).map(asRecord);
    const latestGeometry = geometry.at(-1) ?? {};
    const coordinates = lastCoordinatePair(latestGeometry.coordinates);
    const sources = asArray(event.sources).map(asRecord);
    const sourceUrl =
      httpUrl(sources[0]?.url) ??
      "https://eonet.gsfc.nasa.gov/api/v3/events";
    const categories = asArray(event.categories).map(asRecord);
    const category = asText(categories[0]?.title, "Natural event");
    const date = asText(latestGeometry.date);
    const occurredAt = new Date(date);

    if (
      !id ||
      !title ||
      !date ||
      Number.isNaN(occurredAt.getTime())
    ) {
      return [];
    }

    return [
      {
        id: `eonet-${id}`,
        title,
        category,
        source: "NASA EONET",
        url: sourceUrl,
        occurredAt: occurredAt.toISOString(),
        latitude: coordinates?.[1] ?? null,
        longitude: coordinates?.[0] ?? null,
        magnitude: asNumber(latestGeometry.magnitudeValue),
        detail:
          typeof event.description === "string" ? event.description : null,
      },
    ];
  });
}

function sourceStatus(
  source: Omit<SourceStatus, "checkedAt">,
  checkedAt: string,
): SourceStatus {
  return { ...source, checkedAt };
}

async function refreshPublicFeeds(): Promise<PublicFeeds> {
  const checkedAt = new Date().toISOString();

  const [newsResults, eventResults] = await Promise.all([
    Promise.allSettled(
      NEWS_FEEDS.map(async (feed) =>
        parseRssHeadlines(await fetchText(feed.url), feed),
      ),
    ),
    Promise.allSettled([
      fetchJson(USGS_API),
      fetchJson(EONET_API),
    ]),
  ]);

  const [earthquakeResult, nasaResult] = eventResults;
  const headlines = [
    ...new Map(
      newsResults
        .flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        )
        .map((headline) => [headline.id, headline]),
    ).values(),
  ].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const earthquakes =
    earthquakeResult.status === "fulfilled"
      ? parseEarthquakes(earthquakeResult.value)
      : [];
  const nasaEvents =
    nasaResult.status === "fulfilled"
      ? parseEonetEvents(nasaResult.value)
      : [];

  const sources: SourceStatus[] = [
    ...NEWS_FEEDS.map((feed, index) => {
      const result = newsResults[index];
      const itemsReceived =
        result?.status === "fulfilled" ? result.value.length : 0;
      return sourceStatus(
        {
          id: feed.id,
          name: feed.name,
          category: "Global news",
          attribution: feed.attribution,
          url: feed.url,
          status:
            result?.status === "fulfilled" ? "online" : "unavailable",
          itemsReceived,
          message:
            result?.status === "fulfilled"
              ? "Publisher headlines link directly to their original reporting."
              : "This publisher RSS feed did not respond. Other sources remain available.",
        },
        checkedAt,
      );
    }),
    sourceStatus(
      {
        id: "usgs",
        name: "USGS Earthquake Hazards Program",
        category: "Earthquakes",
        attribution: "U.S. Geological Survey",
        url: USGS_API,
        status:
          earthquakeResult.status === "fulfilled" ? "online" : "unavailable",
        itemsReceived: earthquakes.length,
        message:
          earthquakeResult.status === "fulfilled"
            ? "Magnitude 2.5+ events from the past 24 hours."
            : "The USGS feed did not respond. Other feeds remain available.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "nasa-eonet",
        name: "NASA EONET",
        category: "Natural events",
        attribution: "NASA Earth Observatory Natural Event Tracker",
        url: EONET_API,
        status: nasaResult.status === "fulfilled" ? "online" : "unavailable",
        itemsReceived: nasaEvents.length,
        message:
          nasaResult.status === "fulfilled"
            ? "Open natural-event records from NASA EONET."
            : "The NASA EONET feed did not respond. Other feeds remain available.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "openstreetmap",
        name: "OpenStreetMap",
        category: "Map",
        attribution: "© OpenStreetMap contributors",
        url: "https://www.openstreetmap.org/copyright",
        status: "configured",
        itemsReceived: 0,
        message:
          "Map tiles are requested from OpenStreetMap and must remain attributed.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "esri-world-imagery",
        name: "Esri World Imagery",
        category: "Satellite basemap",
        attribution:
          "Imagery credited to Esri, Maxar, Earthstar Geographics, and the GIS User Community.",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        status: "configured",
        itemsReceived: 0,
        message:
          "Public imagery tiles can be used as a basemap; this is not a live satellite feed.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "sky-news-live",
        name: "Sky News Live",
        category: "Public live video",
        attribution: "Official Sky News watch page",
        url: "https://news.sky.com/watch-live",
        status: "configured",
        itemsReceived: 0,
        message:
          "Publisher player link. The public page does not expose a reliable live-status API.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "al-jazeera-live",
        name: "Al Jazeera English Live",
        category: "Public live video",
        attribution: "Official Al Jazeera English live page",
        url: "https://www.aljazeera.com/live/",
        status: "configured",
        itemsReceived: 0,
        message:
          "Publisher player link. Playback and current live status are controlled by the publisher.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "ais-provider",
        name: "AIS vessel positions",
        category: "Maritime",
        attribution: "Provider not connected",
        url: "https://www.aishub.net/",
        status: "provider-needed",
        itemsReceived: 0,
        message:
          "A dedicated AIS provider is needed for reliable real-time vessel positions.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "satellite-orbits",
        name: "Satellite orbit positions",
        category: "Satellite tracking",
        attribution: "CelesTrak public orbital-element catalog",
        url: "https://celestrak.org/",
        status: "not-integrated",
        itemsReceived: 0,
        message:
          "Public orbital elements are available, but this version does not calculate live satellite positions.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "camera-provider",
        name: "Public camera streams",
        category: "Video",
        attribution: "Provider not connected",
        url: "https://www.youtube.com/",
        status: "provider-needed",
        itemsReceived: 0,
        message:
          "No camera network is connected. No unverified camera feeds are shown as live.",
      },
      checkedAt,
    ),
    sourceStatus(
      {
        id: "cable-overlay",
        name: "Submarine cable routes",
        category: "Infrastructure",
        attribution: "Source details and reuse terms need review",
        url: "https://www.submarinecablemap.com/",
        status: "provider-needed",
        itemsReceived: 0,
        message:
          "Cable routes are not overlaid until a reusable data source is verified.",
      },
      checkedAt,
    ),
  ];

  return {
    generatedAt: checkedAt,
    headlines,
    events: [...earthquakes, ...nasaEvents].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    ),
    sources,
  };
}

async function getPublicFeeds(): Promise<PublicFeeds> {
  if (cachedFeeds && cachedFeeds.expiresAt > Date.now()) {
    return cachedFeeds.value;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshPublicFeeds()
      .then((value) => {
        cachedFeeds = { value, expiresAt: Date.now() + CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        refreshInFlight = undefined;
      });
  }

  return refreshInFlight;
}

router.get("/monitoring/briefing", async (req, res): Promise<void> => {
  const parsed = GetMonitoringBriefingQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const feeds = await getPublicFeeds();
  const query = parsed.data.q?.trim().toLocaleLowerCase();
  const filterByQuery = <T,>(items: T[], searchText: (item: T) => string) =>
    query
      ? items.filter((item) =>
          searchText(item).toLocaleLowerCase().includes(query),
        )
      : items;
  const headlines = filterByQuery(
    feeds.headlines,
    (item) => `${item.title} ${item.source} ${item.language}`,
  ).slice(0, parsed.data.limit);
  const events = filterByQuery(
    feeds.events,
    (item) =>
      `${item.title} ${item.category} ${item.source} ${item.detail ?? ""}`,
  ).slice(0, parsed.data.limit);

  const response = GetMonitoringBriefingResponse.parse({
    generatedAt: feeds.generatedAt,
    headlineCount: headlines.length,
    eventCount: events.length,
    sourcesOnline: feeds.sources.filter((source) => source.status === "online")
      .length,
    headlines,
    events,
    sources: feeds.sources,
  });

  const unavailableSources = feeds.sources
    .filter((source) => source.status === "unavailable")
    .map((source) => source.id);
  if (unavailableSources.length > 0) {
    req.log.warn({ unavailableSources }, "Some public monitoring feeds are unavailable");
  }

  res.json(response);
});

export default router;