import React from 'react';
/**
 * Weather control and provenance UI.
 *
 * This panel is where a surface becomes accountable. Imagery cannot be
 * clicked to open the record inspector — there is no record — so everything
 * the inspector would have shown for a point observation is shown here
 * instead, per product: who publishes it, what it actually measures, when the
 * frame it is drawing was valid, when Signalwatch last checked, what the
 * provider covers, and where to read the original.
 *
 * Two distinctions are stated explicitly rather than left to inference:
 *
 *   - frame time vs check time. A service can be reachable and still be
 *     serving an hour-old frame, so "updated just now" would be misleading.
 *   - no coverage vs no precipitation. Outside NOAA's network nothing is
 *     observed, which is not a report of clear skies.
 */
import {
  layerCoverage,
  layerRegistry,
  type LayerDefinition,
} from '@/lib/layer-registry';
import {
  evaluateFreshness,
  surfaceAgeMs,
  type RenderableImagery,
  type SpatialProduct,
} from '@/lib/spatial-layers';
import { StatusDot } from './status-dot';
import type { LayerPanelModel, StatusTone } from './types';

export type WeatherLayerPanelInput = {
  definition?: LayerDefinition;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  products: SpatialProduct[];
  /**
   * The same products resolved against the current view.
   *
   * Kept separate from `products` because these two answer different
   * questions. A product says what NOAA publishes; a surface says what the
   * user is looking at right now, which is the only thing that can
   * distinguish an empty map over Kansas from an empty map over Poland.
   */
  surfaces?: RenderableImagery[];
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  isUnavailable: boolean;
  /** Injectable clock so freshness rendering is deterministic in tests. */
  now?: Date;
};

