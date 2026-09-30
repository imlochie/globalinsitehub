import { ArrowUpRight, Camera, RefreshCw } from "lucide-react";
import React from "react";
import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-client-react";

const PROVIDER_NAMES: Record<string, string> = {
  "qld-tmr": "Queensland TMR",
  "transport-for-nsw": "Transport for NSW",
  opentrafficcammap: "OpenTrafficCamMap",
};

type CameraListProps = {
  cameras: CameraRecord[];
  providers: CameraProviderStatus[];
  requestedProviderIds: string[];
  selectedCameraId: string | null;
  onSelectCamera: (cameraId: string) => void;
  isLoading: boolean;
  hasError: boolean;
  isUnavailable: boolean;
  isTruncated: boolean;
  matchedCount: number;
  onRetry: () => void;
};

export function CameraList({
  cameras,
  providers,
  requestedProviderIds,
  selectedCameraId,
  onSelectCamera,
  isLoading,
  hasError,
  isUnavailable,
  isTruncated,
  matchedCount,
  onRetry,
}: CameraListProps) {
  const visibleProviders = providers.filter((provider) =>
    requestedProviderIds.includes(provider.id),
  );
  const failedProvider = visibleProviders.find(
    (provider) => provider.status === "unavailable",
  );
  const catalogueUnavailable =
    isUnavailable || (Boolean(failedProvider) && cameras.length === 0);

  return (
    <div className="space-y-3">
      <section
        className="rounded-xl border border-border bg-card p-3"
        data-testid="camera-catalogue-status"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Public catalogue
            </p>
            <p className="mt-1 text-xs font-semibold">
              {isLoading
                ? "Loading camera metadata"
                : `${cameras.length.toLocaleString()} cameras shown`}
            </p>
          </div>
          <Camera className="size-4 text-primary" />
        </div>

        {visibleProviders.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleProviders.map((provider) => (
              <span
                key={provider.id}
                data-testid={`status-camera-provider-${provider.id}`}
                className={`rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                  provider.status === "available"
                    ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-800 dark:text-emerald-300"
                    : "border-amber-600/25 bg-amber-600/5 text-amber-800 dark:text-amber-300"
                }`}
              >
                {PROVIDER_NAMES[provider.id] ?? provider.name} ·{" "}
                {provider.status}
              </span>
            ))}
          </div>
        )}

        <p
          className="mt-3 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground"
          data-testid="text-camera-feed-policy"
        >
          Camera snapshots are not checked or proxied. Links open the source
          directly.
        </p>
      </section>

      {isTruncated && (
        <p
          role="status"
          data-testid="status-camera-results-truncated"
          className="rounded-lg border border-amber-600/20 bg-amber-600/5 px-3 py-2 text-[10px] leading-4 text-amber-900 dark:text-amber-200"
        >
          Showing {cameras.length.toLocaleString()} of{" "}
          {matchedCount.toLocaleString()} matching records. Search or choose a
          provider to narrow this catalogue.
        </p>
      )}

      {((hasError && !isUnavailable) ||
        (Boolean(failedProvider) && cameras.length > 0)) && (
        <p
          role="status"
          data-testid="status-camera-partial-error"
          className="rounded-lg border border-amber-600/20 bg-amber-600/5 px-3 py-2 text-[10px] leading-4 text-amber-900 dark:text-amber-200"
        >
          Some camera catalogues could not be refreshed. Available records are
          still shown.
        </p>
      )}

      {catalogueUnavailable ? (
        <div
          role="alert"
          data-testid="status-camera-error"
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs"
        >
          <p className="font-semibold">Camera catalogue unavailable</p>
          <p className="mt-1 text-muted-foreground">
            {failedProvider?.message ??
              "The camera catalogue could not be loaded. The event map is still available."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            data-testid="button-retry-camera-catalogue"
            className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className="size-3.5" /> Retry cameras
          </button>
        </div>
      ) : cameras.length === 0 && !isLoading ? (
        <div
          data-testid="empty-camera-catalogue"
          className="rounded-xl border border-dashed border-border px-4 py-8 text-center"
        >
          <Camera className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-xs font-medium">No matching cameras</p>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            Adjust the camera search or provider filter.
          </p>
        </div>
      ) : (
        cameras.map((camera) => {
          const location = [
            camera.locality,
            camera.district,
            camera.region,
            camera.postcode,
          ].filter((part, index, parts) => part && parts.indexOf(part) === index);
          const isSelected = selectedCameraId === camera.id;

          return (
            <article
              key={camera.id}
              data-testid={`camera-card-${camera.id}`}
              className={`rounded-xl border bg-card p-3 transition-colors ${
                isSelected
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectCamera(camera.id)}
                data-testid={`button-select-camera-${camera.id}`}
                aria-pressed={isSelected}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {PROVIDER_NAMES[camera.provider] ?? camera.provider}
                  </span>
                  <span className="shrink-0 font-mono text-[8px] uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    snapshot not checked
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-semibold leading-5">
                  {camera.displayName}
                </p>
                {location.length > 0 && (
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    {location.join(" · ")}
                  </p>
                )}
                {camera.description && (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                    {camera.description}
                  </p>
                )}
                {camera.direction && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Direction: {camera.direction}
                  </p>
                )}
              </button>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2">
                <span className="min-w-0 truncate text-[9px] leading-4 text-muted-foreground">
                  {camera.attribution}
                </span>
                <a
                  href={camera.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`link-camera-source-${camera.id}`}
                  className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold hover:text-primary"
                >
                  Open snapshot <ArrowUpRight className="size-3" />
                </a>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}