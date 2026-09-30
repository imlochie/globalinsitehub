import React from 'react';
/** Public-events specific control UI, assembled into the shared panel model. */
import { layerRegistry, type LayerDefinition } from '@/lib/layer-registry';
import { StatusDot } from './status-dot';
import type { LayerPanelModel } from './types';

export type PublicEventLayerPanelInput = {
  definition?: LayerDefinition;
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

export function publicEventLayerPanel(
  input: PublicEventLayerPanelInput,
): LayerPanelModel {
  const definition = input.definition ?? layerRegistry.require('public-events');
  /**
   * A reachable feed that cannot place anything on the map is not a healthy
   * layer. Since hazard records moved to the natural-hazards layer, the
   * remaining public-event sources are news feeds, and news headlines carry no
   * coordinates — so "available" with zero located records would read as
   * "nothing is happening" when it actually means "nothing is mappable".
   */
  const reachableButUnmappable =
    input.enabled &&
    !input.isError &&
    !input.isLoading &&
    input.locatedCount === 0;

  const status = !input.enabled
    ? { label: 'Source status: not requested · layer off', tone: 'quiet' as const }
    : input.isError
      ? { label: 'Source status: unavailable', tone: 'bad' as const }
      : input.isLoading
        ? { label: 'Source status: checking', tone: 'quiet' as const }
        : reachableButUnmappable
          ? {
              label: 'Sources available · no mappable records',
              tone: 'warn' as const,
            }
          : { label: 'Source status: available', tone: 'good' as const };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    status,
    note: reachableButUnmappable
      ? 'Reporting only · nothing to place on the map'
      : undefined,
    noteTestId: reachableButUnmappable
      ? 'text-public-events-unmappable'
      : undefined,
    summary: (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-global-events-source"
      >
        <StatusDot tone={status.tone} label={status.label} />
      </span>
    ),
    metricsLabel: 'Public events and news counts',
    metricsTestId: 'status-global-events-counts',
    metrics: [
      { label: 'Located events', value: formatNumber(input.locatedCount), testId: 'events-located' },
      { label: 'Event records', value: formatNumber(input.recordCount), testId: 'events-records' },
      { label: 'Headlines', value: formatNumber(input.headlineCount), testId: 'events-headlines' },
      {
        label: 'Sources online',
        value: `${formatNumber(input.sourcesOnline)} / ${formatNumber(input.sourceCount)}`,
        testId: 'events-sources-online',
      },
      {
        label: 'Generated',
        value: formatGeneratedAt(input.generatedAt) ?? 'Not supplied',
        testId: 'events-generated-at',
        compact: true,
      },
    ],
    details: reachableButUnmappable ? (
      <p
        className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2 text-[10px] leading-4 text-slate-300/75"
        data-testid="text-public-events-unmappable-note"
      >
        These sources are reachable and reporting, but news headlines carry no
        coordinates, so this layer currently places nothing on the map. Empty
        space here means Signalwatch has no geolocated public-reporting source
        yet — not that nothing is being reported.
      </p>
    ) : undefined,
  };
}
