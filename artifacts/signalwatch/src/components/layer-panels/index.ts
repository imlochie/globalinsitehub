/**
 * Layer panel builders.
 *
 * One builder per layer that needs bespoke control UI. Adding a layer means
 * adding a builder module and one entry here; the shared control itself stays
 * layer-agnostic.
 */
import type { useGlobalLayerData } from '@/hooks/use-global-layer-data';
import { cameraLayerPanel } from './camera-layer-panel';
import { maritimeLayerPanel } from './maritime-layer-panel';
import { naturalHazardLayerPanel } from './natural-hazard-layer-panel';
import { publicEventLayerPanel } from './public-event-layer-panel';
import { weatherLayerPanel } from './weather-layer-panel';
import type { LayerPanelModel } from './types';

export { cameraLayerPanel } from './camera-layer-panel';
export { maritimeLayerPanel } from './maritime-layer-panel';
export { naturalHazardLayerPanel } from './natural-hazard-layer-panel';
export { publicEventLayerPanel } from './public-event-layer-panel';
export { weatherLayerPanel } from './weather-layer-panel';
export type { LayerPanelModel, LayerPanelMetric, StatusTone } from './types';

type LayerData = ReturnType<typeof useGlobalLayerData>;

export function buildLayerPanels(layerData: LayerData): LayerPanelModel[] {
  const panels: LayerPanelModel[] = [];
  const registry = layerData.registry;

  if (registry.has('cameras')) {
    panels.push(
      cameraLayerPanel({
        definition: registry.require('cameras'),
        enabled: layerData.isLayerEnabled('cameras'),
        onEnabledChange: (enabled) => layerData.setLayerEnabled('cameras', enabled),
        country: layerData.cameraFilters.country,
        onCountryChange: layerData.setCameraCountry,
        provider: layerData.cameraFilters.provider,
        onProviderChange: layerData.setCameraProvider,
        search: layerData.cameraFilters.search,
        onSearchChange: layerData.setCameraSearch,
        providers: layerData.cameraCatalogue.providers,
        requestedProviderIds: layerData.cameraCatalogue.requestedProviderIds,
        matchedCount: layerData.cameraCatalogue.matchedCount,
        returnedCount: layerData.cameraCatalogue.returnedCount,
        isLoading: layerData.cameraCatalogue.isLoading,
        isFetching: layerData.cameraCatalogue.isFetching,
        hasError: layerData.cameraCatalogue.hasError,
        isUnavailable: layerData.cameraCatalogue.isUnavailable,
        isTruncated: layerData.cameraCatalogue.isTruncated,
      }),
    );
  }

  if (registry.has('public-events')) {
    panels.push(
      publicEventLayerPanel({
        definition: registry.require('public-events'),
        enabled: layerData.isLayerEnabled('public-events'),
        onEnabledChange: (enabled) =>
          layerData.setLayerEnabled('public-events', enabled),
        provider: layerData.publicEventFilters.provider,
        onProviderChange: layerData.setPublicEventProvider,
        search: layerData.publicEventFilters.search,
        onSearchChange: layerData.setPublicEventSearch,
        providers: layerData.publicEventFeed.providers,
        matchedCount: layerData.publicEventFeed.matchedCount,
        returnedCount: layerData.publicEventFeed.returnedCount,
        isLoading: layerData.publicEventFeed.isLoading,
        isFetching: layerData.publicEventFeed.isFetching,
        hasError: layerData.publicEventFeed.hasError,
        isUnavailable: layerData.publicEventFeed.isUnavailable,
        isTruncated: layerData.publicEventFeed.isTruncated,
      }),
    );
  }

  if (registry.has('maritime')) {
    panels.push(
      maritimeLayerPanel({
        definition: registry.require('maritime'),
        enabled: layerData.isLayerEnabled('maritime'),
        onEnabledChange: (enabled) => layerData.setLayerEnabled('maritime', enabled),
        provider: layerData.maritimeFilters.provider,
        onProviderChange: layerData.setMaritimeProvider,
        search: layerData.maritimeFilters.search,
        onSearchChange: layerData.setMaritimeSearch,
        providers: layerData.vesselFeed.providers,
        matchedCount: layerData.vesselFeed.matchedCount,
        returnedCount: layerData.vesselFeed.returnedCount,
        isLoading: layerData.vesselFeed.isLoading,
        isFetching: layerData.vesselFeed.isFetching,
        hasError: layerData.vesselFeed.hasError,
        isUnavailable: layerData.vesselFeed.isUnavailable,
        isTruncated: layerData.vesselFeed.isTruncated,
      }),
    );
  }

  if (registry.has('natural-hazards')) {
    panels.push(
      naturalHazardLayerPanel({
        definition: registry.require('natural-hazards'),
        enabled: layerData.isLayerEnabled('natural-hazards'),
        onEnabledChange: (enabled) =>
          layerData.setLayerEnabled('natural-hazards', enabled),
        source: layerData.naturalHazardFilters.source,
        onSourceChange: layerData.setNaturalHazardSource,
        search: layerData.naturalHazardFilters.search,
        onSearchChange: layerData.setNaturalHazardSearch,
        sources: layerData.hazardFeed.sources,
        matchedCount: layerData.hazardFeed.matchedCount,
        returnedCount: layerData.hazardFeed.returnedCount,
        isLoading: layerData.hazardFeed.isLoading,
        isFetching: layerData.hazardFeed.isFetching,
        hasError: layerData.hazardFeed.hasError,
        isUnavailable: layerData.hazardFeed.isUnavailable,
        isTruncated: layerData.hazardFeed.isTruncated,
      }),
    );
  }

  // Spatial layers register exactly like observation layers: the shared
  // control is kind-agnostic, because everything it renders (title, toggle,
  // status, metrics, coverage note) is common to both. Only the panel body
  // differs, which is the whole point of the view-model indirection.
  if (registry.has('weather')) {
    panels.push(
      weatherLayerPanel({
        definition: registry.require('weather'),
        enabled: layerData.isLayerEnabled('weather'),
        onEnabledChange: (enabled) => layerData.setLayerEnabled('weather', enabled),
        products: layerData.weatherSurfaces.products,
        isLoading: layerData.weatherSurfaces.isLoading,
        isFetching: layerData.weatherSurfaces.isFetching,
        hasError: layerData.weatherSurfaces.hasError,
        isUnavailable: layerData.weatherSurfaces.isUnavailable,
      }),
    );
  }

  return panels;
}
