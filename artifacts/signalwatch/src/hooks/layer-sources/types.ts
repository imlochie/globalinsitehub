/**
 * Global Layer Engine — layer source bindings.
 *
 * A layer source is the runtime half of a layer: it turns runtime state
 * (enablement + filters) into normalized observations plus a uniform fetch
 * status. Shared code only consumes `LayerSourceResult`, so a new layer adds a
 * source module instead of new branches in the data hook or the UI.
 */
import type { BaseObservation } from "@/lib/global-layers";
import type { GlobalLayerContextValue } from "@/components/global-layer-provider";
import type { LayerId } from "@/lib/layer-registry";
import type {
  RenderableImagery,
  SpatialBounds,
  SpatialProduct,
} from "@/lib/spatial-layers";

export type LayerFetchStatus = {
  /** True while the layer has no usable data yet. */
  isLoading: boolean;
  /** True while a request is in flight (including background refresh). */
  isFetching: boolean;
  /** At least one provider request failed. */
  hasError: boolean;
  /** Every provider request failed and nothing is renderable. */
  isUnavailable: boolean;
};

export const idleLayerFetchStatus: LayerFetchStatus = {
  isLoading: false,
  isFetching: false,
  hasError: false,
  isUnavailable: false,
};

export type LayerSourceResult<TObservation extends BaseObservation> = {
  layerId: LayerId;
  enabled: boolean;
  observations: TObservation[];
  status: LayerFetchStatus;
  refetch: () => void;
};

/** Runtime state handed to every layer source. */
export type LayerSourceContext = {
  enabled: boolean;
  state: GlobalLayerContextValue;
};

/**
 * Runtime half of a *spatial* layer.
 *
 * Deliberately not a `LayerSourceResult`. `LayerSourceResult` is generic over
 * `BaseObservation`, which hard-requires a latitude, a longitude and a record
 * id — none of which a continuous surface has. Keeping the two result types
 * separate means spatial layers are structurally unable to reach
 * `combineLayerSources`, the marker sampler or the observation inspector, so
 * the two kinds cannot corrupt each other by accident rather than by
 * convention.
 *
 * The shared half — `layerId`, `enabled`, `status`, `refetch` — is identical,
 * so the layer control treats both kinds the same way.
 */
export type SpatialLayerSourceResult = {
  layerId: LayerId;
  enabled: boolean;
  kind: "imagery" | "field";
  /** Raw products, for the panel and the provenance UI. */
  products: SpatialProduct[];
  /** Surfaces resolved against the current viewport, for the map. */
  imagery: RenderableImagery[];
  status: LayerFetchStatus;
  refetch: () => void;
};

export type SpatialLayerSourceContext = {
  enabled: boolean;
  /**
   * Current map extent, used only to decide whether the viewport has left the
   * product's declared coverage. Null means "not yet known", which never
   * hides a surface pre-emptively.
   */
  viewport: Omit<SpatialBounds, "name"> | null;
  /** Injectable clock so freshness is testable without faking timers. */
  now?: Date;
};
