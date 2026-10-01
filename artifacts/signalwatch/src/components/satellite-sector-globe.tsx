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
import { MeshPhongMaterial } from "three";
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

export function SatelliteSectorGlobe({
  selectedSectorId,
  pulsingSectorId,
  onSelectSector,
  observations,
  selectedObservation,
  onSelectObservation,
}: {
  selectedSectorId: SectorId;
  pulsingSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  observations: GlobalObservation[];
  selectedObservation: GlobalObservation | null;
  onSelectObservation: (observation: ObservationIdentity) => void;
}) {
  const [textureMode, setTextureMode] = useState<"signal" | "satellite">(
    "signal",
  );
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 680, height: 390 });
  const [globeReady, setGlobeReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const focusedSectorRef = useRef<SectorId | null>(null);
  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: textureMode === "signal" ? "#71477b" : "#ffffff",
        emissive: textureMode === "signal" ? "#24102f" : "#000000",
        emissiveIntensity: textureMode === "signal" ? 0.2 : 0,
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
