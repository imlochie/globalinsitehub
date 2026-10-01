import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Satellite,
  Signal,
  Sparkles,
} from "lucide-react";
import { countryFeatures } from "@/lib/country-boundaries";
import { GLOBE_DEFAULT_VIEW } from "@/lib/regional-priority";
import {
  GLOBE_IMAGERY_ALTITUDE,
  GLOBE_IMAGERY_CURVATURE_RESOLUTION,
  globeImagerySignature,
  toGlobeImageryTiles,
  type GlobeImageryTile,
} from "@/lib/globe-imagery";
import type { RenderableImagery } from "@/lib/spatial-layers";
import {
  AmbientLight,
  DoubleSide,
  MeshLambertMaterial,
  TextureLoader,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  SphereGeometry,
} from "three";
import {
  SOLAR_LIVE_REFRESH_MS,
  calculateSolarPosition,
  geoToGlobeVector,
  resolveSolarInstant,
  solarLightPosition,
  type SolarTimeState,
} from "@/lib/solar-geometry";
import type { SectorId } from "@/lib/sectors";
import type {
  GlobalObservation,
  ObservationIdentity,
} from "@/lib/global-layers";
import { observationMarkerStyle } from "@/lib/observation-style";
import type { LayerId } from "@/lib/layer-registry";
import "./satellite-sector-globe.css";

type SectorLocation = {
  id: SectorId;
  name: string;
  lat: number;
  lng: number;
};

type SectorPoint = SectorLocation & {
  color: string;
  radius: number;
  pointType: "sector";
};

type ObservationPoint = GlobalObservation & {
  lat: number;
  lng: number;
  color: string;
  radius: number;
  /** Registry-derived tooltip, so the globe never inspects layer specifics. */
  tooltip: string;
  pointType: "observation";
};

type SectorRing = {
  lat: number;
  lng: number;
  maxR: number;
  kind: "focus" | "sample" | "observation";
  observationLayer?: LayerId;
  observationColor?: string;
};

type GlobePoint = SectorPoint | ObservationPoint;

const signalTexture =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png";
const satelliteTexture =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";

const locations: SectorLocation[] = [
  { id: "cameras", name: "Cameras", lat: -27.47, lng: 153.03 },
  { id: "identity", name: "Identity", lat: 40.71, lng: -74 },
  { id: "crypto", name: "Blockchain", lat: 51.51, lng: -0.12 },
  { id: "network", name: "Network", lat: 37.57, lng: 126.98 },
  { id: "imagery", name: "Imagery", lat: -41.29, lng: 174.78 },
  { id: "spectrum", name: "Spectrum", lat: 35.68, lng: 139.69 },
  { id: "movement", name: "Movement", lat: 19.08, lng: 72.88 },
  { id: "fisherman", name: "Fisherman", lat: 52.52, lng: 13.4 },
  { id: "catalogue", name: "Catalogue", lat: -33.87, lng: 151.21 },
];

const sampleLinks: [SectorId, SectorId][] = [
  ["identity", "crypto"],
  ["crypto", "fisherman"],
  ["network", "spectrum"],
  ["movement", "cameras"],
  ["imagery", "catalogue"],
  ["network", "imagery"],
];

const arcs = sampleLinks.flatMap(([startId, endId]) => {
  const start = locations.find((location) => location.id === startId);
  const end = locations.find((location) => location.id === endId);
  if (!start || !end) return [];
  return [
    {
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
    },
  ];
});

/**
 * Where the globe first faces.
 *
 * Comes from the active regional profile, so the globe and the 2D map share
 * a regional preference without sharing an implementation. This is only the
 * initial camera and the target of the reset control — the user can still
 * rotate anywhere, and no coordinate is transformed.
 */
const initialView = GLOBE_DEFAULT_VIEW;

/**
 * The instant the globe is depicting, as a value that changes rarely.
 *
 * Live mode ticks once a minute, not once a frame. The Earth turns a quarter
 * of a degree in that time, which is invisible at globe scale, and the brief
 * is explicit that the clock must not drive high-frequency React renders.
 *
 * `SolarTimeState` is threaded through rather than read from a clock inside
 * the renderer so that a paused or simulated time can be supplied later
 * without this component changing shape.
 */
