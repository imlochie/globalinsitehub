/** Registry-driven marker presentation shared by globe and map renderers. */
import type { BaseObservation } from "@/lib/global-layers";
import { layerRegistry, type LayerRegistry } from "@/lib/layer-registry";

export type ObservationMarkerStyle = {
  layerLabel: string;
  legendLabel: string;
  markerColor: string;
  markerStrokeColor: string;
  markerTextColor: string;
  markerClassName: string;
  /** Accessible action label, e.g. "Inspect public cameras record: ...". */
  actionLabel: string;
  /** Tooltip/title text including provenance. */
  tooltip: string;
};

const fallback = {
  markerColor: "#94a3b8",
  markerStrokeColor: "#e2e8f0",
  markerTextColor: "#cbd5f5",
  markerClassName: "size-2 border-slate-100 bg-slate-300",
  legendLabel: "Observation",
};

export function observationMarkerStyle(
  observation: BaseObservation,
  registry: LayerRegistry = layerRegistry,
): ObservationMarkerStyle {
  const definition = registry.get(observation.layerId);
  const display = definition?.display;
  const legendLabel = display?.legendLabel ?? fallback.legendLabel;
  const provenance = display?.tooltipNote ?? observation.providerName;
  return {
    layerLabel: definition?.label ?? String(observation.layerId),
    legendLabel,
    markerColor: display?.markerColor ?? fallback.markerColor,
    markerStrokeColor: display?.markerStrokeColor ?? fallback.markerStrokeColor,
    markerTextColor: display?.markerTextColor ?? fallback.markerTextColor,
    markerClassName: display?.markerClassName ?? fallback.markerClassName,
    actionLabel: `Inspect ${legendLabel.toLowerCase()}: ${observation.label}`,
    tooltip: `${observation.label} · ${legendLabel} · ${provenance}`,
  };
}
