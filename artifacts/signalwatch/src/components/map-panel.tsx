import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import type { CameraRecord } from "@workspace/api-client-react";
import type { BriefingEvent } from "@/lib/monitoring";
import {
  buildWmsLayerOptions,
  type RenderableImagery,
} from "@/lib/spatial-layers";
import "leaflet/dist/leaflet.css";
import "./map-panel.css";

const OPENSTREETMAP_TILES =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const EMPTY_CAMERAS: CameraRecord[] = [];
const EMPTY_IMAGERY: RenderableImagery[] = [];

/**
 * CRS codes this map can actually request, mapped to Leaflet's own CRS
 * objects. Leaflet reads `crs.code` to build the WMS CRS/SRS parameter, so a
 * raw string cannot be passed through.
 *
 * Unknown codes are NOT silently coerced to the map's default. Doing so would
 * label the request with one CRS while the bbox was computed in another,
 * which produces a plausible-looking but misplaced overlay — the worst
 * possible failure for a layer whose entire value is being in the right
 * place. An unsupported CRS means the surface is skipped.
 */
const SUPPORTED_CRS: Record<string, L.CRS> = {
  "EPSG:3857": L.CRS.EPSG3857,
  "EPSG:4326": L.CRS.EPSG4326,
};

type SignalMapProps = {
  events: BriefingEvent[];
  cameras?: CameraRecord[];
  selectedCameraId?: string;
  selectedEventId?: string;
  onSelectCamera?: (cameraId: string) => void;
  onSelectEvent?: (eventId: string) => void;
  /**
   * Continuous surfaces to draw beneath the markers.
   *
   * Provider-agnostic by construction: each entry already carries its own
   * service descriptor, bounds, opacity and attribution, so this component
   * contains no condition for any particular provider.
   */
  imagery?: RenderableImagery[];
  compact?: boolean;
  fillContainer?: boolean;
  loading?: boolean;
  error?: boolean;
};

