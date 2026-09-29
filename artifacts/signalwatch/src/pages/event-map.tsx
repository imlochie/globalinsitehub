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
import { CameraLayerControls } from "@/components/camera-layer-controls";
import { CameraList } from "@/components/camera-list";
import { SignalMap } from "@/components/map-panel";
import { useBriefing } from "@/hooks/use-briefing";
import {
  useCameraCatalogue,
  type CameraCountry,
  type CameraProviderSelection,
} from "@/hooks/use-camera-catalogue";
import {
  formatAbsoluteTime,
  formatRelativeTime,
  type BriefingEvent,
} from "@/lib/monitoring";

export default function EventMapPage() {
  const { briefing, isLoading, isError, isFetching, refetch } = useBriefing(60);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [locatedOnly, setLocatedOnly] = useState(false);
  const [cameraLayerEnabled, setCameraLayerEnabled] = useState(true);
  const [cameraCountry, setCameraCountry] = useState<CameraCountry>("AU");
  const [cameraProvider, setCameraProvider] =
    useState<CameraProviderSelection>("all");
  const [cameraSearch, setCameraSearch] = useState("");
  const [debouncedCameraSearch, setDebouncedCameraSearch] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"events" | "cameras">("events");

  useEffect(() => {
    document.title = "Event map — Signalwatch";
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCameraSearch(cameraSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [cameraSearch]);

  const cameraCatalogue = useCameraCatalogue({
    enabled: cameraLayerEnabled,
    country: cameraCountry,
    provider: cameraProvider,
    search: debouncedCameraSearch,
  });

  const categories = useMemo<string[]>(
    () => [
      ...new Set(
        (briefing?.events ?? [])
          .map((event: BriefingEvent) => event.category)
          .filter(Boolean),
      ),
    ],
    [briefing],
  );
  const events = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (briefing?.events ?? []).filter((event: BriefingEvent) => {
      const textMatch =
        !term ||
        [event.title, event.category, event.source, event.detail]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const categoryMatch = category === "all" || event.category === category;
      const locationMatch =
        !locatedOnly || (event.latitude !== null && event.longitude !== null);
      return textMatch && categoryMatch && locationMatch;
    });
  }, [briefing, category, locatedOnly, search]);

  const selectedCamera =
    cameraCatalogue.cameras.find((camera) => camera.id === selectedCameraId) ??
    null;

  function selectCamera(cameraId: string) {
    setSelectedCameraId(cameraId);
    setPanelTab("cameras");
  }

  function changeCameraCountry(country: CameraCountry) {
    setCameraCountry(country);
    setCameraProvider("all");
    setSelectedCameraId(null);
  }

  function changeCameraProvider(provider: CameraProviderSelection) {
    setCameraProvider(provider);
    setSelectedCameraId(null);
  }

  function toggleCameraLayer(enabled: boolean) {
    setCameraLayerEnabled(enabled);
    if (!enabled) {
      setSelectedCameraId(null);
      setPanelTab("events");
    }
  }

  return (
    <div className="signal-rise mx-auto max-w-[1500px] px-4 pb-12 sm:px-6 lg:px-9">
      <section className="flex flex-col gap-5 border-b border-border py-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            event intelligence
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Event map
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Explore geolocated events and public traffic-camera locations.
            Camera snapshots are not checked or proxied by Signalwatch.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <InlineUpdating />}
          <Link
            href="/sectors?view=workspace#sector-operations"
            data-testid="link-back-workspace"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to workspace <ArrowUpRight className="ml-1 inline size-3.5" />
          </Link>
        </div>
      </section>

      {isLoading && (
        <div className="py-8">
          <BriefingLoading />
        </div>
      )}
      {isError && !isLoading && (
        <div className="py-8">
          <BriefingError onRetry={() => void refetch()} />
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
              <button
                type="button"
                onClick={() => setLocatedOnly(!locatedOnly)}
                data-testid="button-filter-located"
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium ${
                  locatedOnly
                    ? "border-foreground/40 bg-foreground text-background"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                <Filter className="size-3.5" /> located only
              </button>
              <span className="hidden items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex">
                <SlidersHorizontal className="size-3" /> {events.length} shown
              </span>
            </div>
          </div>

          <CameraLayerControls
            enabled={cameraLayerEnabled}
            onEnabledChange={toggleCameraLayer}
            country={cameraCountry}
            onCountryChange={changeCameraCountry}
            provider={cameraProvider}
            onProviderChange={changeCameraProvider}
            search={cameraSearch}
            onSearchChange={setCameraSearch}
            matchedCount={cameraCatalogue.matchedCount}
            returnedCount={cameraCatalogue.returnedCount}
            isLoading={cameraCatalogue.isLoading}
            isFetching={cameraCatalogue.isFetching}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <SignalMap
              events={events}
              cameras={
                cameraLayerEnabled ? cameraCatalogue.cameras : []
              }
              selectedCameraId={selectedCamera?.id}
              onSelectCamera={selectCamera}
            />
            <aside>
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
                  disabled={!cameraLayerEnabled}
                  data-testid="tab-map-cameras"
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    panelTab === "cameras"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cameras · {cameraCatalogue.returnedCount}
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
                        !briefing
                          ? "The public event briefing is still loading."
                          : search || category !== "all" || locatedOnly
                            ? "Adjust the filters to inspect more of this briefing."
                            : "The public briefing returned no event records."
                      }
                    />
                  ) : (
                    events.map((event: BriefingEvent) => (
                      <article
                        key={event.id}
                        className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
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
                          <ArrowUpRight className="size-3.5" />
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
                    cameras={cameraCatalogue.cameras}
                    providers={cameraCatalogue.providers}
                    requestedProviderIds={cameraCatalogue.requestedProviderIds}
                    selectedCameraId={selectedCameraId}
                    onSelectCamera={setSelectedCameraId}
                    isLoading={cameraCatalogue.isLoading}
                    hasError={cameraCatalogue.hasError}
                    isUnavailable={cameraCatalogue.isUnavailable}
                    isTruncated={cameraCatalogue.isTruncated}
                    matchedCount={cameraCatalogue.matchedCount}
                    onRetry={cameraCatalogue.refetch}
                  />
                </div>
              )}
            </aside>
          </div>
      </section>
    </div>
  );
}