import "./_group.css";
import "./SatelliteGlobe.css";
import Globe from "react-globe.gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Globe2,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Satellite,
  Signal,
} from "lucide-react";
import { sectors, type SectorId } from "@/lib/sectors";

type Location = {
  id: SectorId;
  name: string;
  lat: number;
  lng: number;
};

const earthTexture =
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";

const locations: Location[] = [
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

const sampleLinks = [
  ["identity", "crypto"],
  ["crypto", "fisherman"],
  ["network", "spectrum"],
  ["movement", "cameras"],
  ["imagery", "catalogue"],
  ["network", "imagery"],
].map(([start, end]) => ({
  start: locations.find((location) => location.id === start)!,
  end: locations.find((location) => location.id === end)!,
}));

const initialView = { lat: 18, lng: 12, altitude: 2.15 };

export function SatelliteGlobe() {
  const [selectedId, setSelectedId] = useState<SectorId>("imagery");
  const [textureMode, setTextureMode] = useState<"signal" | "satellite">(
    "signal",
  );
  const [orbit, setOrbit] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 680, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);

  const selected = locations.find((location) => location.id === selectedId)!;
  const sectorTitle =
    sectors.find((sector) => sector.id === selectedId)?.title ?? selected.name;

  const points = useMemo(
    () =>
      locations.map((location) => ({
        ...location,
        color: location.id === selectedId ? "#f3d38a" : "#67e5e5",
        radius: location.id === selectedId ? 0.48 : 0.3,
      })),
    [selectedId],
  );
  const rings = useMemo(
    () => [{ lat: selected.lat, lng: selected.lng, maxR: 3.1 }],
    [selected.lat, selected.lng],
  );
  const arcs = useMemo(
    () =>
      sampleLinks.map(({ start, end }) => ({
        startLat: start.lat,
        startLng: start.lng,
        endLat: end.lat,
        endLng: end.lng,
      })),
    [],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
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

  useEffect(() => {
    const controls = globeRef.current?.controls?.();
    if (controls) {
      controls.autoRotate = orbit;
      controls.autoRotateSpeed = 0.38;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }
  }, [orbit]);

  const focusLocation = useCallback((location: Location) => {
    globeRef.current?.pointOfView?.(
      { lat: location.lat, lng: location.lng, altitude: 1.7 },
      850,
    );
  }, []);

  const changeZoom = (direction: -1 | 1) => {
    const current = globeRef.current?.pointOfView?.();
    const altitude = current?.altitude ?? initialView.altitude;
    globeRef.current?.pointOfView?.(
      { ...(current ?? initialView), altitude: Math.max(1.25, Math.min(3.4, altitude - direction * 0.28)) },
      350,
    );
  };

  const resetView = () => {
    setOrbit(false);
    globeRef.current?.pointOfView?.(initialView, 700);
  };

  const moveByKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const move = {
      ArrowLeft: { lat: 0, lng: -12 },
      ArrowRight: { lat: 0, lng: 12 },
      ArrowUp: { lat: 8, lng: 0 },
      ArrowDown: { lat: -8, lng: 0 },
    }[event.key];
    if (!move) return;
    event.preventDefault();
    const current = globeRef.current?.pointOfView?.() ?? initialView;
    globeRef.current?.pointOfView?.(
      {
        lat: Math.max(-75, Math.min(75, current.lat + move.lat)),
        lng: current.lng + move.lng,
        altitude: current.altitude,
      },
      250,
    );
  };

  return (
    <main className="swg-shell">
      <header className="swg-topbar">
        <div className="swg-brand">
          <div className="swg-brandmark" aria-hidden="true">
            <Crosshair size={17} strokeWidth={1.4} />
          </div>
          <div>
            <div className="swg-wordmark">SIGNALWATCH</div>
            <div className="swg-brand-caption">FIELD ATLAS / SAMPLE ENVIRONMENT</div>
          </div>
        </div>
        <div className="swg-top-meta">
          <span className="swg-sample-pill"><i /> SAMPLE ONLY · NOT LIVE</span>
          <span className="swg-coordinate">WGS 84&nbsp; / &nbsp;{selected.lat.toFixed(2)}° {selected.lng.toFixed(2)}°</span>
        </div>
      </header>

      <section className="swg-workspace">
        <aside className="swg-rail" aria-label="Sector selection">
          <div className="swg-rail-heading">
            <span>SECTORS</span><span>09</span>
          </div>
          <nav className="swg-sector-list">
            {locations.map((location, index) => {
              const active = location.id === selectedId;
              return (
                <button
                  className={`swg-sector-button${active ? " is-active" : ""}`}
                  key={location.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(location.id);
                    focusLocation(location);
                    setOrbit(false);
                  }}
                  aria-pressed={active}
                >
                  <span className="swg-sector-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="swg-sector-name">{location.name}</span>
                  <span className="swg-sector-dot" />
                </button>
              );
            })}
          </nav>
          <div className="swg-rail-foot">
            <span className="swg-foot-rule" />
            <span>Illustrative locations</span>
          </div>
        </aside>

        <div className="swg-main">
          <div className="swg-heading-row">
            <div>
              <div className="swg-eyebrow"><span className="swg-eyebrow-line" /> GLOBAL SECTOR VIEW</div>
              <h1>Field <em>atlas</em></h1>
            </div>
            <div className="swg-selected">
              <span className="swg-selected-label">SELECTED SECTOR</span>
              <strong>{sectorTitle}</strong>
              <span>{selected.lat.toFixed(2)}° / {selected.lng.toFixed(2)}°</span>
            </div>
          </div>

          <div className="swg-globe-panel">
            <div className="swg-panel-topline">
              <div className="swg-panel-caption"><Globe2 size={13} /> EARTH / WGS 84</div>
              <div className="swg-mode-switch" role="group" aria-label="Earth presentation">
                <span className="swg-mode-label">PRESENTATION</span>
                <button
                  className={textureMode === "signal" ? "is-selected" : ""}
                  type="button"
                  onClick={() => setTextureMode("signal")}
                  aria-pressed={textureMode === "signal"}
                ><Signal size={13} /> Signal</button>
                <button
                  className={textureMode === "satellite" ? "is-selected" : ""}
                  type="button"
                  onClick={() => setTextureMode("satellite")}
                  aria-pressed={textureMode === "satellite"}
                ><Satellite size={13} /> Satellite</button>
              </div>
            </div>

            <div
              ref={containerRef}
              className={`swg-globe-stage ${textureMode === "signal" ? "signal-mode" : "satellite-mode"}`}
              tabIndex={0}
              onKeyDown={moveByKey}
              aria-label="Interactive Earth globe. Drag to rotate, use arrow keys to move, and select a marker."
            >
              <div className="swg-globe-wash" />
              <Globe
                ref={globeRef}
                width={dimensions.width}
                height={dimensions.height}
                globeImageUrl={earthTexture}
                backgroundColor="rgba(0,0,0,0)"
                showAtmosphere
                atmosphereColor="#4ddce6"
                atmosphereAltitude={0.14}
                pointsData={points}
                pointLat="lat"
                pointLng="lng"
                pointColor="color"
                pointRadius="radius"
                pointAltitude={0.012}
                pointResolution={10}
                pointLabel={(point: Location) => `${point.name} · illustrative sector`}
                onPointClick={(point: Location) => {
                  setSelectedId(point.id);
                  setOrbit(false);
                }}
                ringsData={rings}
                ringLat="lat"
                ringLng="lng"
                ringColor={() => (t: number) => `rgba(105, 232, 231, ${1 - t})`}
                ringMaxRadius="maxR"
                ringPropagationSpeed={1.5}
                ringRepeatPeriod={1700}
                arcsData={arcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor={() => ["rgba(88, 225, 229, 0.1)", "rgba(88, 225, 229, 0.72)"]}
                arcAltitude={0.16}
                arcStroke={0.45}
                arcDashLength={0.24}
                arcDashGap={0.76}
                arcDashAnimateTime={0}
                enablePointerInteraction
                onGlobeReady={() => {
                  globeRef.current?.pointOfView?.(initialView, 0);
                }}
              />
              <div className="swg-globe-vignette" />
              <div className="swg-lat-mark">N 90°</div>
              <div className="swg-long-mark">0° / 180°</div>
              <div className="swg-center-tag"><span /> {sectorTitle.toUpperCase()} FOCUS</div>
              <div className="swg-control-stack" aria-label="Globe controls">
                <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => changeZoom(1)}><Plus size={15} /></button>
                <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => changeZoom(-1)}><Minus size={15} /></button>
                <span className="swg-control-divider" />
                <button type="button" aria-label="Reset globe view" title="Reset view" onClick={resetView}><RotateCcw size={14} /></button>
              </div>
              <div className="swg-orbit-control">
                <button type="button" className={orbit ? "is-on" : ""} onClick={() => setOrbit((current) => !current)} aria-pressed={orbit}>
                  <span className="swg-orbit-icon"><RotateCcw size={13} /></span>
                  {orbit ? "Pause orbit" : "Auto orbit"}
                </button>
              </div>
            </div>

            <div className="swg-panel-footer">
              <div className="swg-legend">
                <span><i className="swg-legend-point" /> Sector location</span>
                <span><i className="swg-legend-ring" /> Current focus</span>
                <span><i className="swg-legend-line" /> Illustrative link</span>
              </div>
              <div className="swg-gesture-hint"><MousePointer2 size={12} /> Drag to rotate <b>·</b> Arrows to nudge</div>
            </div>
          </div>
          <div className="swg-disclaimer">
            <span className="swg-disclaimer-mark">i</span>
            <span>Illustrative sample only. Markers and links are fixed examples, not live observations or tracking.</span>
            <span className="swg-disclaimer-id">ATLAS / 01</span>
          </div>
        </div>
      </section>
      <div className="swg-bottomline"><span>SIGNALWATCH FIELD CONSOLE</span><span>SECTOR INDEX&nbsp; / &nbsp;{String(locations.findIndex((item) => item.id === selectedId) + 1).padStart(2, "0")} OF 09</span></div>
    </main>
  );
}