function useSolarPosition(timeState: SolarTimeState = { mode: "live" }) {
  const [instant, setInstant] = useState(() => resolveSolarInstant(timeState));

  useEffect(() => {
    if (timeState.mode !== "live") {
      setInstant(resolveSolarInstant(timeState));
      return;
    }
    setInstant(new Date());
    const timer = setInterval(() => setInstant(new Date()), SOLAR_LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [timeState.mode, timeState.mode === "live" ? null : timeState.instant.getTime()]);

  return useMemo(() => calculateSolarPosition(instant), [instant]);
}

export function SatelliteSectorGlobe({
  selectedSectorId,
  pulsingSectorId,
  onSelectSector,
  observations,
  selectedObservation,
  onSelectObservation,
  imagery,
}: {
  selectedSectorId: SectorId;
  pulsingSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  observations: GlobalObservation[];
  selectedObservation: GlobalObservation | null;
  onSelectObservation: (observation: ObservationIdentity) => void;
  /**
   * Admitted spatial surfaces, exactly as the 2D map receives them. The
   * globe re-projects them; it does not re-decide whether they may be drawn.
   */
  imagery?: RenderableImagery[];
}) {
  const [textureMode, setTextureMode] = useState<"signal" | "satellite">(
    "signal",
  );
  const [autoOrbit, setAutoOrbit] = useState(false);
  // Live solar geometry. One source of truth for the light, the marker and
  // the readout, so they cannot disagree about where the Sun is.
  const solar = useSolarPosition();
  const [dimensions, setDimensions] = useState({ width: 680, height: 390 });
  const [globeReady, setGlobeReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const focusedSectorRef = useRef<SectorId | null>(null);
  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: textureMode === "signal" ? "#71477b" : "#ffffff",
        // Emissive is what a surface glows with regardless of lighting, so
        // it is exactly what would erase a terminator. Kept low enough in
        // the stylised mode to preserve its look while letting the night
        // side genuinely darken.
        emissive: textureMode === "signal" ? "#24102f" : "#000000",
        emissiveIntensity: textureMode === "signal" ? 0.06 : 0,
        specular: textureMode === "signal" ? "#c77cc8" : "#ffffff",
        shininess: textureMode === "signal" ? 18 : 24,
      }),
    [textureMode],
  );

  const selectedLocation =
    locations.find((location) => location.id === selectedSectorId) ??
    locations[0]!;
  const points = useMemo<GlobePoint[]>(
    () => [
      ...locations.map((location) => ({
        ...location,
        pointType: "sector" as const,
        color:
          location.id === selectedSectorId
            ? "#eda0e4"
            : location.id === pulsingSectorId
              ? "#d66bcf"
              : "#bb55b8",
        radius:
          location.id === selectedSectorId
            ? 0.52
            : location.id === pulsingSectorId
              ? 0.4
              : 0.29,
      })),
      ...observations.map((observation) => {
        const selected = observation.key === selectedObservation?.key;
        const style = observationMarkerStyle(observation);
        return {
          ...observation,
          lat: observation.latitude,
          lng: observation.longitude,
          pointType: "observation" as const,
          color: selected ? "#ffffff" : style.markerColor,
          tooltip: style.tooltip,
          radius: selected ? 0.32 : 0.075,
        };
      }),
    ],
    [observations, pulsingSectorId, selectedObservation?.key, selectedSectorId],
  );
  const rings = useMemo<SectorRing[]>(() => {
    const selected = locations.find(
      (location) => location.id === selectedSectorId,
    );
    const pulsing = locations.find(
      (location) => location.id === pulsingSectorId,
    );
    return [
      ...(selected
        ? [{ lat: selected.lat, lng: selected.lng, maxR: 3.2, kind: "focus" as const }]
        : []),
      ...(pulsing && pulsing.id !== selected?.id
        ? [{ lat: pulsing.lat, lng: pulsing.lng, maxR: 2.1, kind: "sample" as const }]
        : []),
      ...(selectedObservation
        ? [
            {
              lat: selectedObservation.latitude,
              lng: selectedObservation.longitude,
              maxR: 2.6,
              kind: "observation" as const,
              observationLayer: selectedObservation.layerId,
              observationColor:
                observationMarkerStyle(selectedObservation).markerColor,
            },
          ]
        : []),
    ];
  }, [pulsingSectorId, selectedObservation, selectedSectorId]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setDimensions({
        width: Math.max(280, Math.round(entry.contentRect.width)),
        height: Math.max(260, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * Physical solar illumination.
   *
   * The day/night boundary is NOT drawn. A directional light is placed over
   * the subsolar point and three.js shades the sphere; the terminator is
   * then the great circle where the surface turns away from the light, which
   * is what a terminator physically is. There is no gradient overlay and no
   * second canvas.
   *
   * Ambient light keeps the night side dim rather than black so that country
   * outlines and observation markers stay legible — darkness here is a
   * lighting state, not a loss of data.
   */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !globeReady) return;

    const sun = new DirectionalLight(0xffffff, 3.2);
    const position = solarLightPosition(solar);
    sun.position.set(position.x, position.y, position.z);

    const ambient = new AmbientLight(0xffffff, 0.22);
    globe.lights([ambient, sun]);

    return () => {
      sun.dispose();
      ambient.dispose();
    };
  }, [globeReady, solar]);

  /**
   * The subsolar point — where the Sun is directly overhead.
   *
   * Deliberately a custom layer rather than a point in `pointsData`: that
   * array is sectors and observations, and a calculated planetary position
   * must never enter an observation collection where it could be selected,
   * inspected or counted as a record.
   */
  /**
   * Projected weather surfaces.
   *
   * Keyed on the render signature rather than on the surface array, because
   * a fresh array arrives on every settled view change while the imagery
   * identity usually has not moved. Without this, rotating the globe would
   * rebuild every patch and re-request every texture from NOAA.
   */
  const tiles = useMemo(
    () => toGlobeImageryTiles(imagery ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [globeImagerySignature(toGlobeImageryTiles(imagery ?? []))],
  );

  /**
   * One material per patch, built once per imagery identity.
   *
   * MeshLambertMaterial, not MeshBasicMaterial, is the deliberate choice: a
   * basic material ignores lighting, so radar would glow at full strength
   * across the night side and cut a bright hole in the terminator. A Lambert
   * surface is lit by the same solar light as the Earth beneath it, so
   * weather on the night side is correctly dim and the day/night boundary
   * survives. Weather is subordinate to the lighting model, not an exception
   * to it.
   */
  const [failedTextures, setFailedTextures] = useState<string[]>([]);
  useEffect(() => setFailedTextures([]), [tiles]);

  const tileMaterials = useMemo(() => {
    const loader = new TextureLoader();
    // WebGL refuses to sample a cross-origin texture unless the response is
    // CORS-clean, so this must be set. If NOAA does not return an
    // Access-Control-Allow-Origin header the load fails outright — it does
    // not silently degrade — and the onError path below reports that as a
    // renderer limitation rather than leaving an empty sphere that reads as
    // "no weather". See docs/research/globe-imagery-architecture.md §6.
    loader.setCrossOrigin("anonymous");
    return new Map(
      tiles.map((tile) => [
        tile.key,
        new MeshLambertMaterial({
          map: loader.load(tile.textureUrl, undefined, undefined, () =>
            setFailedTextures((previous) =>
              previous.includes(tile.areaName)
                ? previous
                : [...previous, tile.areaName],
            ),
          ),
          transparent: true,
          opacity: tile.opacity,
          side: DoubleSide,
          depthWrite: false,
        }),
      ]),
    );
  }, [tiles]);

  useEffect(
    () => () => {
      for (const material of tileMaterials.values()) {
        material.map?.dispose();
        material.dispose();
      }
    },
    [tileMaterials],
  );

  const subsolarMarker = useMemo(
    () => [{ lat: solar.subsolarLatitude, lng: solar.subsolarLongitude }],
    [solar],
  );

  useEffect(() => () => globeMaterial.dispose(), [globeMaterial]);

  useEffect(() => {
    if (
      !globeReady ||
      selectedObservation ||
      focusedSectorRef.current === selectedSectorId
    ) {
      return;
    }
    globeRef.current?.pointOfView(
      {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        altitude: 2.15,
      },
      850,
    );
    focusedSectorRef.current = selectedSectorId;
    setAutoOrbit(false);
  }, [
    globeReady,
    selectedLocation.lat,
    selectedLocation.lng,
    selectedObservation?.key,
    selectedSectorId,
  ]);

  useEffect(() => {
    if (!globeReady || !selectedObservation) return;
    setAutoOrbit(false);
    focusedSectorRef.current = null;
    globeRef.current?.pointOfView(
      {
        lat: selectedObservation.latitude,
        lng: selectedObservation.longitude,
        altitude: 2.05,
      },
      850,
    );
  }, [
    globeReady,
    selectedObservation?.key,
    selectedObservation?.latitude,
    selectedObservation?.longitude,
  ]);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.autoRotate = autoOrbit;
    controls.autoRotateSpeed = 0.38;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [autoOrbit, globeReady]);

  function changeZoom(direction: -1 | 1) {
    const current = globeRef.current?.pointOfView();
    if (!current) return;
    const altitude = Math.max(
      1.25,
      Math.min(3.4, current.altitude - direction * 0.28),
    );
    globeRef.current?.pointOfView({ ...current, altitude }, 320);
  }

  function resetView() {
    setAutoOrbit(false);
    globeRef.current?.pointOfView(initialView, 700);
  }

  function focusSurpriseSector() {
    const next =
      locations[Math.floor(Math.random() * locations.length)] ??
      selectedLocation;
    setAutoOrbit(false);
    focusedSectorRef.current = next.id;
    globeRef.current?.pointOfView(
      { lat: next.lat, lng: next.lng, altitude: 2.15 },
      850,
    );
    onSelectSector(next.id);
  }

  function moveByKey(event: KeyboardEvent<HTMLDivElement>) {
    const move = {
      ArrowLeft: { lat: 0, lng: -10 },
      ArrowRight: { lat: 0, lng: 10 },
      ArrowUp: { lat: 7, lng: 0 },
      ArrowDown: { lat: -7, lng: 0 },
    }[event.key];
    if (!move) return;
    event.preventDefault();
    setAutoOrbit(false);
    const current = globeRef.current?.pointOfView() ?? initialView;
    globeRef.current?.pointOfView(
      {
        lat: Math.max(-75, Math.min(75, current.lat + move.lat)),
        lng: current.lng + move.lng,
        altitude: current.altitude,
      },
      250,
    );
  }

  return (
    <div
      ref={containerRef}
      className={`sector-earth-globe ${textureMode === "signal" ? "signal-mode" : "satellite-mode"}`}
      tabIndex={0}
      onKeyDown={moveByKey}
      onPointerDown={() => setAutoOrbit(false)}
      aria-label="Interactive Earth globe. Drag to rotate, select cyan camera and amber public-event records to inspect source data, or select purple illustrative sector markers."
      data-testid="3d-earth-globe"
    >
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl={
          textureMode === "signal" ? signalTexture : satelliteTexture
        }
        globeMaterial={globeMaterial}
        backgroundColor="rgba(0,0,0,0)"
        showGraticules={textureMode === "signal"}
        showAtmosphere={textureMode === "signal"}
        atmosphereColor={textureMode === "signal" ? "#b94bbb" : "#a892b8"}
        atmosphereAltitude={textureMode === "signal" ? 0.13 : 0.09}
        tilesData={tiles}
        tileLat="lat"
        tileLng="lng"
        tileAltitude={GLOBE_IMAGERY_ALTITUDE}
        tileWidth="widthDegrees"
        tileHeight="heightDegrees"
        tileUseGlobeProjection
        tileCurvatureResolution={GLOBE_IMAGERY_CURVATURE_RESOLUTION}
        tileMaterial={(tile: object) =>
          tileMaterials.get((tile as GlobeImageryTile).key)!
        }
        tilesTransitionDuration={0}
        tileLabel={(tile: object) => {
          const patch = tile as GlobeImageryTile;
          return `${patch.areaName} — ${patch.attribution}`;
        }}
        customLayerData={subsolarMarker}
        customThreeObject={() =>
          new Mesh(
            new SphereGeometry(1.6, 12, 12),
            new MeshBasicMaterial({
              color: "#ffe9a8",
              transparent: true,
              opacity: 0.85,
            }),
          )
        }
        customThreeObjectUpdate={(object: unknown, data: unknown) => {
          const { lat, lng } = data as { lat: number; lng: number };
          const point = geoToGlobeVector(lat, lng, 0.012);
          (object as Mesh).position.set(point.x, point.y, point.z);
        }}
        customLayerLabel={() =>
          `Subsolar point — the Sun is directly overhead here. Calculated, not observed.`
        }
        polygonsData={countryFeatures}
        polygonGeoJsonGeometry="geometry"
        polygonCapColor=""
        polygonSideColor=""
        polygonStrokeColor={() =>
          textureMode === "signal"
            ? "rgba(218, 125, 211, 0.72)"
            : "rgba(210, 190, 222, 0.7)"
        }
        polygonAltitude={0.0015}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointRadius="radius"
        pointAltitude={0.012}
        pointResolution={10}
        pointLabel={(point) => {
          const item = point as GlobePoint;
          if (item.pointType === "sector") {
            return `${item.name} · illustrative sector navigation marker`;
          }
          return item.tooltip;
        }}
        onPointClick={(point) => {
          setAutoOrbit(false);
          const item = point as GlobePoint;
          if (item.pointType === "sector") {
            onSelectSector(item.id);
          } else {
            onSelectObservation({
              layerId: item.layerId,
              id: item.id,
            });
          }
        }}
        ringsData={textureMode === "signal" ? rings : []}
        ringLat="lat"
        ringLng="lng"
        ringColor={(ring: object) => (progress: number) => {
          const data = ring as SectorRing;
          const alpha = 0.72 * (1 - progress);
          if (data.kind === "focus") return `rgba(229, 133, 218, ${alpha})`;
          if (data.kind === "observation") {
            return withAlpha(data.observationColor ?? "#94a3b8", alpha);
          }
          return `rgba(176, 91, 184, ${alpha})`;
        }}
        ringMaxRadius="maxR"
        ringPropagationSpeed={1.35}
        ringRepeatPeriod={1800}
        arcsData={textureMode === "signal" ? arcs : []}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => [
          "rgba(190, 79, 181, 0.04)",
          "rgba(219, 113, 207, 0.52)",
        ]}
        arcAltitude={0.16}
        arcStroke={0.42}
        arcDashLength={0.24}
        arcDashGap={0.76}
        arcDashAnimateTime={0}
        enablePointerInteraction
        onGlobeReady={() => setGlobeReady(true)}
      />

      {textureMode === "signal" && (
        <div className="sector-globe-wash pointer-events-none absolute inset-0" />
      )}
      <div className="pointer-events-none absolute left-4 top-4 z-[3]">
        <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-fuchsia-100/70">
          {selectedLocation.name} focus
        </div>
        <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-400/70">
          {textureMode === "signal"
          ? "Topography · country borders · public records + illustrative sectors"
            : "Natural-color satellite · country borders"}
        </div>
        {/*
          The solar readout exists so the illumination is auditable rather
          than merely pretty: the stated subsolar coordinates can be checked
          against any almanac, and they are the same numbers that positioned
          the light. "Calculated" is explicit because this is the one thing
          on the globe that comes from mathematics rather than a provider.
        */}
        <div
          className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-amber-200/60"
          data-testid="text-globe-solar-readout"
        >
          {`Sun overhead ${Math.abs(solar.subsolarLatitude).toFixed(1)}°${
            solar.subsolarLatitude >= 0 ? "N" : "S"
          } ${Math.abs(solar.subsolarLongitude).toFixed(1)}°${
            solar.subsolarLongitude >= 0 ? "E" : "W"
          } · calculated, live UTC`}
        </div>
        {/*
          Surface provenance. The globe must be able to state the same
          source, frame and attribution the 2D panel states; a projection
          difference is allowed, a disagreement about the provider is not.
          When a texture fails, that is said plainly — an undrawn surface is
          a statement about the source, never a report of clear weather.
        */}
        {tiles.length > 0 ? (
          <div
            className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-cyan-200/60"
            data-testid="text-globe-imagery-readout"
          >
            {failedTextures.length > 0
              ? `Radar surface could not be drawn for ${failedTextures.join(", ")} · source unavailable to this renderer, not a report of clear conditions`
              : `${tiles.length} radar surface${tiles.length === 1 ? "" : "s"} · ${
                  tiles[0].time ? `frame ${tiles[0].time}` : "latest frame"
                } · ${tiles[0].attribution}`}
          </div>
        ) : null}
      </div>

      <div
        className="absolute right-3 top-3 z-[4] flex items-center gap-1 rounded-lg border border-fuchsia-200/15 bg-[#11091c]/85 p-1 shadow-lg backdrop-blur"
        role="group"
        aria-label="Earth image style"
      >
        <button
          type="button"
          onClick={() => setTextureMode("signal")}
          aria-pressed={textureMode === "signal"}
          data-testid="button-earth-style-signal"
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] transition-colors ${
            textureMode === "signal"
              ? "bg-fuchsia-200/15 text-fuchsia-100"
              : "text-slate-400 hover:text-fuchsia-100"
          }`}
        >
          <Signal className="size-3" />
          Signal
        </button>
        <button
          type="button"
          onClick={() => setTextureMode("satellite")}
          aria-pressed={textureMode === "satellite"}
          data-testid="button-earth-style-satellite"
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] transition-colors ${
            textureMode === "satellite"
              ? "bg-fuchsia-200/15 text-fuchsia-100"
              : "text-slate-400 hover:text-fuchsia-100"
          }`}
        >
          <Satellite className="size-3" />
          Satellite
        </button>
      </div>

      <div className="absolute bottom-10 left-3 z-[4] flex items-center gap-1.5">
        <GlobeControl
          label={autoOrbit ? "Stop auto orbit" : "Start auto orbit"}
          pressed={autoOrbit}
          onClick={() => setAutoOrbit((current) => !current)}
          icon={autoOrbit ? RotateCcw : RotateCw}
        />
        <GlobeControl
          label="Focus a surprise sector"
          onClick={focusSurpriseSector}
          icon={Sparkles}
          accent
        />
      </div>

      <div className="absolute bottom-10 right-3 z-[4] flex items-center gap-1 rounded-lg border border-fuchsia-200/15 bg-[#11091c]/85 p-1 shadow-lg backdrop-blur">
        <GlobeControl label="Zoom out" onClick={() => changeZoom(-1)} icon={Minus} />
        <GlobeControl label="Zoom in" onClick={() => changeZoom(1)} icon={Plus} />
        <span className="mx-0.5 h-5 w-px bg-fuchsia-100/10" />
        <GlobeControl label="Reset globe view" onClick={resetView} icon={RotateCcw} />
      </div>
    </div>
  );
}

function GlobeControl({
  label,
  onClick,
  icon: Icon,
  pressed,
  accent = false,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Plus;
  pressed?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex size-8 items-center justify-center rounded-md transition-colors ${
        accent
          ? "text-fuchsia-200 hover:bg-fuchsia-300/10"
          : pressed
            ? "bg-fuchsia-200/15 text-fuchsia-100"
            : "text-slate-400 hover:bg-fuchsia-100/[0.07] hover:text-fuchsia-50"
      }`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/** Converts a registry `#rrggbb` marker colour into an rgba ring colour. */
function withAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  const value = Number.parseInt(
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex,
    16,
  );
  if (!Number.isFinite(value)) return `rgba(148, 163, 184, ${alpha})`;
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