function formatInstant(value: Date | string | null): string {
  if (!value) return 'not published';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'not published';
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function formatAge(ms: number | null): string {
  if (ms === null) return 'unknown';
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min ago`;
}

function formatCadence(ms: number): string {
  return `${Math.round(ms / 60_000)} min`;
}

/**
 * Headline for a layer that is working but drawing nothing in this view.
 *
 * The two reasons are kept apart because they are different facts: one is
 * about the world (nobody observes here), the other about the view (you are
 * closer than the samples). Neither is a statement about the weather.
 */
function describeSilence(silenced: RenderableImagery[]): string {
  const outside = silenced.filter((s) => s.availability === 'outside-coverage');
  const zoomed = silenced.filter((s) => s.availability === 'beyond-resolution');
  if (outside.length > 0 && zoomed.length === 0) return 'No radar source in this view';
  if (zoomed.length > 0 && outside.length === 0) return 'Not drawn at this zoom';
  return 'No radar surface drawn in this view';
}

export function weatherLayerPanel(input: WeatherLayerPanelInput): LayerPanelModel {
  const definition = input.definition ?? layerRegistry.require('weather');
  const coverage = layerCoverage(definition);
  const now = input.now ?? new Date();
  const products = input.products;
  /**
   * Products the provider says it is serving. A server-side fact: it knows
   * nothing about where the user is looking.
   */
  const servable = products.filter(
    (product) =>
      product.imagery !== null &&
      (product.availability === 'covered' || product.availability === 'stale'),
  );
  const staleCount = products.filter(
    (product) => evaluateFreshness(product, now) === 'stale',
  ).length;

  const surfaces = input.surfaces ?? [];
  /**
   * Surfaces actually on the map right now.
   *
   * This is deliberately not `servable.length`. The server reports the radar
   * product as covered whenever NOAA is answering, which is true regardless
   * of the viewport — so counting products claimed "1 surface drawn" while
   * the user was looking at Europe and the map was empty. A count the user
   * can see is wrong is worse than no count.
   *
   * When no view has been reported yet the product count is the only honest
   * answer available, so it is used as the fallback.
   */
  const drawnCount =
    input.surfaces === undefined
      ? servable.length
      : surfaces.filter((surface) => surface.render).length;
  /**
   * Surfaces that are silent because of where or how the user is looking,
   * rather than because the provider failed.
   *
   * This is the distinction the whole coverage model exists to protect. An
   * empty map has at least four different meanings and only one of them is
   * about the weather, so the panel names the reason rather than letting the
   * absence of pixels speak for itself.
   */
  const viewSilenced = surfaces.filter(
    (surface) =>
      surface.availability === 'outside-coverage' ||
      surface.availability === 'beyond-resolution',
  );

  const status: { label: string; tone: StatusTone } = !input.enabled
    ? { label: 'Weather surfaces not requested · layer off', tone: 'quiet' }
    : input.isUnavailable
      ? { label: 'Weather provider unavailable', tone: 'bad' }
      : input.hasError
        ? { label: 'Weather metadata request failed', tone: 'warn' }
        : input.isLoading
          ? { label: 'Loading weather surfaces', tone: 'quiet' }
          : // Nothing is drawn, and the reason is where or how the user is
            // looking rather than a fault. Without this branch the headline
            // read "Weather surfaces available" directly above the panel
            // saying "No radar source here", which is a contradiction the
            // user has to resolve themselves. Tone is quiet, not warn: an
            // honest coverage limit is not a problem to be fixed.
            viewSilenced.length > 0 && drawnCount === 0
            ? { label: describeSilence(viewSilenced), tone: 'quiet' }
            : staleCount > 0
              ? { label: 'Weather surface is stale', tone: 'warn' }
              : { label: 'Weather surfaces available', tone: 'good' };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    reachable: !input.isUnavailable,
    status,
    note: `Regional: ${coverage.regions.join(' · ')}`,
    noteTestId: 'text-weather-coverage',
    summary: (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-global-weather-source"
      >
        <StatusDot tone={status.tone} label={status.label} />
      </span>
    ),
    metricsLabel: 'Weather surface counts',
    metricsTestId: 'status-global-weather-counts',
    metrics: [
      {
        label: 'Surfaces drawn',
        value: String(drawnCount),
        testId: 'weather-surfaces-drawn',
      },
      {
        label: 'Products',
        value: String(products.length),
        testId: 'weather-products-total',
      },
      {
        label: 'Stale',
        value: String(staleCount),
        testId: 'weather-products-stale',
      },
    ],
    details: (
      <div className="space-y-2">
        {input.enabled && viewSilenced.length > 0
          ? viewSilenced.map((surface) => (
              <p
                key={surface.key}
                className="rounded-lg border border-sky-300/20 bg-sky-300/[0.05] px-3 py-2 text-[10px] leading-4 text-sky-100/80"
                data-testid={`text-weather-view-state-${surface.productId}`}
              >
                <span className="font-mono uppercase tracking-[0.1em] text-sky-200/90">
                  {surface.availability === 'outside-coverage'
                    ? 'No radar source here'
                    : 'Not drawn at this zoom'}
                </span>
                <br />
                {surface.message}
              </p>
            ))
          : null}
        <p
          className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2 text-[10px] leading-4 text-slate-300/75"
          data-testid="text-weather-coverage-note"
        >
          {coverage.note}
        </p>
        <ul className="space-y-1.5" data-testid="list-weather-products">
          {products.map((product) => {
            const freshness = evaluateFreshness(product, now);
            const tone: StatusTone =
              product.availability === 'unavailable'
                ? 'bad'
                : product.availability === 'unconfigured'
                  ? 'quiet'
                  : freshness === 'stale'
                    ? 'warn'
                    : 'good';
            return (
              <li
                key={product.id}
                className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2 text-[10px] leading-4 text-slate-300/80"
                data-testid={`row-weather-product-${product.id}`}
              >
                <StatusDot
                  tone={tone}
                  label={`${product.productName} · ${product.availability}`}
                />
                <p className="mt-1 text-slate-400">{product.productDescription}</p>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-400">
                  <dt className="text-slate-500">Provider</dt>
                  <dd data-testid={`weather-product-provider-${product.id}`}>
                    {product.providerName}
                  </dd>
                  <dt className="text-slate-500">Frame valid</dt>
                  <dd data-testid={`weather-product-source-time-${product.id}`}>
                    {formatInstant(product.sourceTimestamp)}
                    {product.sourceTimestamp
                      ? ` (${formatAge(surfaceAgeMs(product, now))})`
                      : ''}
                  </dd>
                  <dt className="text-slate-500">Checked</dt>
                  <dd data-testid={`weather-product-checked-${product.id}`}>
                    {formatInstant(product.ingestionTimestamp)}
                  </dd>
                  {product.validTime && (
                    <>
                      <dt className="text-slate-500">Forecast valid</dt>
                      <dd data-testid={`weather-product-valid-time-${product.id}`}>
                        {formatInstant(product.validTime)}
                      </dd>
                    </>
                  )}
                  {product.runTime && (
                    <>
                      <dt className="text-slate-500">Model run</dt>
                      <dd data-testid={`weather-product-run-time-${product.id}`}>
                        {formatInstant(product.runTime)}
                      </dd>
                    </>
                  )}
                  <dt className="text-slate-500">Update cycle</dt>
                  <dd data-testid={`weather-product-cadence-${product.id}`}>
                    every {formatCadence(product.refreshIntervalMs)}
                  </dd>
                  {product.imagery && (
                    <>
                      <dt className="text-slate-500">Rendering</dt>
                      <dd data-testid={`weather-product-service-${product.id}`}>
                        {product.imagery.protocol.toUpperCase()}{' '}
                        {product.imagery.version} · {product.imagery.crs} ·{' '}
                        {product.imagery.format}
                      </dd>
                    </>
                  )}
                </dl>
                <p
                  className="mt-1 text-slate-400"
                  data-testid={`weather-product-coverage-${product.id}`}
                >
                  {product.coverage.note}
                </p>
                <p className="mt-1 text-slate-500">
                  {product.attribution} ({product.licence})
                </p>
                <a
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-slate-300 underline decoration-dotted underline-offset-2"
                  data-testid={`link-weather-product-source-${product.id}`}
                >
                  Open the provider's own view
                </a>
                {product.availability !== 'covered' && (
                  <p
                    className="mt-1 text-slate-400"
                    data-testid={`weather-product-message-${product.id}`}
                  >
                    {product.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {input.enabled && products.length === 0 && !input.isLoading && (
          <p className="text-[10px] text-slate-400" data-testid="text-weather-empty">
            No weather product answered. Signalwatch is drawing nothing, which is a
            statement about the source, not about the weather.
          </p>
        )}
      </div>
    ),
  };
}
