import {
  ArrowUpRight,
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BriefingError, BriefingLoading, EmptyState, InlineUpdating } from "@/components/briefing-states";
import { CameraList } from "@/components/camera-list";
import { GlobalLayerControl } from "@/components/global-layer-control";
import { buildLayerPanels } from "@/components/layer-panels";
import { GlobalObservationInspector } from "@/components/global-observation-inspector";
import { SignalMap } from "@/components/map-panel";
import { useGlobalLayerData } from "@/hooks/use-global-layer-data";
import { normalizePublicEvent, selectedIdForLayer } from "@/lib/global-layers";
import {
  formatAbsoluteTime,
  formatRelativeTime,
  type BriefingEvent,
} from "@/lib/monitoring";

export default function EventMapPage() {
  const layerData = useGlobalLayerData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [panelTab, setPanelTab] = useState<"events" | "cameras">("events");

  useEffect(() => {
    document.title = "Global layer map — Signalwatch";
  }, []);

  const categories = useMemo<string[]>(
    () => [
      ...new Set(
        layerData.events
          .filter((event: BriefingEvent) => normalizePublicEvent(event) !== null)
          .map((event: BriefingEvent) => event.category)
          .filter(Boolean),
      ),
    ],
    [layerData.events],
  );
  const events = useMemo(() => {
    if (!layerData.isLayerEnabled("public-events")) return [];
    const term = search.trim().toLowerCase();
    return layerData.events.filter((event: BriefingEvent) => {
      if (normalizePublicEvent(event) === null) return false;
      const textMatch =
        !term ||
        [event.title, event.category, event.source, event.detail]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const categoryMatch = category === "all" || event.category === category;
      return textMatch && categoryMatch;
    });
  }, [layerData, category, search]);

  const selectedCameraId = selectedIdForLayer(
    layerData.selectedObservation,
    "cameras",
  );
  const selectedEventId = selectedIdForLayer(
    layerData.selectedObservation,
    "public-events",
  );

  function selectCamera(cameraId: string) {
    layerData.selectObservation({ layerId: "cameras", id: cameraId });
    setPanelTab("cameras");
  }

  function selectEvent(eventId: string) {
    layerData.selectObservation({ layerId: "public-events", id: eventId });
    setPanelTab("events");
  }

  const layerPanels = buildLayerPanels(layerData);

  return (
    <div className="signal-rise mx-auto max-w-[1500px] px-4 pb-12 sm:px-6 lg:px-9">
      <section className="flex flex-col gap-5 border-b border-border py-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            public-source operations
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Global layer map
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Inspect geolocated public events and bounded camera-catalogue
            records. Camera feeds are not probed or proxied; headlines without
            coordinates stay in the briefing workspace.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {layerData.isLayerEnabled("public-events") &&
            layerData.briefingFetching &&
            !layerData.briefingLoading && (
            <InlineUpdating />
          )}
          <Link
            href="/sectors?view=workspace#sector-operations"
            data-testid="link-back-workspace"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to workspace <ArrowUpRight className="ml-1 inline size-3.5" />
          </Link>
        </div>
      </section>

      {layerData.isLayerEnabled("public-events") && layerData.briefingLoading && (
        <div className="py-8">
          <BriefingLoading />
        </div>
      )}
      {layerData.isLayerEnabled("public-events") &&
        layerData.briefingError &&
        !layerData.briefingLoading && (
        <div className="py-8">
          <BriefingError
            onRetry={() => void layerData.refetchBriefing()}
          />
        </div>
      )}

      <section className="py-7">
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                data-testid="input-search-events"
                placeholder="Search events, categories, sources"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Filter by category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  data-testid="select-event-category"
                  className="h-9 appearance-none rounded-md border border-input bg-background py-0 pl-3 pr-8 text-xs outline-none focus:border-foreground/40"
                >
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
              <span className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-muted-foreground">
                <Filter className="size-3.5" /> source-located records
              </span>
              <span className="hidden items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex">
                <SlidersHorizontal className="size-3" /> {events.length} shown
              </span>
            </div>
          </div>

          <GlobalLayerControl
            layers={layerPanels}
            className="mb-4 max-w-none"
            title="Operational public-source layers"
            description="Source-backed records only. Catalogue status describes provider metadata; feed reachability is not checked."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <SignalMap
              events={events}
              cameras={layerData.cameraCatalogue.cameras}
              selectedCameraId={selectedCameraId ?? undefined}
              selectedEventId={selectedEventId ?? undefined}
              onSelectCamera={selectCamera}
              onSelectEvent={selectEvent}
              loading={
                layerData.isLayerEnabled("public-events") && layerData.briefingLoading
              }
              error={
                layerData.isLayerEnabled("public-events") && layerData.briefingError
              }
            />
            <aside>
              {layerData.selectedObservation && (
                <div className="mb-3">
                  <GlobalObservationInspector
                    observation={layerData.selectedObservation}
                    onClear={layerData.clearSelectedObservation}
                  />
                </div>
              )}
              <div
                className="mb-3 flex rounded-lg border border-border bg-muted/50 p-1"
                role="tablist"
                aria-label="Map results"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-map-events"
                  aria-selected={panelTab === "events"}
                  aria-controls="panel-map-events"
                  tabIndex={panelTab === "events" ? 0 : -1}
                  onClick={() => setPanelTab("events")}
                  data-testid="tab-map-events"
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    panelTab === "events"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Events · {events.length}
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-map-cameras"
                  aria-selected={panelTab === "cameras"}
                  aria-controls="panel-map-cameras"
                  tabIndex={panelTab === "cameras" ? 0 : -1}
                  onClick={() => setPanelTab("cameras")}
                  disabled={!layerData.isLayerEnabled("cameras")}
                  data-testid="tab-map-cameras"
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    panelTab === "cameras"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cameras · {layerData.cameraCatalogue.returnedCount}
                </button>
              </div>

              {panelTab === "events" ? (
                <div
                  id="panel-map-events"
                  role="tabpanel"
                  aria-labelledby="tab-map-events"
                  className="max-h-[500px] space-y-2 overflow-y-auto pr-1"
                >
                  {events.length === 0 ? (
                    <EmptyState
                      title="No matching events"
                      detail={
                        !layerData.isLayerEnabled("public-events")
                          ? "Enable the public events layer to inspect geolocated records."
                          : layerData.briefingLoading
                            ? "The public event briefing is still loading."
                          : search || category !== "all"
                            ? "Adjust the filters to inspect more of this briefing."
                            : "The public briefing returned no geolocated event records."
                      }
                    />
                  ) : (
                    events.map((event: BriefingEvent) => (
                      <article
                        key={event.id}
                        className={`rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 ${
                          selectedEventId === event.id
                            ? "border-primary/50"
                            : "border-border"
                        }`}
                        data-testid={`event-row-${event.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                            {event.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(event.occurredAt)}
                          </span>
                        </div>
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`link-event-${event.id}`}
                          className="mt-2 block text-sm font-semibold leading-5 hover:text-foreground/70"
                        >
                          {event.title}
                        </a>
                        {event.detail && (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {event.detail}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
                          <span>
                            {event.source} ·{" "}
                            {formatAbsoluteTime(event.occurredAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-pressed={selectedEventId === event.id}
                              onClick={() => selectEvent(event.id)}
                              data-testid={`button-inspect-event-${event.id}`}
                              className="rounded-md border border-border px-2 py-1 text-[9px] font-semibold text-foreground transition-colors hover:bg-muted"
                            >
                              {selectedEventId === event.id
                                ? "Selected"
                                : "Inspect map point"}
                            </button>
                            <ArrowUpRight className="size-3.5" />
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              ) : (
                <div
                  id="panel-map-cameras"
                  role="tabpanel"
                  aria-labelledby="tab-map-cameras"
                  className="max-h-[500px] space-y-2 overflow-y-auto pr-1"
                >
                  <CameraList
                    cameras={layerData.cameraCatalogue.cameras}
                    providers={layerData.cameraCatalogue.providers}
                    requestedProviderIds={
                      layerData.cameraCatalogue.requestedProviderIds
                    }
                    selectedCameraId={selectedCameraId}
                    onSelectCamera={selectCamera}
                    isLoading={layerData.cameraCatalogue.isLoading}
                    hasError={layerData.cameraCatalogue.hasError}
                    isUnavailable={layerData.cameraCatalogue.isUnavailable}
                    isTruncated={layerData.cameraCatalogue.isTruncated}
                    matchedCount={layerData.cameraCatalogue.matchedCount}
                    onRetry={layerData.cameraCatalogue.refetch}
                  />
                </div>
              )}
            </aside>
          </div>
      </section>
    </div>
  );
}