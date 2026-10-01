import {
  Activity,
  Globe,
  Map as MapIcon,
  Network,
  Radio,
  Satellite,
  Signal,
} from "lucide-react";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  sampleUpdates,
  sectors,
  type SectorId,
} from "@/lib/sectors";
import { SignalMap } from "@/components/map-panel";
import type { RenderableImagery } from "@/lib/spatial-layers";
import type { CameraRecord } from "@workspace/api-client-react";
import type { BriefingEvent } from "@/lib/monitoring";
import type {
  GlobalObservation,
  LayerSampleSummary,
  ObservationIdentity,
} from "@/lib/global-layers";
import { selectedIdForLayer } from "@/lib/global-layers";
import { observationMarkerStyle } from "@/lib/observation-style";
import { layerRegistry } from "@/lib/layer-registry";

const SatelliteSectorGlobe = lazy(() =>
  import("@/components/satellite-sector-globe").then((module) => ({
    default: module.SatelliteSectorGlobe,
  })),
);

export type GlobeMode = "globe" | "map" | "network" | "spectrum";

type GlobeRotation = {
  longitude: number;
  latitude: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
};

type SectorGlobeProps = {
  mode: GlobeMode;
  selectedSectorId: SectorId;
  activePulseIndex: number;
  onSelectSector: (sectorId: SectorId) => void;
  cameras: CameraRecord[];
  events: BriefingEvent[];
  eventsLoading: boolean;
  eventsError: boolean;
  observations: GlobalObservation[];
  /** Spatial surfaces, forwarded untouched to the 2D map view. */
  imagery?: RenderableImagery[];
  selectedObservation: GlobalObservation | null;
  /** Per-layer sampling summaries produced by the layer engine. */
  globeSamples: LayerSampleSummary[];
  onSelectObservation: (observation: ObservationIdentity) => void;
};

const initialRotation: GlobeRotation = { longitude: -130, latitude: -14 };

const sectorLocations: {
  id: SectorId;
  latitude: number;
  longitude: number;
}[] = [
  { id: "cameras", latitude: -27.47, longitude: 153.03 },
  { id: "identity", latitude: 40.71, longitude: -74.0 },
  { id: "crypto", latitude: 51.51, longitude: -0.12 },
  { id: "network", latitude: 37.57, longitude: 126.98 },
  { id: "imagery", latitude: -41.29, longitude: 174.78 },
  { id: "spectrum", latitude: 35.68, longitude: 139.69 },
  { id: "movement", latitude: 19.08, longitude: 72.88 },
  { id: "fisherman", latitude: 52.52, longitude: 13.4 },
  { id: "catalogue", latitude: -33.87, longitude: 151.21 },
];

type CountryBoundaryModule = typeof import("@/lib/country-boundaries");

