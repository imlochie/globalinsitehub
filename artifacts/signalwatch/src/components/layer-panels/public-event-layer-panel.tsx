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
  const status = !input.enabled
    ? { label: 'Source status: not requested · layer off', tone: 'quiet' as const }
    : input.isError
      ? { label: 'Source status: unavailable', tone: 'bad' as const }
      : input.isLoading
        ? { label: 'Source status: checking', tone: 'quiet' as const }
        : { label: 'Source status: available', tone: 'good' as const };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    status,
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
  };
}
