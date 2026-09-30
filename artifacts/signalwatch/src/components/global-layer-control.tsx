import type { ReactNode } from 'react';
import React from 'react';
import {
  Activity,
  Archive,
  Building2,
  Camera,
  ChevronDown,
  CircleAlert,
  Cloud,
  ExternalLink,
  FlaskConical,
  MapPinned,
  Newspaper,
  Radio,
  Satellite,
  Ship,
} from 'lucide-react';
import type { CameraCountry, CameraProviderSelection } from '@/hooks/use-camera-catalogue';
import type { CameraProviderStatus } from '@workspace/api-client-react';

type CameraProviderRow = Pick<
  CameraProviderStatus,
  'id' | 'name' | 'status' | 'feedReachability' | 'attribution' | 'catalogueUrl'
>;

export type GlobalLayerControlCameraControls = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  country: CameraCountry;
  onCountryChange: (country: CameraCountry) => void;
  provider: CameraProviderSelection;
  onProviderChange: (provider: CameraProviderSelection) => void;
  search: string;
  onSearchChange: (search: string) => void;
  providers: CameraProviderRow[];
  requestedProviderIds: string[];
  matchedCount: number;
  returnedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  isUnavailable: boolean;
  isTruncated: boolean;
};

export type GlobalLayerControlEvents = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  isLoading: boolean;
  isError: boolean;
  locatedCount: number;
  recordCount: number;
  headlineCount: number;
  sourcesOnline: number;
  sourceCount: number;
  generatedAt?: string;
};

export type GlobalLayerControlProps = {
  cameras: GlobalLayerControlCameraControls;
  publicEvents: GlobalLayerControlEvents;
  className?: string;
  title?: string;
  description?: string;
};

type PlannedLayer = {
  id: string;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
};

function PlaneIcon(props: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={props.className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 21 7.2-7.2M14.8 5.2 19 1l1 1-4.2 4.2m-1.9 1.9 5.7 5.7-2.1 2.1-6.8-4.7-4.1 4.1-2.1-.7.7-2.1 4.1-4.1-4.7-6.8L6 3.9l5.7 5.7 4.1-4.1" />
    </svg>
  );
}

const plannedLayers: PlannedLayer[] = [
  { id: 'aircraft', label: 'Aircraft', icon: PlaneIcon },
  { id: 'maritime', label: 'Maritime', icon: Ship },
  { id: 'satellites', label: 'Satellites', icon: Satellite },
  { id: 'natural-hazards', label: 'Natural hazards', icon: CircleAlert },
  { id: 'weather', label: 'Weather', icon: Cloud },
  { id: 'infrastructure', label: 'Infrastructure', icon: Building2 },
];

const providerLabels: Record<CameraProviderSelection, string> = {
  all: 'All providers',
  'qld-tmr': 'Queensland TMR',
  'transport-for-nsw': 'Transport for NSW',
  opentrafficcammap: 'OpenTrafficCamMap USA',
};

const providerChoicesByCountry: Record<
  CameraCountry,
  Array<{ value: CameraProviderSelection; label: string }>
> = {
  AU: [
    { value: 'all', label: 'All Australian providers' },
    { value: 'qld-tmr', label: 'Queensland TMR' },
    { value: 'transport-for-nsw', label: 'Transport for NSW' },
  ],
  US: [
    { value: 'all', label: 'All US providers' },
    { value: 'opentrafficcammap', label: 'OpenTrafficCamMap USA' },
  ],
};

const formatNumber = (value: number) => value.toLocaleString();

const formatGeneratedAt = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

