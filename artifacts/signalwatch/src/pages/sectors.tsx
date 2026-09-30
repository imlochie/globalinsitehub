import {
  Activity,
  Globe,
  Map,
  Network,
  Pause,
  Play,
  Radio,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  InteractiveSectorGlobe,
  type GlobeMode,
} from "@/components/interactive-sector-globe";
import { GlobalLayerControl } from "@/components/global-layer-control";
import { buildLayerPanels } from "@/components/layer-panels";
import { GlobalObservationInspector } from "@/components/global-observation-inspector";
import { SectorPreviewPanel } from "@/components/sector-preview-panel";
import { useGlobalLayerData } from "@/hooks/use-global-layer-data";
import MonitoringPage from "@/pages/monitoring";
import { sampleUpdates, sectors, type SectorId } from "@/lib/sectors";

type SectorEntryView = "workspace" | "map";

const visualizationModes: {
  id: GlobeMode;
  label: string;
  icon: typeof Globe;
}[] = [
  { id: "globe", label: "Globe", icon: Globe },
  { id: "map", label: "2D Map", icon: Map },
  { id: "network", label: "Network", icon: Network },
  { id: "spectrum", label: "Spectrum", icon: Radio },
];

export default function SectorsPage({
  initialView = "workspace",
}: {
  initialView?: SectorEntryView;
}) {
  const [location] = useLocation();
  const queryString = useSearch();
  const [selectedSectorId, setSelectedSectorId] =
    useState<SectorId>("cameras");
  const [visualizationMode, setVisualizationMode] =
    useState<GlobeMode>(() =>
      resolveVisualizationMode(initialView, queryString),
    );
  const [sectorSearch, setSectorSearch] = useState("");
  const [isReplaying, setIsReplaying] = useState(false);
  const [activeUpdateIndex, setActiveUpdateIndex] = useState(0);
  const layerData = useGlobalLayerData();

  const layerPanels = buildLayerPanels(layerData);

  useEffect(() => {
    document.title = "Global layer engine — Signalwatch";
  }, []);

  useEffect(() => {
    setVisualizationMode(resolveVisualizationMode(initialView, queryString));
  }, [initialView, queryString]);

  useEffect(() => {
    const targetId =
      resolveVisualizationMode(initialView, queryString) === "map"
        ? "sector-visualization"
        : window.location.hash === "#sector-operations"
          ? "sector-operations"
          : null;
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialView, location, queryString]);

  useEffect(() => {
    if (!isReplaying) return;
    const timer = window.setInterval(() => {
      setActiveUpdateIndex((index) => (index + 1) % sampleUpdates.length);
    }, 3_200);
    return () => window.clearInterval(timer);
  }, [isReplaying]);

  useEffect(() => {
    setSelectedSectorId(sampleUpdates[activeUpdateIndex]?.sectorId ?? "cameras");
  }, [activeUpdateIndex]);

  const selectedSector =
    sectors.find((sector) => sector.id === selectedSectorId) ?? sectors[0];
  const filteredSectors = useMemo(() => {
    const term = sectorSearch.trim().toLowerCase();
    if (!term) return sectors;
    return sectors.filter((sector) =>
      [sector.title, sector.navLabel, sector.description, sector.detail]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [sectorSearch]);

  function selectSector(sectorId: SectorId) {
    layerData.clearSelectedObservation();
    setSelectedSectorId(sectorId);
    const matchingUpdate = sampleUpdates.findIndex(
      (update) => update.sectorId === sectorId,
    );
    if (matchingUpdate >= 0) setActiveUpdateIndex(matchingUpdate);
  }

  function selectUpdate(index: number) {
    layerData.clearSelectedObservation();
    setActiveUpdateIndex(index);
    setSelectedSectorId(sampleUpdates[index].sectorId);
  }

  return (
    <div className="signal-rise relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#070a10] text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-48 top-40 size-[34rem] rounded-full bg-cyan-700/[0.07] blur-[100px]" />
        <div className="absolute -right-44 top-[28rem] size-[30rem] rounded-full bg-amber-500/[0.045] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-10 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-6 border-b border-white/10 py-7 lg:flex-row lg:items-end lg:justify-between lg:py-9">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.19em] text-slate-400">
              <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
              Global layer engine
              <span className="text-white/20">/</span>
              <span className="text-amber-200/80">
                operational data + illustrative concepts
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-50 sm:text-4xl lg:text-[3.2rem]">
              One global picture.
              <span className="block text-cyan-200/90">
                Nine intelligence sectors.
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-300/65 sm:text-sm sm:leading-6">
              Inspect public camera catalogues and geolocated briefing events.
              The remaining sector markers and replay are navigation concepts,
              not operational data.
            </p>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] sm:min-w-[390px]">
            <SummaryMetric value="02" label="operational layers" />
            <SummaryMetric value="03" label="camera providers" />
            <SummaryMetric value="08" label="preview concepts" />
          </div>
        </section>

        <GlobalLayerControl
          layers={layerPanels}
          className="mt-5"
          title="Operational public-source layers"
          description="Enable bounded public records, inspect provider provenance, and keep feed reachability distinct from catalogue status."
        />

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-mono text-[9px] uppercase tracking-[0.17em] text-slate-300/70">
              Sector field
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              Choose a sector to inspect its interface concept.
            </p>
          </div>
          <label className="relative block w-full md:max-w-[260px]">
            <span className="sr-only">Filter intelligence sectors</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={sectorSearch}
              onChange={(event) => setSectorSearch(event.target.value)}
              placeholder="Filter sectors"
              data-testid="input-filter-sectors"
              className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-9 pr-3 text-[11px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-200/40 focus:ring-2 focus:ring-cyan-200/10"
            />
          </label>
        </div>

        <div className="mt-3 xl:hidden">
          <SectorNavigation
            sectors={filteredSectors}
            selectedSectorId={selectedSectorId}
            onSelect={selectSector}
            compact
          />
          {filteredSectors.length > 3 && (
            <p className="mt-1 pr-1 text-right font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">
              Swipe to view all {filteredSectors.length} sectors{" "}
              <span aria-hidden="true" className="text-cyan-200/70">
                →
              </span>
            </p>
          )}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_330px]">
          <div className="hidden xl:block">
            <SectorNavigation
              sectors={filteredSectors}
              selectedSectorId={selectedSectorId}
              onSelect={selectSector}
            />
          </div>

          <section
            id="sector-visualization"
            className="min-w-0 scroll-mt-20"
            aria-label="Global intelligence visualization"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c1119]/80 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Globe className="size-3.5 text-cyan-200" />
                <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-300/80">
                  Global workspace
                </span>
              </div>
              <Link
                href="/map"
                data-testid="link-open-detailed-map"
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.09em] text-slate-400 transition-colors hover:border-cyan-200/25 hover:text-cyan-100"
              >
                Detailed map
              </Link>
              <div
                className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1"
                role="group"
                aria-label="Visualization mode"
              >
                {visualizationModes.map(({ id, label, icon: Icon }) => {
                  const active = visualizationMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setVisualizationMode(id)}
                      data-testid={`button-view-${id}`}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.09em] transition-colors ${
                        active
                          ? "bg-cyan-200/15 text-cyan-100"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="size-3" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <InteractiveSectorGlobe
              mode={visualizationMode}
              selectedSectorId={selectedSector.id}
              activePulseIndex={activeUpdateIndex}
              onSelectSector={selectSector}
              cameras={layerData.cameraCatalogue.cameras}
              events={
                layerData.isLayerEnabled("public-events")
                  ? layerData.events
                  : []
              }
              eventsLoading={layerData.briefingLoading}
              eventsError={layerData.briefingError}
              observations={layerData.globeObservations}
              selectedObservation={layerData.selectedObservation}
              globeSamples={layerData.globeSamples}
              onSelectObservation={(observation) => {
                layerData.selectObservation(observation);
                if (observation.layerId === "cameras") {
                  setSelectedSectorId("cameras");
                }
              }}
            />
          </section>

          {layerData.selectedObservation ? (
            <GlobalObservationInspector
              observation={layerData.selectedObservation}
              onClear={layerData.clearSelectedObservation}
            />
          ) : (
            <SectorPreviewPanel
              sector={selectedSector}
              cameraLayer={{
                enabled: layerData.isLayerEnabled("cameras"),
                returnedCount: layerData.cameraCatalogue.returnedCount,
                matchedCount: layerData.cameraCatalogue.matchedCount,
                isLoading: layerData.cameraCatalogue.isLoading,
                isUnavailable: layerData.cameraCatalogue.isUnavailable,
                providers: layerData.cameraCatalogue.providers,
                requestedProviderIds:
                  layerData.cameraCatalogue.requestedProviderIds,
              }}
            />
          )}
        </div>

        <GlobalUpdateStream
          activeUpdateIndex={activeUpdateIndex}
          isReplaying={isReplaying}
          onToggleReplay={() => setIsReplaying((current) => !current)}
          onSelectUpdate={selectUpdate}
        />

        <SectorOperationsPanel />

        <p className="mt-5 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-[9px] leading-4 text-slate-500">
          <Activity className="mt-0.5 size-3 shrink-0 text-amber-200/70" />
          Purple sector markers and replay are illustrative only; camera and
          event points use bounded public-source records. Eight sector previews
          do not run searches, scans, tracking, or image analysis. Headlines
          without coordinates remain in the briefing workspace and are never
          assigned fabricated map locations.
        </p>
      </div>
    </div>
  );
}

