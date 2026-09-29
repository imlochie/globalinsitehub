import {
  Activity,
  Globe,
  Minus,
  Network,
  Pause,
  Plus,
  Radio,
  RotateCcw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  sampleUpdates,
  sectors,
  type SectorId,
} from "@/lib/sectors";

export type GlobeMode = "globe" | "network" | "spectrum";

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

const landContours: [number, number][][] = [
  [
    [72, -168], [68, -148], [58, -136], [53, -128], [48, -124], [39, -123],
    [33, -117], [25, -109], [18, -101], [20, -94], [26, -88], [30, -82],
    [38, -78], [44, -67], [52, -57], [60, -63], [68, -84], [71, -112],
  ],
  [
    [12, -81], [8, -75], [1, -69], [-7, -77], [-16, -76], [-23, -71],
    [-32, -72], [-42, -75], [-54, -69], [-49, -60], [-35, -54], [-20, -48],
    [-5, -51], [5, -60], [10, -70],
  ],
  [
    [70, -10], [63, 2], [58, 16], [56, 33], [50, 42], [46, 55], [41, 68],
    [34, 73], [29, 84], [21, 91], [14, 101], [7, 109], [13, 119], [25, 121],
    [35, 128], [43, 136], [52, 145], [61, 159], [69, 170], [73, 140], [70, 96],
  ],
  [
    [37, -17], [33, -4], [27, 4], [21, 12], [15, 24], [9, 35], [3, 43],
    [-6, 41], [-15, 38], [-24, 34], [-33, 26], [-34, 17], [-27, 10], [-15, 12],
    [-5, 7], [5, -2], [14, -15], [25, -16],
  ],
  [
    [-11, 113], [-17, 120], [-16, 130], [-12, 137], [-15, 144], [-20, 150],
    [-28, 153], [-37, 148], [-40, 137], [-36, 128], [-33, 119], [-24, 113],
  ],
  [
    [82, -54], [77, -43], [71, -39], [64, -43], [60, -51], [65, -60],
    [73, -64], [79, -61],
  ],
];

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
}: SectorGlobeProps) {
  const [rotation, setRotation] = useState<GlobeRotation>(initialRotation);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const activeUpdate = sampleUpdates[activePulseIndex % sampleUpdates.length];

  useEffect(() => {
    if (!autoRotate || mode !== "globe") return;
    const timer = window.setInterval(() => {
      setRotation((current) => ({
        ...current,
        longitude: normalizeLongitude(current.longitude + 0.32),
      }));
    }, 40);
    return () => window.clearInterval(timer);
  }, [autoRotate, mode]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setIsDragging(true);
    setAutoRotate(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = {
      ...drag,
      x: event.clientX,
      y: event.clientY,
    };
    if (deltaX === 0 && deltaY === 0) return;

    setRotation((current) => ({
      longitude: normalizeLongitude(current.longitude + deltaX * 0.38),
      latitude: clamp(current.latitude + deltaY * 0.28, -58, 58),
    }));
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleGlobeKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const rotations: Record<string, GlobeRotation> = {
      ArrowLeft: { longitude: -7, latitude: 0 },
      ArrowRight: { longitude: 7, latitude: 0 },
      ArrowUp: { longitude: 0, latitude: -5 },
      ArrowDown: { longitude: 0, latitude: 5 },
    };
    const delta = rotations[event.key];
    if (!delta) return;
    event.preventDefault();
    setAutoRotate(false);
    setRotation((current) => ({
      longitude: normalizeLongitude(current.longitude + delta.longitude),
      latitude: clamp(current.latitude + delta.latitude, -58, 58),
    }));
  }

  function resetGlobe() {
    setRotation(initialRotation);
    setZoom(1);
    setAutoRotate(false);
  }

  function focusRandomSector() {
    const nextSector =
      sectorLocations[Math.floor(Math.random() * sectorLocations.length)];
    if (!nextSector) return;
    setRotation({
      longitude: normalizeLongitude(-nextSector.longitude),
      latitude: clamp(-nextSector.latitude * 0.45, -58, 58),
    });
    setZoom(1.08);
    setAutoRotate(false);
    onSelectSector(nextSector.id);
  }

  function changeZoom(delta: number) {
    setZoom((current) => clamp(Number((current + delta).toFixed(2)), 0.78, 1.26));
  }

  return (
    <div
      className="relative min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#060a11] shadow-[0_20px_70px_rgba(0,0,0,0.32)] sm:min-h-[390px]"
      data-testid="sector-visualization"
    >
      <div className="pointer-events-none absolute inset-0 signal-grid opacity-[0.18]" />
      <div className="pointer-events-none absolute -left-20 top-12 size-72 rounded-full bg-cyan-500/10 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-72 rounded-full bg-amber-500/10 blur-[100px]" />

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-300/65 sm:left-5 sm:top-5">
        {mode === "globe" ? (
          <Globe className="size-3.5 text-cyan-300" />
        ) : mode === "network" ? (
          <Network className="size-3.5 text-cyan-300" />
        ) : (
          <Radio className="size-3.5 text-cyan-300" />
        )}
        {mode === "globe"
          ? "Global field"
          : mode === "network"
            ? "Signal relationships"
            : "Spectrum view"}
        <span className="text-white/20">/</span>
        <span className="text-amber-200/80">illustrative</span>
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/65 sm:right-5 sm:top-5">
        <span className="size-1.5 rounded-full bg-amber-300" />
        Sample field · not live
      </div>

      <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center">
        {mode === "globe" ? (
          <div
            role="group"
            aria-label="Interactive globe. Drag to rotate, use arrow keys to move, and select a marker to open a sector."
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
            onWheel={(event) => {
              event.preventDefault();
              changeZoom(event.deltaY < 0 ? 0.06 : -0.06);
            }}
            onKeyDown={handleGlobeKeys}
            className={`flex size-full items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/50 ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ touchAction: "none" }}
            data-testid="interactive-globe-canvas"
          >
            <GlobeField
              rotation={rotation}
              zoom={zoom}
              selectedSectorId={selectedSectorId}
              pulsingSectorId={activeUpdate?.sectorId}
              onSelectSector={onSelectSector}
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

      {mode === "globe" && (
        <div className="absolute bottom-10 right-3 z-20 flex items-center gap-1 rounded-xl border border-white/10 bg-[#080c13]/90 p-1 shadow-lg backdrop-blur sm:bottom-11 sm:right-4 sm:gap-1.5">
          <GlobeControl
            label="Zoom out"
            onClick={() => changeZoom(-0.12)}
            icon={Minus}
          />
          <span className="min-w-9 text-center font-mono text-[8px] text-slate-400">
            {Math.round(zoom * 100)}%
          </span>
          <GlobeControl
            label="Zoom in"
            onClick={() => changeZoom(0.12)}
            icon={Plus}
          />
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => setAutoRotate((current) => !current)}
            aria-label={autoRotate ? "Stop auto orbit" : "Start auto orbit"}
            aria-pressed={autoRotate}
            title={autoRotate ? "Stop auto orbit" : "Start auto orbit"}
            data-testid="button-globe-auto-orbit"
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              autoRotate
                ? "bg-cyan-200/15 text-cyan-100"
                : "text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
            }`}
          >
            {autoRotate ? (
              <Pause className="size-3.5" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
          </button>
          <GlobeControl
            label="Reset globe"
            onClick={resetGlobe}
            icon={RotateCcw}
          />
          <button
            type="button"
            onClick={focusRandomSector}
            aria-label="Focus a surprise sector"
            title="Focus a surprise sector"
            data-testid="button-globe-surprise"
            className="flex size-8 items-center justify-center rounded-lg text-amber-200 transition-colors hover:bg-amber-200/10 hover:text-amber-100"
          >
            <Sparkles className="size-3.5" />
          </button>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 flex max-w-[56%] flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-300/55 sm:bottom-5 sm:left-5">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-cyan-300" />
          Sector focus
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-300" />
          Demo update
        </span>
        <span className="hidden sm:inline-flex sm:items-center sm:gap-1.5">
          <Activity className="size-3" />
          Drag · tap marker · arrow keys
        </span>
      </div>

      <div className="absolute bottom-4 right-4 z-10 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-300/35 sm:bottom-5 sm:right-5">
        SW / FIELD 01
      </div>
    </div>
  );
}

function GlobeControl({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Plus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function GlobeField({
  rotation,
  zoom,
  selectedSectorId,
  pulsingSectorId,
  onSelectSector,
}: {
  rotation: GlobeRotation;
  zoom: number;
  selectedSectorId: SectorId;
  pulsingSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
}) {
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
      aria-label="Globe with selectable illustrative sector markers"
    >
      <defs>
        <radialGradient id="sector-earth" cx="38%" cy="34%" r="68%">
          <stop offset="0%" stopColor="#173649" />
          <stop offset="56%" stopColor="#0b1e2d" />
          <stop offset="100%" stopColor="#050b13" />
        </radialGradient>
        <radialGradient id="sector-atmosphere">
          <stop offset="70%" stopColor="#3bc4d5" stopOpacity="0" />
          <stop offset="90%" stopColor="#39c1d2" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#39c1d2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sector-orbit" x1="0" x2="1">
          <stop offset="0%" stopColor="#d9b15e" stopOpacity="0" />
          <stop offset="50%" stopColor="#d9b15e" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#d9b15e" stopOpacity="0" />
        </linearGradient>
        <clipPath id="sector-globe-clip">
          <circle cx="380" cy="215" r="164" />
        </clipPath>
      </defs>

      <circle cx="380" cy="215" r="183" fill="url(#sector-atmosphere)" />
      <g transform={`translate(380 215) scale(${zoom}) translate(-380 -215)`}>
        <circle
          cx="380"
          cy="215"
          r="164"
          fill="url(#sector-earth)"
          stroke="#61d8e4"
          strokeOpacity="0.42"
          strokeWidth="1.2"
        />
        <g clipPath="url(#sector-globe-clip)">
          {parallels.map((points, index) => {
            const projected = projectPolyline(points, rotation);
            return (
              <path
                key={`parallel-${index}`}
                d={projected.path}
                fill="none"
                stroke="#7edbe2"
                strokeOpacity={index === 2 ? 0.25 : 0.14}
                strokeWidth={index === 2 ? 1 : 0.75}
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
                stroke="#7edbe2"
                strokeOpacity={index % 3 === 0 ? 0.22 : 0.14}
                strokeWidth="0.75"
              />
            );
          })}
          {landContours.map((points, index) => {
            const projected = projectPolyline(points, rotation, true);
            return (
              <path
                key={`land-${index}`}
                d={projected.path}
                fill={projected.fullyVisible ? "#4ab9bd" : "none"}
                fillOpacity="0.12"
                stroke="#77d5cf"
                strokeOpacity="0.35"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            );
          })}
          <path
            d="M218 295c53-33 95-44 143-31 58 16 102 14 168-16"
            fill="none"
            stroke="url(#sector-orbit)"
            strokeWidth="1.2"
            opacity="0.55"
          />
        </g>

        <ellipse
          cx="380"
          cy="215"
          rx="220"
          ry="78"
          fill="none"
          stroke="#d9b15e"
          strokeOpacity="0.28"
          strokeWidth="1"
          transform="rotate(-17 380 215)"
        />
        <ellipse
          cx="380"
          cy="215"
          rx="249"
          ry="108"
          fill="none"
          stroke="#5dcbd8"
          strokeOpacity="0.13"
          strokeWidth="0.8"
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
                  stroke="#e7c16d"
                  strokeWidth="1"
                  className="animate-ping motion-reduce:animate-none"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={selected ? 5.5 : 3.2}
                fill={selected ? "#f0ce7b" : "#6edce4"}
                stroke={selected ? "#fff0bb" : "#b5f2f4"}
                strokeWidth={selected ? 1.3 : 0.7}
                opacity={Math.min(1, 0.5 + point.depth * 0.5)}
              />
              {selected && (
                <text
                  x={point.x + 9}
                  y={point.y - 9}
                  fill="#f4dea3"
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
