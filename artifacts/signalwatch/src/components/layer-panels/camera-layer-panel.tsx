import React from 'react';
/** Camera-specific control UI, assembled into the shared layer panel model. */
import { ChevronDown, ExternalLink, MapPinned } from 'lucide-react';
import type { CameraProviderStatus } from '@workspace/api-client-react';
import type { CameraCountry, CameraProviderSelection } from '@/hooks/use-camera-catalogue';
import {
  layerCountries,
  layerRegistry,
  type LayerDefinition,
} from '@/lib/layer-registry';
import { StatusDot } from './status-dot';
import type { LayerPanelModel } from './types';

export type CameraProviderRow = Pick<
  CameraProviderStatus,
  'id' | 'name' | 'status' | 'feedReachability' | 'attribution' | 'catalogueUrl'
>;

export type CameraLayerPanelInput = {
  definition?: LayerDefinition;
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

const formatNumber = (value: number) => value.toLocaleString();

/**
 * Provider choices for the selected country, read from the registry.
 *
 * The "all" label is built from the country's own name rather than from a
 * hard-coded adjective, so a newly registered country needs no change here.
 */
function providerChoices(
  definition: LayerDefinition,
  country: CameraCountry,
): Array<{ value: CameraProviderSelection; label: string }> {
  const available = definition.providers.filter((provider) =>
    provider.countries.includes(country),
  );
  const countryLabel =
    layerCountries(definition).find((entry) => entry.code === country)?.label ??
    country;
  return [
    { value: 'all', label: `All ${countryLabel} providers` },
    ...available.map((provider) => ({
      value: provider.id as CameraProviderSelection,
      label: provider.name,
    })),
  ];
}

export function cameraLayerPanel(input: CameraLayerPanelInput): LayerPanelModel {
  const definition = input.definition ?? layerRegistry.require('cameras');
  const status = !input.enabled
    ? { label: 'Catalogue not requested · layer off', tone: 'quiet' as const }
    : input.isUnavailable
      ? { label: 'Catalogue status: unavailable', tone: 'bad' as const }
      : input.hasError
        ? { label: 'Catalogue status: stale', tone: 'warn' as const }
        : input.isLoading
          ? { label: 'Catalogue status: checking', tone: 'quiet' as const }
          : { label: 'Catalogue status: available', tone: 'good' as const };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    reachable: !input.isUnavailable,
    status,
    note: 'Feed status: not probed',
    noteTestId: 'text-camera-feed-status',
    summary: (
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/70 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        role="status"
        data-testid="status-global-camera-summary"
      >
        <span className="inline-flex items-center gap-2">
          <StatusDot tone={status.tone} label={status.label} />
          {input.isFetching && !input.isLoading ? (
            <span data-testid="status-global-camera-refresh">Updating catalogue</span>
          ) : null}
        </span>
        <span data-testid="text-global-camera-count">
          {input.isLoading
            ? 'Checking records'
            : `${formatNumber(input.matchedCount)} listed · ${formatNumber(input.returnedCount)} shown`}
          {input.isTruncated ? ' · result limit applied' : ''}
        </span>
      </div>
    ),
    controls: definition.capabilities.providerFiltering ? (
      <div className="grid gap-2 sm:grid-cols-[minmax(170px,1fr)_auto_auto]">
        {definition.capabilities.search ? (
          <label className="relative min-w-0">
            <span className="sr-only">Search camera catalogue</span>
            <MapPinned
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={input.search}
              disabled={!input.enabled}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder="Search catalogue or location"
              aria-label="Search camera catalogue"
              data-testid="input-global-camera-search"
              className="h-9 w-full rounded border border-input bg-background pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/75 focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        ) : null}
        <label className="relative">
          <span className="sr-only">Camera country</span>
          <select
            value={input.country}
            disabled={!input.enabled}
            onChange={(event) => input.onCountryChange(event.target.value as CameraCountry)}
            aria-label="Camera country"
            data-testid="select-global-camera-country"
            className="h-9 w-full appearance-none rounded border border-input bg-background py-0 pl-2.5 pr-8 text-xs outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {layerCountries(definition).map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </label>
        <label className="relative">
          <span className="sr-only">Camera provider</span>
          <select
            value={input.provider}
            disabled={!input.enabled}
            onChange={(event) =>
              input.onProviderChange(event.target.value as CameraProviderSelection)
            }
            aria-label="Camera provider"
            data-testid="select-global-camera-provider"
            className="h-9 w-full appearance-none rounded border border-input bg-background py-0 pl-2.5 pr-8 text-xs outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {providerChoices(definition, input.country).map((choice) => (
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
    ) : undefined,
    details: (
      <CameraProviderStatusList
        providers={input.providers}
        requestedProviderIds={input.requestedProviderIds}
        enabled={input.enabled}
      />
    ),
  };
}

/** Catalogue states published by the camera provider status endpoint. */
type CatalogueStatus = 'available' | 'stale' | 'unavailable';

function StatusBadge({
  status,
  providerId,
}: {
  status: CatalogueStatus;
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
}: {
  providers: CameraProviderRow[];
  requestedProviderIds: string[];
  enabled: boolean;
}) {
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
                {provider.name ||
                  layerRegistry
                    .require('cameras')
                    .providers.find((entry) => entry.id === provider.id)?.name ||
                  provider.id}
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