function SectorOperationsPanel() {
  return (
    <section
      id="sector-operations"
      className="mt-7 scroll-mt-20 border-t border-white/[0.08] pt-6"
      aria-label="Public-source briefing workspace"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
            Public-source operations
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-100">
            Briefing workspace
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Public feeds and source health, kept alongside the sector field.
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-background text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <MonitoringPage />
      </div>
    </section>
  );
}

function SummaryMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 border-r border-white/[0.08] px-3 py-3 last:border-r-0 sm:px-4">
      <div className="font-mono text-lg font-medium tracking-tight text-cyan-100 sm:text-xl">
        {value}
      </div>
      <div className="mt-1 text-[8px] leading-3 text-slate-500 sm:text-[9px]">
        {label}
      </div>
    </div>
  );
}

function resolveVisualizationMode(
  fallback: SectorEntryView,
  queryString = "",
): GlobeMode {
  const requested = new URLSearchParams(queryString).get("view");
  if (requested === "map") return "map";
  if (requested === "workspace") return "globe";
  return fallback === "map" ? "map" : "globe";
}

function SectorNavigation({
  sectors: items,
  selectedSectorId,
  onSelect,
  compact = false,
}: {
  sectors: typeof sectors;
  selectedSectorId: SectorId;
  onSelect: (sectorId: SectorId) => void;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[10px] text-slate-500">
        No sector matches that filter.
      </div>
    );
  }

  if (compact) {
    return (
      <nav
        aria-label="Intelligence sectors"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {items.map((sector) => {
          const active = sector.id === selectedSectorId;
          const Icon = sector.icon;
          return (
            <button
              key={sector.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(sector.id)}
              data-testid={`button-sector-${sector.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-cyan-200/30 bg-cyan-200/[0.09] text-cyan-50"
                  : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-slate-100"
              }`}
            >
              <span className="font-mono text-[8px] text-slate-500">
                {sector.index}
              </span>
              <Icon className={`size-3.5 ${sector.accentClass}`} />
              <span className="text-[10px] font-medium">{sector.navLabel}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Intelligence sectors"
      className="rounded-2xl border border-white/10 bg-[#0c1119]/90 p-2.5"
    >
      <div className="flex items-center justify-between px-2 pb-2.5 pt-1">
        <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">
          Sector navigation
        </span>
        <span className="font-mono text-[8px] text-slate-600">
          {items.length.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((sector) => {
          const active = sector.id === selectedSectorId;
          const Icon = sector.icon;
          return (
            <button
              key={sector.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(sector.id)}
              data-testid={`button-sector-${sector.id}`}
              className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition-all ${
                active
                  ? "border-cyan-200/20 bg-cyan-200/[0.08] shadow-[inset_2px_0_0_0_rgba(103,232,249,0.7)]"
                  : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.035]"
              }`}
            >
              <span className="w-5 font-mono text-[8px] text-slate-600">
                {sector.index}
              </span>
              <Icon
                className={`size-3.5 shrink-0 ${sector.accentClass} ${
                  active ? "opacity-100" : "opacity-70"
                }`}
              />
              <span
                className={`min-w-0 flex-1 truncate text-[10px] ${
                  active ? "font-semibold text-slate-100" : "text-slate-400"
                }`}
              >
                {sector.navLabel}
              </span>
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  sector.status === "connected"
                    ? "bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.65)]"
                    : "bg-slate-700"
                }`}
                aria-label={
                  sector.id === "cameras"
                    ? "Public camera catalogue layer"
                    : "Illustrative preview only"
                }
              />
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-white/[0.07] px-2 pt-3 font-mono text-[7px] uppercase tracking-[0.11em] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-cyan-300" />
          Catalogue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-slate-700" />
          Preview
        </span>
      </div>
    </nav>
  );
}

function GlobalUpdateStream({
  activeUpdateIndex,
  isReplaying,
  onToggleReplay,
  onSelectUpdate,
}: {
  activeUpdateIndex: number;
  isReplaying: boolean;
  onToggleReplay: () => void;
  onSelectUpdate: (index: number) => void;
}) {
  return (
    <section
      className="mt-4 rounded-2xl border border-white/10 bg-[#0c1119]/85 p-3.5 sm:p-4"
      aria-label="Sample global update stream"
      data-testid="sample-update-stream"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 text-amber-200" />
            <h2 className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-200">
              Illustrative sector update replay
            </h2>
            <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-amber-100/80">
              {sampleUpdates[activeUpdateIndex]?.mode === "simulated"
                ? "Simulated"
                : "Status unknown"}
            </span>
          </div>
          <p className="mt-1.5 text-[9px] text-slate-500">
            Replay sample updates across sectors; this is not a live feed.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleReplay}
          aria-pressed={isReplaying}
          data-testid="button-toggle-sample-replay"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[9px] font-semibold transition-colors ${
            isReplaying
              ? "border-amber-200/25 bg-amber-200/[0.08] text-amber-100 hover:bg-amber-200/[0.13]"
              : "border-cyan-200/20 bg-cyan-200/[0.07] text-cyan-100 hover:bg-cyan-200/[0.12]"
          }`}
        >
          {isReplaying ? (
            <Pause className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
          {isReplaying ? "Pause sample replay" : "Replay sample updates"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sampleUpdates.map((update, index) => {
          const active = activeUpdateIndex === index;
          const sector = sectors.find((item) => item.id === update.sectorId);
          return (
            <button
              key={update.id}
              type="button"
              onClick={() => onSelectUpdate(index)}
              aria-pressed={active}
              data-testid={`button-sample-update-${update.id.toLowerCase()}`}
              className={`group flex min-w-0 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-cyan-200/25 bg-cyan-200/[0.055]"
                  : "border-white/[0.07] bg-black/15 hover:border-white/15 hover:bg-white/[0.025]"
              }`}
            >
              <span className="mt-0.5 font-mono text-[8px] text-amber-200/70">
                {update.id}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-500">
                  <span>{update.region}</span>
                  <span className="text-white/15">/</span>
                  <span>{sector?.navLabel}</span>
                </span>
                <span className="mt-1.5 block truncate text-[10px] font-medium text-slate-200/90">
                  {update.title}
                </span>
                <span className="mt-1 block text-[9px] leading-4 text-slate-500">
                  {update.detail}
                </span>
              </span>
              <span
                className={`mt-1 size-1.5 shrink-0 rounded-full ${
                  active ? "bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.7)]" : "bg-slate-700"
                }`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}