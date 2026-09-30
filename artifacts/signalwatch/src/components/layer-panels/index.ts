/**
 * Layer panel builders.
 *
 * One builder per layer that needs bespoke control UI. Adding a layer means
 * adding a builder module and one entry here; the shared control itself stays
 * layer-agnostic.
 */
import type { useGlobalLayerData } from '@/hooks/use-global-layer-data';
import { cameraLayerPanel } from './camera-layer-panel';
import { publicEventLayerPanel } from './public-event-layer-panel';
import type { LayerPanelModel } from './types';

export { cameraLayerPanel } from './camera-layer-panel';
export { publicEventLayerPanel } from './public-event-layer-panel';
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
        isLoading: layerData.briefingLoading,
        isError: layerData.briefingError,
        locatedCount: layerData.locatedEventCount,
        recordCount: layerData.eventRecordCount,
        headlineCount: layerData.headlineCount,
        sourcesOnline: layerData.sourcesOnline,
        sourceCount: layerData.sourceCount,
        generatedAt: layerData.briefingGeneratedAt,
      }),
    );
  }

  return panels;
}
