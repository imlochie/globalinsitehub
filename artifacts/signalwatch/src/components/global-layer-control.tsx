import React from 'react';
/**
 * Shared global layer control.
 *
 * Renders one row per registered layer. Operational rows come from layer panel
 * models; planned rows come straight from the registry. No layer ids are
 * hard-coded here.
 */
import { Activity, Archive, Check, Circle, CircleDot, FlaskConical, Radio } from 'lucide-react';
import { layerIcon } from '@/components/layer-icons';
import type { LayerPanelMetric, LayerPanelModel } from '@/components/layer-panels/types';
import { layerRegistry, type LayerDefinition, type LayerRegistry } from '@/lib/layer-registry';

export type GlobalLayerControlProps = {
  /** One model per operational layer that should be controllable. */
  layers: LayerPanelModel[];
  registry?: LayerRegistry;
  className?: string;
  title?: string;
  description?: string;
};

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

/**
 * Availability and activity are different facts and are shown as such.
 *
 *   Available  Signalwatch has an admitted source for this layer. A property
 *              of the registry, not of the session.
 *   Active     the user has switched it on in this session.
 *
 * Collapsing the two is how an implemented layer ends up reading as missing:
 * weather is operational and admitted, but ships switched off, and a single
 * dimmed row cannot distinguish "we have no source for this" from "you have
 * not turned it on". The first is a limitation of the product; the second is
 * a choice the user already made.
 */
function LayerStateBadges({
  available,
  active,
}: {
  available: boolean;
  active: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em]"
      data-testid={`layer-state-${available ? 'available' : 'unavailable'}-${
        active ? 'active' : 'inactive'
      }`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${
          available
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
            : 'border-border/70 text-muted-foreground'
        }`}
      >
        {available ? (
          <Check className="size-2.5" aria-hidden="true" />
        ) : (
          <Circle className="size-2.5" aria-hidden="true" />
        )}
        Available
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${
          active
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border/70 text-muted-foreground'
        }`}
      >
        {active ? (
          <CircleDot className="size-2.5" aria-hidden="true" />
        ) : (
          <Circle className="size-2.5" aria-hidden="true" />
        )}
        {active ? 'Active' : 'Inactive'}
      </span>
    </span>
  );
}

function Metric({ metric }: { metric: LayerPanelMetric }) {
  return (
    <div
      className="min-w-0 rounded border border-border/60 bg-background/35 px-2 py-1.5"
      data-testid={`metric-${metric.testId}`}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {metric.label}
      </div>
      <div
        className={`mt-0.5 truncate text-xs font-semibold ${metric.compact ? 'text-[10px]' : ''}`}
        title={metric.value}
      >
        {metric.value}
      </div>
    </div>
  );
}

function OperationalLayerRow({ panel }: { panel: LayerPanelModel }) {
  const { definition } = panel;
  const Icon = layerIcon(definition.display.iconKey);
  const titleId = `global-layer-${String(definition.id)}-title`;

  return (
    <section
      className={`rounded-lg border border-border bg-card transition-opacity ${
        panel.enabled ? 'opacity-100' : 'opacity-75'
      }`}
      aria-labelledby={titleId}
      data-testid={`layer-row-${String(definition.id)}`}
    >
      <div className="flex flex-col gap-3 p-3 sm:p-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded border border-primary/25 bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id={titleId} className="text-sm font-semibold tracking-[-0.01em]">
                {definition.label}
              </h3>
              <LayerStateBadges
                available={definition.status === 'operational'}
                active={panel.enabled}
              />
              {panel.note ? (
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                  data-testid={panel.noteTestId}
                >
                  {panel.note}
                </span>
              ) : null}
              {panel.metrics ? null : panel.summary}
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              {definition.description}
            </p>
          </div>
          <Toggle
            checked={panel.enabled}
            onChange={panel.onEnabledChange}
            label={`Enable ${definition.label} layer`}
            testId={`toggle-global-layer-${String(definition.id)}`}
          />
        </div>

        {panel.controls}

        {panel.metrics ? (
          <>
            {panel.summary}
            <div
              className="grid grid-cols-2 gap-2 border-t border-border/70 pt-2 sm:grid-cols-3 xl:grid-cols-5"
              role="status"
              aria-label={panel.metricsLabel ?? `${definition.label} counts`}
              data-testid={panel.metricsTestId}
            >
              {panel.metrics.map((metric) => (
                <Metric key={metric.testId} metric={metric} />
              ))}
            </div>
          </>
        ) : (
          panel.summary
        )}

        {panel.details}
      </div>
    </section>
  );
}

function PlannedLayerRow({ definition }: { definition: LayerDefinition }) {
  const Icon = layerIcon(definition.display.iconKey);

  return (
    <div
      className="flex min-h-10 items-center gap-2.5 rounded border border-dashed border-border/70 bg-muted/25 px-2.5 text-muted-foreground"
      aria-disabled="true"
      data-testid={`row-planned-layer-${String(definition.id)}`}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span className="text-xs">{definition.label}</span>
      <span className="ml-auto inline-flex items-center gap-1 rounded border border-border/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]">
        <Archive className="size-2.5" aria-hidden="true" />
        Planned
      </span>
    </div>
  );
}

export function GlobalLayerControl({
  layers,
  registry = layerRegistry,
  className = '',
  title = 'Global layers',
  description = 'Separate catalogue records from source availability before using them as operational context.',
}: GlobalLayerControlProps) {
  const plannedLayers = registry.planned();

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
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-3 sm:p-4">
        {layers.map((panel) => (
          <OperationalLayerRow key={String(panel.definition.id)} panel={panel} />
        ))}

        {plannedLayers.length > 0 ? (
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
                <h3
                  id="global-layer-planned-title"
                  className="text-xs font-semibold uppercase tracking-[0.08em]"
                >
                  Planned layers
                </h3>
                <p className="mt-1 max-w-xl text-[10px] leading-relaxed text-muted-foreground">
                  Not connected in this workspace. These rows are reserved for future
                  integrations and do not indicate data availability.
                </p>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {plannedLayers.map((definition) => (
                <PlannedLayerRow key={String(definition.id)} definition={definition} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

export default GlobalLayerControl;
