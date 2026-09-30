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