export function SignalMap({
  events,
  cameras = EMPTY_CAMERAS,
  selectedCameraId,
  selectedEventId,
  onSelectCamera,
  onSelectEvent,
  imagery = EMPTY_IMAGERY,
  compact = false,
  fillContainer = false,
  loading = false,
  error = false,
}: SignalMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onSelectCameraRef = useRef(onSelectCamera);
  const onSelectEventRef = useRef(onSelectEvent);
  const locatedEvents = useMemo(
    () =>
      events.filter(
        (event) => getCoordinates(event.latitude, event.longitude) !== null,
      ),
    [events],
  );
  const locatedCameras = useMemo(
    () =>
      cameras.filter((camera) =>
        getCoordinates(camera.latitude, camera.longitude),
      ),
    [cameras],
  );

  useEffect(() => {
    onSelectCameraRef.current = onSelectCamera;
  }, [onSelectCamera]);

  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element) return;

    const map = L.map(element, {
      center: [18, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      preferCanvas: true,
      worldCopyJump: true,
      keyboard: true,
    });
    mapRef.current = map;
    map.attributionControl.setPrefix(false);

    L.tileLayer(OPENSTREETMAP_TILES, {
      subdomains: ["a", "b", "c"],
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const resizeFrame = window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
    });

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /**
   * Raster surfaces.
   *
   * Leaflet's own WMS client does the work. That is a deliberate choice over
   * anything bespoke: it is viewport-driven, so it requests only the tiles
   * the current view needs and re-requests on pan and zoom without this
   * component tracking the extent; it keeps the bytes in the browser's image
   * cache instead of in React state; and it honours a `bounds` option.
   *
   * `bounds` carries the coverage guarantee. Outside the provider's declared
   * areas Leaflet issues no request at all, so there is no code path that
   * can paint a surface over somewhere the provider does not observe. Empty
   * space beyond the coverage edge therefore means "no source here", and the
   * panel says so — it is never a claim that conditions are clear.
   *
   * One Leaflet layer is created per coverage area rather than one for their
   * combined envelope. NOAA's radar regions run from Guam to the Caribbean,
   * so their envelope would include Europe, Africa and Asia; the service
   * would answer those tiles with transparent pixels, which on a map reads
   * as "no precipitation here". Per-area layers make that impossible, and
   * cost nothing: a layer whose bounds miss the viewport requests no tiles.
   *
   * Surfaces are added below the markers so point observations stay readable.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (imagery.length === 0) return;

    const layers = imagery.flatMap((surface) => {
      const crs = SUPPORTED_CRS[surface.service.crs];
      if (!crs) return [];
      const { crs: _requested, ...options } = buildWmsLayerOptions(surface);
      // An empty area list means the product is global: one unclipped layer.
      const clips: Array<L.LatLngBounds | undefined> =
        surface.areas.length > 0
          ? surface.areas.map((area) =>
              L.latLngBounds(
                L.latLng(area.south, area.west),
                L.latLng(area.north, area.east),
              ),
            )
          : [undefined];

      return clips.map((bounds) => {
        const wms = L.tileLayer.wms(surface.service.endpoint, {
          ...options,
          crs,
          // Keep rasters under the marker pane; markers remain clickable.
          pane: "tilePane",
          ...(bounds ? { bounds } : {}),
        });
        wms.addTo(map);
        return wms;
      });
    });

    return () => {
      for (const layer of layers) layer.remove();
    };
  }, [imagery]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);

    for (const event of locatedEvents) {
      const coordinates = getCoordinates(event.latitude, event.longitude);
      if (!coordinates) continue;
      const selected = event.id === selectedEventId;
      const marker = L.circleMarker(coordinates, {
          radius: selected ? 8 : 6,
          color: selected ? "#ffffff" : "#091219",
          weight: selected ? 2.5 : 2,
          fillColor: selected ? "#fff4cf" : "#f1c477",
          fillOpacity: 0.96,
          bubblingMouseEvents: false,
        });
      marker
        .bindTooltip(event.title, {
          direction: "top",
          offset: [0, -6],
          opacity: 0.96,
        })
        .bindPopup(
          createEventPopup(event, selected, () =>
            onSelectEventRef.current?.(event.id),
          ),
          { maxWidth: 280 },
        )
        .addTo(layer);
    }

    for (const camera of locatedCameras) {
      const coordinates = getCoordinates(camera.latitude, camera.longitude);
      if (!coordinates) continue;
      const selected = camera.id === selectedCameraId;
      const marker = L.circleMarker(coordinates, {
          radius: selected ? 7 : 5,
          color: selected ? "#fff0bd" : "#07151c",
          weight: selected ? 2 : 1.5,
          fillColor: selected ? "#f1c477" : "#6cd4dc",
          fillOpacity: 0.94,
          bubblingMouseEvents: false,
        });
      marker
        .bindTooltip(camera.displayName, {
          direction: "top",
          offset: [0, -6],
          opacity: 0.96,
        })
        .bindPopup(
          createCameraPopup(camera, selected, () =>
            onSelectCameraRef.current?.(camera.id),
          ),
          { maxWidth: 280 },
        )
        .addTo(layer);
    }

    return () => {
      layer.remove();
    };
  }, [locatedCameras, locatedEvents, selectedCameraId, selectedEventId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = locatedCameras.find(
      (camera) => camera.id === selectedCameraId,
    );
    if (!selected) return;
    const coordinates = getCoordinates(selected.latitude, selected.longitude);
    if (!coordinates) return;
    map.flyTo(coordinates, Math.max(map.getZoom(), 6), { duration: 0.55 });
  }, [locatedCameras, selectedCameraId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = locatedEvents.find((event) => event.id === selectedEventId);
    if (!selected) return;
    const coordinates = getCoordinates(selected.latitude, selected.longitude);
    if (!coordinates) return;
    map.flyTo(coordinates, Math.max(map.getZoom(), 6), { duration: 0.55 });
  }, [locatedEvents, selectedEventId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compact]);

  return (
    <section
      className={`signal-map relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#081018] ${
        fillContainer
          ? "h-full w-full rounded-none border-0"
          : compact
            ? "h-[260px]"
            : "h-[440px] sm:h-[520px]"
      }`}
      aria-label="Interactive event and camera map"
      data-testid="signal-map"
    >
      <div
        ref={mapElementRef}
        className="absolute inset-0"
        aria-label="Dark OpenStreetMap basemap. Drag to pan and use the plus and minus controls or scroll to zoom."
      />

      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#071019]/90 px-3 py-2 text-[9px] text-slate-200 shadow-lg backdrop-blur">
        <span className="font-mono uppercase tracking-[0.14em] text-slate-100">
          Source coordinates
        </span>
        <span className="text-slate-500">·</span>
        <span>{locatedEvents.length} located events</span>
        {locatedCameras.length > 0 && (
          <>
            <span className="text-slate-500">·</span>
            <span>{locatedCameras.length} cameras</span>
          </>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-[#071019]/90 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-slate-300 shadow-lg backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-300" />
          Events
        </span>
        {locatedCameras.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan-300" />
            Cameras
          </span>
        )}
        <span className="hidden text-slate-500 sm:inline">
          Drag to pan · scroll or controls to zoom
        </span>
      </div>

      {loading && locatedEvents.length === 0 && locatedCameras.length === 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-[500] -translate-y-1/2 text-center">
          <span className="rounded-md border border-white/10 bg-[#071019]/90 px-3 py-2 text-xs text-slate-300 shadow-lg">
            Loading source event coordinates…
          </span>
        </div>
      )}
      {error && locatedEvents.length === 0 && locatedCameras.length === 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-[500] -translate-y-1/2 text-center">
          <span className="rounded-md border border-white/10 bg-[#071019]/90 px-3 py-2 text-xs text-slate-300 shadow-lg">
            Event coordinates are temporarily unavailable
          </span>
        </div>
      )}
      {!loading &&
        !error &&
        locatedEvents.length === 0 &&
        locatedCameras.length === 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-[500] -translate-y-1/2 text-center">
          <span className="rounded-md border border-white/10 bg-[#071019]/90 px-3 py-2 text-xs text-slate-300 shadow-lg">
            No records with valid source coordinates in this view
          </span>
        </div>
        )}
    </section>
  );
}

function getCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): [number, number] | null {
  if (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return [latitude, longitude];
  }
  return null;
}

function createEventPopup(
  event: BriefingEvent,
  selected: boolean,
  onSelect: () => void,
) {
  const container = document.createElement("div");
  container.className = "signal-map-popup";

  const category = document.createElement("div");
  category.className = "signal-map-popup-kicker";
  category.textContent = event.category || "Event";

  const title = document.createElement("div");
  title.className = "signal-map-popup-title";
  title.textContent = event.title;

  const source = document.createElement("div");
  source.className = "signal-map-popup-meta";
  source.textContent = event.source;

  container.append(category, title, source);

  const button = document.createElement("button");
  button.className = "signal-map-popup-button";
  button.type = "button";
  button.textContent = selected ? "Selected public event" : "Inspect event";
  button.disabled = selected;
  button.addEventListener("click", onSelect);
  container.append(button);

  if (event.detail) {
    const detail = document.createElement("p");
    detail.className = "signal-map-popup-detail";
    detail.textContent = event.detail;
    container.append(detail);
  }

  const sourceUrl = safeHttpUrl(event.url);
  if (sourceUrl) {
    const link = document.createElement("a");
    link.className = "signal-map-popup-link";
    link.href = sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open source";
    container.append(link);
  }

  return container;
}

function createCameraPopup(
  camera: CameraRecord,
  selected: boolean,
  onSelect: () => void,
) {
  const container = document.createElement("div");
  container.className = "signal-map-popup";

  const title = document.createElement("div");
  title.className = "signal-map-popup-title";
  title.textContent = camera.displayName;
  container.append(title);

  const location = document.createElement("div");
  location.className = "signal-map-popup-meta";
  location.textContent = [camera.locality, camera.region, camera.countryCode]
    .filter(Boolean)
    .join(", ");
  container.append(location);

  const button = document.createElement("button");
  button.className = "signal-map-popup-button";
  button.type = "button";
  button.textContent = selected ? "Selected camera" : "View camera details";
  button.disabled = selected;
  button.addEventListener("click", onSelect);
  container.append(button);

  return container;
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}