function useCountryBoundaries() {
  const [boundaries, setBoundaries] =
    useState<CountryBoundaryModule | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void import("@/lib/country-boundaries")
      .then((module) => {
        if (isMounted) setBoundaries(module);
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load Natural Earth country boundaries.", loadError);
        if (isMounted) setError(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { boundaries, error };
}

const networkNodes: {
  x: number;
  y: number;
  label: string;
  sectorId: SectorId;
}[] = [
  { x: 115, y: 119, label: "CAMERAS", sectorId: "cameras" },
  { x: 260, y: 82, label: "IDENTITY", sectorId: "identity" },
  { x: 472, y: 88, label: "BLOCKCHAIN", sectorId: "crypto" },
  { x: 645, y: 144, label: "NETWORK", sectorId: "network" },
  { x: 604, y: 310, label: "IMAGERY", sectorId: "imagery" },
  { x: 440, y: 358, label: "SPECTRUM", sectorId: "spectrum" },
  { x: 250, y: 354, label: "MOVEMENT", sectorId: "movement" },
  { x: 106, y: 280, label: "FISHERMAN", sectorId: "fisherman" },
  { x: 370, y: 130, label: "CATALOGUE", sectorId: "catalogue" },
];

const networkCore = { x: 380, y: 224 };

export function InteractiveSectorGlobe({
  mode,
  selectedSectorId,
  activePulseIndex,
  onSelectSector,
  cameras,
  events,
  eventsLoading,
  eventsError,
  observations,
  imagery,
  selectedObservation,
  globeSamples,
  onSelectObservation,
}: SectorGlobeProps) {
  const activeUpdate = sampleUpdates[activePulseIndex % sampleUpdates.length];
  const [webglAvailable, setWebglAvailable] = useState(false);
  useEffect(() => {
    setWebglAvailable(canCreateWebGLContext());
  }, []);
  const fallback = (
    <FallbackGlobeField
      selectedSectorId={selectedSectorId}
      pulsingSectorId={activeUpdate?.sectorId}
      onSelectSector={onSelectSector}
      observations={observations}
      selectedObservation={selectedObservation}
      onSelectObservation={onSelectObservation}
    />
  );

  return (
    <div
      className="relative min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#060a11] shadow-[0_20px_70px_rgba(0,0,0,0.32)] sm:min-h-[390px]"
      data-testid="sector-visualization"
    >
      <div className="pointer-events-none absolute inset-0 signal-grid opacity-[0.18]" />
      <div
        className={`pointer-events-none absolute -left-20 top-12 size-72 blur-[90px] ${
          mode === "globe" ? "rounded-full bg-fuchsia-500/10" : "rounded-full bg-cyan-500/10"
        }`}
      />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-72 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-300/65 sm:left-5 sm:top-5">
        {mode === "globe" ? (
          <Globe className="size-3.5 text-fuchsia-300" />
        ) : mode === "map" ? (
          <MapIcon className="size-3.5 text-cyan-300" />
        ) : mode === "network" ? (
          <Network className="size-3.5 text-cyan-300" />
        ) : (
          <Radio className="size-3.5 text-cyan-300" />
        )}
        {mode === "globe"
          ? "Global public-data field"
          : mode === "map"
            ? "Operational source map"
            : mode === "network"
              ? "Signal relationships"
              : "Spectrum view"}
        <span className="text-white/20">/</span>
        <span className="text-amber-200/80">
          {mode === "globe"
            ? "records + separate sector concepts"
            : mode === "map"
              ? "source coordinates"
              : "illustrative concept"}
        </span>
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/65 sm:right-5 sm:top-5">
        <span
          className={`size-1.5 rounded-full ${
            mode === "globe" || mode === "map"
              ? "bg-cyan-300"
              : "bg-amber-300"
          }`}
        />
        {mode === "globe"
          ? "public records + concept markers"
          : mode === "map"
            ? "public source records"
            : "sample field · not live"}
      </div>

      <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center">
        {mode === "globe" ? (
          <div
            role="group"
            aria-label="Interactive globe with bounded public camera and event points, separate from illustrative sector markers."
            className="relative flex size-full items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fuchsia-200/50"
            data-testid="interactive-globe-canvas"
          >
            {webglAvailable ? (
              <WebGLErrorBoundary fallback={fallback}>
                <Suspense fallback={fallback}>
                  <SatelliteSectorGlobe
                    selectedSectorId={selectedSectorId}
                    pulsingSectorId={activeUpdate?.sectorId}
                    onSelectSector={onSelectSector}
                    observations={observations}
                    selectedObservation={selectedObservation}
                    onSelectObservation={onSelectObservation}
                  />
                </Suspense>
              </WebGLErrorBoundary>
            ) : (
              fallback
            )}
          </div>
        ) : mode === "map" ? (
          <div className="size-full overflow-hidden">
            <SignalMap
              events={events}
              cameras={cameras}
              imagery={imagery}
              selectedCameraId={
                selectedIdForLayer(selectedObservation, "cameras") ?? undefined
              }
              selectedEventId={
                selectedIdForLayer(selectedObservation, "public-events") ??
                undefined
              }
              onSelectCamera={(id) =>
                onSelectObservation({ layerId: "cameras", id })
              }
              onSelectEvent={(id) =>
                onSelectObservation({ layerId: "public-events", id })
              }
              loading={eventsLoading}
              error={eventsError}
              fillContainer
            />
          </div>
        ) : mode === "network" ? (
          <NetworkField
            activeSectorId={activeUpdate?.sectorId}
            selectedSectorId={selectedSectorId}
            onSelectSector={onSelectSector}
          />
        ) : (
          <SpectrumField
            activePoint={activePulseIndex}
            onSelectSector={onSelectSector}
          />
        )}
      </div>

      {mode !== "map" && (
        <>
          <div className="absolute bottom-4 left-4 z-10 flex max-w-[56%] flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-300/55 sm:bottom-5 sm:left-5">
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${mode === "globe" ? "bg-fuchsia-300" : "bg-cyan-300"}`} />
              {mode === "globe" ? "Illustrative sector" : "Sector focus"}
            </span>
            {mode === "globe" ? (
              <>
                {layerRegistry
                  .operational()
                  .filter((definition) => definition.capabilities.globe)
                  .map((definition) => (
                    <span
                      key={String(definition.id)}
                      className="inline-flex items-center gap-1.5"
                      data-testid={`legend-layer-${String(definition.id)}`}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: definition.display.markerColor }}
                      />
                      {definition.display.legendLabel}
                    </span>
                  ))}
                {globeSamples
                  .filter((sample) => sample.omitted > 0)
                  .map((sample) => (
                    <span
                      key={`omitted-${String(sample.layerId)}`}
                      className="text-cyan-100/75"
                      data-testid={`status-globe-marker-cap-${String(sample.layerId)}`}
                    >
                      {sample.omitted.toLocaleString()} more on detailed map
                    </span>
                  ))}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-300" />
                Illustrative demo update
              </span>
            )}
            <span className="hidden sm:inline-flex sm:items-center sm:gap-1.5">
              <Activity className="size-3" />
              Drag · tap marker · arrow keys
            </span>
          </div>

          <div className="absolute bottom-4 right-4 z-10 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-300/35 sm:bottom-5 sm:right-5">
            SW / FIELD 01
          </div>
        </>
      )}
    </div>
  );
}

function FallbackGlobeField({
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

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-fuchsia-200/15 bg-[#11091c]/90 p-1 shadow-lg backdrop-blur"
        role="group"
        aria-label="Fallback Earth style"
      >
        <button
          type="button"
          onClick={() => setTextureMode("signal")}
          aria-pressed={textureMode === "signal"}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] ${
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
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] ${
            textureMode === "satellite"
                ? "bg-fuchsia-200/15 text-fuchsia-100"
                : "text-slate-400 hover:text-fuchsia-100"
          }`}
        >
          <Satellite className="size-3" />
          Satellite
        </button>
      </div>

      <div className="absolute inset-x-3 bottom-10 top-8 flex items-center justify-center">
        {textureMode === "signal" ? (
          <GlobeField
            rotation={initialRotation}
            zoom={1.14}
            selectedSectorId={selectedSectorId}
            pulsingSectorId={pulsingSectorId}
            onSelectSector={onSelectSector}
            observations={observations}
            selectedObservation={selectedObservation}
            onSelectObservation={onSelectObservation}
          />
        ) : (
          <StaticSatelliteField
            selectedSectorId={selectedSectorId}
            pulsingSectorId={pulsingSectorId}
            onSelectSector={onSelectSector}
            observations={observations}
            selectedObservation={selectedObservation}
            onSelectObservation={onSelectObservation}
          />
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 right-4 z-10 rounded-full border border-fuchsia-300/20 bg-[#09050f]/65 px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.12em] text-fuchsia-100/75">
        2D fallback · WebGL unavailable
      </div>
    </div>
  );
}

function StaticSatelliteField({
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
  const { boundaries, error } = useCountryBoundaries();

  return (
    <div className="relative aspect-[2/1] w-full max-w-[760px] overflow-hidden rounded-xl border border-fuchsia-200/15 bg-[#11091c] shadow-[0_18px_60px_rgba(10,2,18,0.5)]">
      <img
        src="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
        alt="Natural-color satellite imagery of Earth with country borders"
        className="absolute inset-0 size-full object-cover"
      />
      <svg
        viewBox="0 0 760 380"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-[1] size-full"
        role="img"
        aria-label="Natural Earth country boundaries"
      >
        {boundaries?.equirectangularCountryPaths.map(({ id, path }) => (
          <path
            key={id}
            d={path}
            fill="none"
            stroke="#d9b5e6"
            strokeOpacity="0.62"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {error && (
        <div
          className="absolute bottom-2 left-2 z-20 rounded border border-amber-200/20 bg-[#050a12]/90 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.1em] text-amber-100"
          role="status"
        >
          Country borders unavailable
        </div>
      )}
      {sectorLocations.map((location) => {
        const selected = location.id === selectedSectorId;
        const pulsing = location.id === pulsingSectorId;
        const sector = sectors.find((item) => item.id === location.id);
        const label = sector?.navLabel ?? location.id;
        return (
          <button
            key={location.id}
            type="button"
            aria-label={`Focus ${label} illustrative marker`}
            aria-pressed={selected}
            onClick={() => onSelectSector(location.id)}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-100"
            style={{
              left: `${((location.longitude + 180) / 360) * 100}%`,
              top: `${((90 - location.latitude) / 180) * 100}%`,
            }}
          >
            <span
              className={`relative block rounded-full border ${
                selected
                  ? "size-3 border-fuchsia-50 bg-fuchsia-300 shadow-[0_0_12px_rgba(216,92,204,0.72)]"
                  : "size-2 border-fuchsia-100/80 bg-fuchsia-300"
              }`}
            >
              {pulsing && (
                <span className="absolute -inset-1 animate-ping rounded-full border border-fuchsia-300/80 motion-reduce:animate-none" />
              )}
            </span>
            {selected && (
              <span className="whitespace-nowrap rounded border border-fuchsia-300/30 bg-[#100719]/95 px-1.5 py-1 font-mono text-[7px] uppercase tracking-[0.1em] text-fuchsia-100">
                {label}
              </span>
            )}
          </button>
        );
      })}
      {observations.map((observation) => {
        const selected = observation.key === selectedObservation?.key;
        const style = observationMarkerStyle(observation);
        return (
          <button
            key={observation.key}
            type="button"
            aria-label={style.actionLabel}
            aria-pressed={selected}
            title={style.tooltip}
            data-testid={`fallback-observation-${observation.key}`}
            onClick={() =>
              onSelectObservation({
                layerId: observation.layerId,
                id: observation.id,
              })
            }
            className="absolute z-20 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{
              left: `${((observation.longitude + 180) / 360) * 100}%`,
              top: `${((90 - observation.latitude) / 180) * 100}%`,
            }}
          >
            <span
              className={`block rounded-full border ${
                selected
                  ? "size-3 border-white bg-white shadow-[0_0_10px_rgba(255,255,255,0.85)]"
                  : style.markerClassName
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function canCreateWebGLContext() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

class WebGLErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GlobeField({
  rotation,
  zoom,
  selectedSectorId,
  pulsingSectorId,
  onSelectSector,
  observations,
  selectedObservation,
  onSelectObservation,
}: {
  rotation: GlobeRotation;
  zoom: number;
  selectedSectorId: SectorId;
  pulsingSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
  observations: GlobalObservation[];
  selectedObservation: GlobalObservation | null;
  onSelectObservation: (observation: ObservationIdentity) => void;
}) {
  const { boundaries, error } = useCountryBoundaries();
  const countryPaths = useMemo(
    () =>
      boundaries?.createOrthographicCountryPaths(
        rotation.longitude,
        rotation.latitude,
      ) ?? [],
    [boundaries, rotation.latitude, rotation.longitude],
  );
  const parallels = [-60, -30, 0, 30, 60].map((latitude) =>
    Array.from({ length: 37 }, (_, index) => [
      latitude,
      -180 + index * 10,
    ] as [number, number]),
  );
  const meridians = Array.from({ length: 12 }, (_, index) => {
    const longitude = -165 + index * 30;
    return Array.from({ length: 35 }, (_, pointIndex) => [
      -85 + pointIndex * 5,
      longitude,
    ] as [number, number]);
  });

  return (
    <svg
      viewBox="0 0 760 430"
      className="h-full max-h-[390px] w-full max-w-[760px] select-none"
      role="group"
      aria-label="Globe with public camera and event records plus separate illustrative sector markers"
    >
      <defs>
        <radialGradient id="sector-atmosphere">
          <stop offset="70%" stopColor="#6e2f86" stopOpacity="0" />
          <stop offset="86%" stopColor="#b449b8" stopOpacity="0.06" />
          <stop offset="92%" stopColor="#d45fc7" stopOpacity="0.16" />
          <stop offset="97%" stopColor="#7b3d9c" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#a33cae" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sector-ocean" cx="38%" cy="31%" r="78%">
          <stop offset="0%" stopColor="#41204e" />
          <stop offset="58%" stopColor="#281433" />
          <stop offset="100%" stopColor="#120a1d" />
        </radialGradient>
        <linearGradient id="sector-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#704077" />
          <stop offset="100%" stopColor="#3e214b" />
        </linearGradient>
        <linearGradient id="sector-orbit" x1="0" x2="1">
          <stop offset="0%" stopColor="#b43bb2" stopOpacity="0" />
          <stop offset="50%" stopColor="#e184d8" stopOpacity="0.64" />
          <stop offset="100%" stopColor="#8c3caa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sector-orbit-secondary" x1="0" x2="1">
          <stop offset="0%" stopColor="#8541a8" stopOpacity="0" />
          <stop offset="50%" stopColor="#c764c7" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#a33cae" stopOpacity="0" />
        </linearGradient>
        <filter id="sector-neon-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="sector-globe-clip">
          <circle cx="380" cy="215" r="164" />
        </clipPath>
      </defs>

      <circle
        cx="380"
        cy="215"
        r="183"
        fill="url(#sector-atmosphere)"
        filter="url(#sector-neon-glow)"
      />
      <g transform={`translate(380 215) scale(${zoom}) translate(-380 -215)`}>
        <circle
          cx="380"
          cy="215"
          r="164"
          fill="url(#sector-ocean)"
          stroke="#c96ac8"
          strokeOpacity="0.68"
          strokeWidth="1.8"
          filter="url(#sector-neon-glow)"
        />
        <g clipPath="url(#sector-globe-clip)">
          {parallels.map((points, index) => {
            const projected = projectPolyline(points, rotation);
            return (
              <path
                key={`parallel-${index}`}
                d={projected.path}
                fill="none"
                stroke="#c461c5"
                strokeOpacity={index === 2 ? 0.32 : 0.16}
                strokeWidth={index === 2 ? 1.2 : 0.9}
                filter={index === 2 ? "url(#sector-neon-glow)" : undefined}
              />
            );
          })}
          {meridians.map((points, index) => {
            const projected = projectPolyline(points, rotation);
            return (
              <path
                key={`meridian-${index}`}
                d={projected.path}
                fill="none"
                stroke="#b858bb"
                strokeOpacity={index % 3 === 0 ? 0.24 : 0.14}
                strokeWidth="0.9"
                filter={index % 3 === 0 ? "url(#sector-neon-glow)" : undefined}
              />
            );
          })}
          {countryPaths.map(({ id, path }) => {
            return (
              <path
                key={id}
                d={path}
                fill="url(#sector-land)"
                fillOpacity="0.96"
                stroke="#dc82d6"
                strokeOpacity="0.66"
                strokeWidth="1.15"
                strokeLinejoin="round"
                filter="url(#sector-neon-glow)"
              />
            );
          })}
          {error && (
            <text
              x="380"
              y="407"
              textAnchor="middle"
              fill="#fcd34d"
              fontSize="8"
              fontFamily="DM Mono, monospace"
            >
              COUNTRY BORDERS UNAVAILABLE
            </text>
          )}
          <path
            d="M218 295c53-33 95-44 143-31 58 16 102 14 168-16"
            fill="none"
            stroke="url(#sector-orbit)"
            strokeWidth="1.5"
            opacity="0.92"
            filter="url(#sector-neon-glow)"
          />
        </g>

        <ellipse
          cx="380"
          cy="215"
          rx="220"
          ry="78"
          fill="none"
          stroke="#d279cf"
          strokeOpacity="0.36"
          strokeWidth="1.2"
          filter="url(#sector-neon-glow)"
          transform="rotate(-17 380 215)"
        />
        <ellipse
          cx="380"
          cy="215"
          rx="249"
          ry="108"
          fill="none"
          stroke="url(#sector-orbit-secondary)"
          strokeOpacity="0.66"
          strokeWidth="1"
          filter="url(#sector-neon-glow)"
          transform="rotate(24 380 215)"
        />

        {sectorLocations.map((location) => {
          const point = projectGlobePoint(
            location.latitude,
            location.longitude,
            rotation,
          );
          if (point.depth <= 0.02) return null;

          const selected = location.id === selectedSectorId;
          const pulsing = location.id === pulsingSectorId;
          const sector = sectors.find((item) => item.id === location.id);
          const label = sector?.navLabel ?? location.id;

          return (
            <g
              key={location.id}
              role="button"
              tabIndex={0}
              aria-label={`Focus ${label} sector marker`}
              aria-pressed={selected}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelectSector(location.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectSector(location.id);
                }
              }}
              className="cursor-pointer outline-none focus-visible:opacity-100"
            >
              <circle
                cx={point.x}
                cy={point.y}
                r="13"
                fill="transparent"
                stroke="transparent"
              />
              {pulsing && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="9"
                  fill="none"
                  stroke="#d66bcf"
                  strokeWidth="1.4"
                  filter="url(#sector-neon-glow)"
                  className="animate-ping motion-reduce:animate-none"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={selected ? 5.5 : 3.2}
                fill={selected ? "#ef9ee4" : "#c75bc2"}
                stroke={selected ? "#ffe0f8" : "#e8a1df"}
                strokeWidth={selected ? 1.5 : 0.9}
                opacity={Math.min(1, 0.5 + point.depth * 0.5)}
                filter={selected ? "url(#sector-neon-glow)" : undefined}
              />
              {selected && (
                <text
                  x={point.x + 9}
                  y={point.y - 9}
                  fill="#f0b8e9"
                  fontSize="8"
                  letterSpacing="0.8"
                  fontFamily="DM Mono, monospace"
                  pointerEvents="none"
                >
                  {label.toUpperCase()}
                </text>
              )}
              <title>{`${label} sector · sample location`}</title>
            </g>
          );
        })}
        {observations.map((observation) => {
          const point = projectGlobePoint(
            observation.latitude,
            observation.longitude,
            rotation,
          );
          if (point.depth <= 0.02) return null;
          const selected = observation.key === selectedObservation?.key;
          const style = observationMarkerStyle(observation);
          const sourceLabel = style.tooltip;

          return (
            <g
              key={observation.key}
              role="button"
              tabIndex={0}
              aria-label={style.actionLabel}
              aria-pressed={selected}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelectObservation({
                  layerId: observation.layerId,
                  id: observation.id,
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectObservation({
                    layerId: observation.layerId,
                    id: observation.id,
                  });
                }
              }}
              className="cursor-pointer outline-none focus-visible:opacity-100"
              data-testid={`globe-observation-${observation.key}`}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="transparent"
                stroke="transparent"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={selected ? 4.5 : 2.4}
                fill={selected ? "#f8fafc" : style.markerColor}
                stroke={selected ? "#ffffff" : style.markerStrokeColor}
                strokeWidth={selected ? 1.4 : 0.7}
                opacity={Math.min(1, 0.6 + point.depth * 0.4)}
                filter={selected ? "url(#sector-neon-glow)" : undefined}
              />
              {selected && (
                <text
                  x={point.x + 7}
                  y={point.y - 7}
                  fill={style.markerTextColor}
                  fontSize="7"
                  letterSpacing="0.4"
                  fontFamily="DM Mono, monospace"
                  pointerEvents="none"
                >
                  {observation.label.slice(0, 30).toUpperCase()}
                </text>
              )}
              <title>{sourceLabel}</title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function NetworkField({
  activeSectorId,
  selectedSectorId,
  onSelectSector,
}: {
  activeSectorId?: SectorId;
  selectedSectorId: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
}) {
  return (
    <svg
      viewBox="0 0 760 430"
      className="h-full max-h-[390px] w-full max-w-[760px]"
      role="group"
      aria-label="Selectable network view of the nine intelligence sectors"
    >
      <defs>
        <radialGradient id="network-core">
          <stop offset="0%" stopColor="#47c6d3" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#47c6d3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={networkCore.x} cy={networkCore.y} r="135" fill="url(#network-core)" />
      <circle
        cx={networkCore.x}
        cy={networkCore.y}
        r="16"
        fill="#102d38"
        stroke="#6bdbe4"
        strokeWidth="1.5"
      />
      <text
        x={networkCore.x}
        y={networkCore.y + 31}
        textAnchor="middle"
        fill="#e9d090"
        fontSize="8"
        letterSpacing="1.2"
        fontFamily="DM Mono, monospace"
      >
        GLOBAL
      </text>
      {networkNodes.map((node) => {
        const selected = node.sectorId === selectedSectorId;
        const active = node.sectorId === activeSectorId;
        const sector = sectors.find((item) => item.id === node.sectorId);
        return (
          <g
            key={node.sectorId}
            role="button"
            tabIndex={0}
            aria-label={`Select ${sector?.title ?? node.label} sector`}
            aria-pressed={selected}
            onClick={() => onSelectSector(node.sectorId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectSector(node.sectorId);
              }
            }}
            className="cursor-pointer outline-none"
          >
            <line
              x1={node.x}
              y1={node.y}
              x2={networkCore.x}
              y2={networkCore.y}
              stroke={selected || active ? "#d9b15e" : "#45bac9"}
              strokeOpacity={selected ? 0.75 : active ? 0.55 : 0.22}
              strokeWidth={selected ? 1.5 : 0.8}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r="15"
              fill="transparent"
              stroke="transparent"
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={selected ? 7 : active ? 6 : 4}
              fill={selected || active ? "#f0ce7b" : "#1c5a69"}
              stroke={selected || active ? "#ffe2a2" : "#6bdbe4"}
              strokeWidth={selected ? 1.5 : 0.9}
            />
            <text
              x={node.x}
              y={node.y + 20}
              textAnchor="middle"
              fill={selected ? "#f4dea3" : "#9bb4bf"}
              fontSize="8"
              letterSpacing="1"
              fontFamily="DM Mono, monospace"
              pointerEvents="none"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SpectrumField({
  activePoint,
  onSelectSector,
}: {
  activePoint: number;
  onSelectSector: (sectorId: SectorId) => void;
}) {
  const bars = [42, 88, 54, 119, 73, 148, 64, 106, 45, 132, 80, 57, 99, 48, 122, 67, 92];
  const currentBar = activePoint % bars.length;
  return (
    <svg
      viewBox="0 0 760 430"
      className="h-full max-h-[390px] w-full max-w-[760px] cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label="Select radio-frequency intelligence sector"
      onClick={() => onSelectSector("spectrum")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectSector("spectrum");
        }
      }}
    >
      <defs>
        <linearGradient id="spectrum-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#54d3dc" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#54d3dc" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[90, 160, 230, 300].map((y) => (
        <line
          key={y}
          x1="80"
          y1={y}
          x2="680"
          y2={y}
          stroke="#9eb5c0"
          strokeOpacity="0.12"
          strokeDasharray="3 7"
        />
      ))}
      <path
        d="M80 320 C145 309 160 283 202 290 S263 316 298 272 S345 194 374 248 S420 314 451 249 S499 164 527 223 S569 300 598 258 S639 239 680 190 L680 340 L80 340Z"
        fill="url(#spectrum-fill)"
      />
      <path
        d="M80 320 C145 309 160 283 202 290 S263 316 298 272 S345 194 374 248 S420 314 451 249 S499 164 527 223 S569 300 598 258 S639 239 680 190"
        fill="none"
        stroke="#5bd7df"
        strokeWidth="2"
      />
      {bars.map((height, index) => {
        const x = 104 + index * 34;
        return (
          <rect
            key={x}
            x={x}
            y={330 - height}
            width="4"
            height={height}
            rx="2"
            fill={index === currentBar ? "#eccb78" : "#47c7d5"}
            fillOpacity={index === currentBar ? 0.9 : 0.34}
          />
        );
      })}
      <text x="82" y="366" fill="#91a8b2" fontSize="9" fontFamily="DM Mono, monospace">
        300 MHz
      </text>
      <text x="600" y="366" fill="#91a8b2" fontSize="9" fontFamily="DM Mono, monospace">
        900 MHz
      </text>
      <text x="380" y="391" textAnchor="middle" fill="#d9b15e" fontSize="8" letterSpacing="2" fontFamily="DM Mono, monospace">
        SIMULATED SPECTRUM · NO RECEIVER CONNECTED
      </text>
    </svg>
  );
}

function projectGlobePoint(
  latitude: number,
  longitude: number,
  rotation: GlobeRotation,
): ProjectedPoint {
  const toRadians = Math.PI / 180;
  const lat = latitude * toRadians;
  const lon = normalizeLongitude(longitude + rotation.longitude) * toRadians;
  const tilt = rotation.latitude * toRadians;
  const x3d = Math.cos(lat) * Math.sin(lon);
  const y3d = Math.sin(lat);
  const z3d = Math.cos(lat) * Math.cos(lon);
  const tiltedY = y3d * Math.cos(tilt) - z3d * Math.sin(tilt);
  const depth = y3d * Math.sin(tilt) + z3d * Math.cos(tilt);
  const radius = 164;

  return {
    x: 380 + radius * x3d,
    y: 215 - radius * tiltedY,
    depth,
  };
}

function projectPolyline(
  coordinates: [number, number][],
  rotation: GlobeRotation,
  closed = false,
): { path: string; fullyVisible: boolean } {
  if (coordinates.length < 2) return { path: "", fullyVisible: false };

  const samples: [number, number][] = [];
  const edgeCount = closed ? coordinates.length : coordinates.length - 1;
  for (let edge = 0; edge < edgeCount; edge += 1) {
    const start = coordinates[edge];
    const end = coordinates[(edge + 1) % coordinates.length];
    if (!start || !end) continue;
    const latitudeDelta = end[0] - start[0];
    const longitudeDelta = shortestLongitudeDelta(start[1], end[1]);
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(latitudeDelta), Math.abs(longitudeDelta)) / 5),
    );
    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps;
      samples.push([
        start[0] + latitudeDelta * progress,
        start[1] + longitudeDelta * progress,
      ]);
    }
  }
  if (!closed) {
    const last = coordinates[coordinates.length - 1];
    if (last) samples.push(last);
  }

  let path = "";
  let segmentOpen = false;
  const projected = samples.map(([latitude, longitude]) =>
    projectGlobePoint(latitude, longitude, rotation),
  );
  const fullyVisible = projected.every((point) => point.depth > 0.015);

  for (const point of projected) {
    if (point.depth > 0.015) {
      path += `${segmentOpen ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)} `;
      segmentOpen = true;
    } else {
      segmentOpen = false;
    }
  }
  if (closed && fullyVisible) path += "Z";

  return { path: path.trim(), fullyVisible };
}

function shortestLongitudeDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function normalizeLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