function StatusDot({
  tone,
  label,
}: {
  tone: 'good' | 'warn' | 'bad' | 'quiet';
  label: string;
}) {
  const toneClass = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
    quiet: 'bg-muted-foreground/60',
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-1.5 rounded-full ${toneClass}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  testId,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <label className="group inline-flex shrink-0 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        data-testid={testId}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 rounded-full border border-input bg-muted transition-colors peer-checked:border-primary/80 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/60 peer-disabled:cursor-not-allowed peer-disabled:opacity-45 after:absolute after:left-0.5 after:top-0.5 after:size-3.5 after:rounded-full after:bg-card after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}

function StatusBadge({
  status,
  providerId,
}: {
  status: CameraProviderRow['status'];
  providerId: string;
}) {
  const config = {
    available: { label: 'Catalogue available', tone: 'good' as const },
    stale: { label: 'Catalogue stale', tone: 'warn' as const },
    unavailable: { label: 'Catalogue unavailable', tone: 'bad' as const },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground"
      data-testid={`status-camera-provider-${providerId}`}
    >
      <StatusDot tone={config.tone} label={config.label} />
    </span>
  );
}

function CameraProviderStatusList({
  providers,
  requestedProviderIds,
  enabled,
}: Pick<
  GlobalLayerControlCameraControls,
  'providers' | 'requestedProviderIds' | 'enabled'
>) {
  if (!enabled) {
    return (
      <p
        className="border-t border-border/70 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-camera-providers-empty"
      >
        Catalogue not requested while this layer is off
      </p>
    );
  }

  const visibleProviders =
    requestedProviderIds.length > 0
      ? providers.filter((provider) => requestedProviderIds.includes(provider.id))
      : providers;

  if (visibleProviders.length === 0) {
    return (
      <p
        className="border-t border-border/70 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-camera-providers-empty"
      >
        Provider status not supplied
      </p>
    );
  }

  return (
    <div className="border-t border-border/70 pt-2" aria-label="Camera provider status">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          Provider catalogue health
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          Feed status: not probed
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {visibleProviders.map((provider) => (
          <div
            key={provider.id}
            className="min-w-0 rounded border border-border/70 bg-background/35 px-2 py-1.5"
            data-testid={`row-camera-provider-${provider.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-semibold text-foreground">
                {provider.name || providerLabels[provider.id as CameraProviderSelection] || provider.id}
              </span>
              <StatusBadge status={provider.status} providerId={provider.id} />
            </div>
            <div className="mt-1 flex min-w-0 items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="truncate" title={provider.attribution}>
                {provider.attribution}
              </span>
              <a
                href={provider.catalogueUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                data-testid={`link-camera-catalogue-${provider.id}`}
                aria-label={`Open ${provider.name} catalogue`}
              >
                Catalogue
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CameraLayerRow({ controls }: { controls: GlobalLayerControlCameraControls }) {
  const catalogueStatus =
    !controls.enabled
      ? { label: 'Catalogue not requested · layer off', tone: 'quiet' as const }
      : controls.isUnavailable
        ? { label: 'Catalogue status: unavailable', tone: 'bad' as const }
        : controls.hasError
          ? { label: 'Catalogue status: stale', tone: 'warn' as const }
          : controls.isLoading
            ? { label: 'Catalogue status: checking', tone: 'quiet' as const }
            : { label: 'Catalogue status: available', tone: 'good' as const };

  return (
    <section
      className={`rounded-lg border border-border bg-card transition-opacity ${
        controls.enabled ? 'opacity-100' : 'opacity-75'
      }`}
      aria-labelledby="global-layer-cameras-title"
      data-testid="layer-row-cameras"
    >
      <div className="flex flex-col gap-3 p-3 sm:p-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded border border-primary/25 bg-primary/10 text-primary">
            <Camera className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id="global-layer-cameras-title" className="text-sm font-semibold tracking-[-0.01em]">
                Cameras
              </h3>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                data-testid="text-camera-feed-status"
              >
                Feed status: not probed
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Public catalogue entries and provider health. Individual camera feeds are not tested here.
            </p>
          </div>
          <Toggle
            checked={controls.enabled}
            onChange={controls.onEnabledChange}
            label="Enable cameras layer"
            testId="toggle-global-layer-cameras"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(170px,1fr)_auto_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">Search camera catalogue</span>
            <MapPinned
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={controls.search}
              disabled={!controls.enabled}
              onChange={(event) => controls.onSearchChange(event.target.value)}
              placeholder="Search catalogue or location"
              aria-label="Search camera catalogue"
              data-testid="input-global-camera-search"
              className="h-9 w-full rounded border border-input bg-background pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/75 focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Camera country</span>
            <select
              value={controls.country}
              disabled={!controls.enabled}
              onChange={(event) => controls.onCountryChange(event.target.value as CameraCountry)}
              aria-label="Camera country"
              data-testid="select-global-camera-country"
              className="h-9 w-full appearance-none rounded border border-input bg-background py-0 pl-2.5 pr-8 text-xs outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="AU">Australia</option>
              <option value="US">United States</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Camera provider</span>
            <select
              value={controls.provider}
              disabled={!controls.enabled}
              onChange={(event) =>
                controls.onProviderChange(event.target.value as CameraProviderSelection)
              }
              aria-label="Camera provider"
              data-testid="select-global-camera-provider"
              className="h-9 w-full appearance-none rounded border border-input bg-background py-0 pl-2.5 pr-8 text-xs outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {providerChoicesByCountry[controls.country].map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/70 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
          role="status"
          data-testid="status-global-camera-summary"
        >
          <span className="inline-flex items-center gap-2">
            <StatusDot tone={catalogueStatus.tone} label={catalogueStatus.label} />
            {controls.isFetching && !controls.isLoading ? (
              <span data-testid="status-global-camera-refresh">Updating catalogue</span>
            ) : null}
          </span>
          <span data-testid="text-global-camera-count">
            {controls.isLoading
              ? 'Checking records'
              : `${formatNumber(controls.matchedCount)} listed · ${formatNumber(controls.returnedCount)} shown`}
            {controls.isTruncated ? ' · result limit applied' : ''}
          </span>
        </div>

        <CameraProviderStatusList
          providers={controls.providers}
          requestedProviderIds={controls.requestedProviderIds}
          enabled={controls.enabled}
        />
      </div>
    </section>
  );
}

function PublicEventsLayerRow({ controls }: { controls: GlobalLayerControlEvents }) {
  const status = controls.isError
    ? { label: 'Source status: unavailable', tone: 'bad' as const }
    : controls.isLoading
      ? { label: 'Source status: checking', tone: 'quiet' as const }
      : { label: 'Source status: available', tone: 'good' as const };
  const generatedAt = formatGeneratedAt(controls.generatedAt);

  return (
    <section
      className={`rounded-lg border border-border bg-card transition-opacity ${
        controls.enabled ? 'opacity-100' : 'opacity-75'
      }`}
      aria-labelledby="global-layer-events-title"
      data-testid="layer-row-public-events"
    >
      <div className="flex flex-col gap-3 p-3 sm:p-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded border border-primary/25 bg-primary/10 text-primary">
            <Newspaper className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id="global-layer-events-title" className="text-sm font-semibold tracking-[-0.01em]">
                Public events / news
              </h3>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                data-testid="status-global-events-source"
              >
                <StatusDot tone={status.tone} label={status.label} />
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Geolocated records and headlines from the supplied public-source briefing.
            </p>
          </div>
          <Toggle
            checked={controls.enabled}
            onChange={controls.onEnabledChange}
            label="Enable public events and news layer"
            testId="toggle-global-layer-public-events"
          />
        </div>

        <div
          className="grid grid-cols-2 gap-2 border-t border-border/70 pt-2 sm:grid-cols-3 xl:grid-cols-5"
          role="status"
          aria-label="Public events and news counts"
          data-testid="status-global-events-counts"
        >
          <Metric label="Located events" value={formatNumber(controls.locatedCount)} testId="located" />
          <Metric label="Event records" value={formatNumber(controls.recordCount)} testId="records" />
          <Metric label="Headlines" value={formatNumber(controls.headlineCount)} testId="headlines" />
          <Metric
            label="Sources online"
            value={`${formatNumber(controls.sourcesOnline)} / ${formatNumber(controls.sourceCount)}`}
            testId="sources-online"
          />
          <Metric
            label="Generated"
            value={generatedAt ?? 'Not supplied'}
            testId="generated-at"
            compact
          />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  testId,
  compact = false,
}: {
  label: string;
  value: string;
  testId: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded border border-border/60 bg-background/35 px-2 py-1.5" data-testid={`metric-events-${testId}`}>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-xs font-semibold ${compact ? 'text-[10px]' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function PlannedLayerRow({ layer }: { layer: PlannedLayer }) {
  const Icon = layer.icon;

  return (
    <div
      className="flex min-h-10 items-center gap-2.5 rounded border border-dashed border-border/70 bg-muted/25 px-2.5 text-muted-foreground"
      aria-disabled="true"
      data-testid={`row-planned-layer-${layer.id}`}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span className="text-xs">{layer.label}</span>
      <span className="ml-auto inline-flex items-center gap-1 rounded border border-border/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]">
        <Archive className="size-2.5" aria-hidden="true" />
        Planned
      </span>
    </div>
  );
}

export function GlobalLayerControl({
  cameras,
  publicEvents,
  className = '',
  title = 'Global layers',
  description = 'Separate catalogue records from source availability before using them as operational context.',
}: GlobalLayerControlProps) {
  return (
    <aside
      className={`w-full max-w-3xl rounded-xl border border-border bg-background/95 text-foreground shadow-sm ${className}`}
      aria-label="Global layer control"
      data-testid="global-layer-control"
    >
      <div className="border-b border-border bg-card/60 px-3.5 py-3 sm:px-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border border-accent/40 bg-accent/15 text-accent-foreground">
            <Activity className="size-3.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                <Radio className="size-2.5" aria-hidden="true" />
                Public-source context
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-3 sm:p-4">
        <CameraLayerRow controls={cameras} />
        <PublicEventsLayerRow controls={publicEvents} />

        <section
          className="rounded-lg border border-border/80 bg-muted/20 p-3"
          aria-labelledby="global-layer-planned-title"
          data-testid="planned-layers-group"
        >
          <div className="mb-2.5 flex items-start gap-2.5">
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground">
              <FlaskConical className="size-3.5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="global-layer-planned-title" className="text-xs font-semibold uppercase tracking-[0.08em]">
                Planned layers
              </h3>
              <p className="mt-1 max-w-xl text-[10px] leading-relaxed text-muted-foreground">
                Not connected in this workspace. These rows are reserved for future integrations and do not indicate data availability.
              </p>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {plannedLayers.map((layer) => (
              <PlannedLayerRow key={layer.id} layer={layer} />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

export default GlobalLayerControl;