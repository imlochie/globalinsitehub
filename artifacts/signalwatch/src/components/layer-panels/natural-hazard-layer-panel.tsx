import React from 'react';
/**
 * Natural hazards control UI.
 *
 * The coverage caption states reach *and* its limits: these sources are
 * worldwide, but they are not a complete census of hazards. Per-source status
 * names what goes missing when a source fails, so a quiet map is never read as
 * a calm world.
 */
import type { HazardSourceStatus } from '@workspace/api-client-react';
import {
  layerCoverage,
  layerRegistry,
  type LayerDefinition,
} from '@/lib/layer-registry';
import { StatusDot } from './status-dot';
import type { LayerPanelModel } from './types';

export type NaturalHazardLayerPanelInput = {
  definition?: LayerDefinition;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  source: string;
  onSourceChange: (source: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  sources: HazardSourceStatus[];
  matchedCount: number;
  returnedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  isUnavailable: boolean;
  isTruncated: boolean;
};

const formatNumber = (value: number) => value.toLocaleString();

export function naturalHazardLayerPanel(
  input: NaturalHazardLayerPanelInput,
): LayerPanelModel {
  const definition = input.definition ?? layerRegistry.require('natural-hazards');
  const coverage = layerCoverage(definition);
  const availableSources = input.sources.filter(
    (source) => source.status === 'available',
  );

  const status = !input.enabled
    ? { label: 'Hazard sources not requested · layer off', tone: 'quiet' as const }
    : input.isUnavailable
      ? { label: 'Hazard sources unavailable', tone: 'bad' as const }
      : input.hasError
        ? { label: 'Some hazard sources failed', tone: 'warn' as const }
        : input.isLoading
          ? { label: 'Loading hazard observations', tone: 'quiet' as const }
          : input.sources.length > 0 &&
              availableSources.length < input.sources.length
            ? { label: 'Some hazard sources unavailable', tone: 'warn' as const }
            : { label: 'Hazard sources available', tone: 'good' as const };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    reachable: !input.isUnavailable,
    status,
    note: `${coverage.scope === 'global' ? 'Global' : 'Regional'}: ${coverage.regions.join(' · ')}`,
    noteTestId: 'text-natural-hazards-coverage',
    summary: (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-global-natural-hazards-source"
      >
        <StatusDot tone={status.tone} label={status.label} />
      </span>
    ),
    metricsLabel: 'Hazard observation counts',
    metricsTestId: 'status-global-natural-hazards-counts',
    metrics: [
      {
        label: 'Hazards shown',
        value: formatNumber(input.returnedCount),
        testId: 'natural-hazards-returned',
      },
      {
        label: 'Hazards matched',
        value: formatNumber(input.matchedCount),
        testId: 'natural-hazards-matched',
      },
      {
        label: 'Sources',
        value: `${formatNumber(availableSources.length)} / ${formatNumber(input.sources.length)}`,
        testId: 'natural-hazards-sources-available',
      },
    ],
    details: (
      <div className="space-y-2">
        <p
          className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2 text-[10px] leading-4 text-slate-300/75"
          data-testid="text-natural-hazards-coverage-note"
        >
          {coverage.note}
        </p>
        <ul className="space-y-1.5" data-testid="list-natural-hazards-sources">
          {input.sources.map((source) => (
            <li
              key={source.id}
              className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2 text-[10px] leading-4 text-slate-300/80"
              data-testid={`row-natural-hazards-source-${source.id}`}
            >
              <StatusDot
                tone={source.status === 'available' ? 'good' : 'bad'}
                label={`${source.name} · ${source.status}`}
              />
              <p className="mt-1 text-slate-400">{source.coverage.note}</p>
              <p className="mt-1 text-slate-500">
                {source.attribution} ({source.licence})
              </p>
              {source.status !== 'available' && (
                <p className="mt-1 text-slate-400">{source.message}</p>
              )}
            </li>
          ))}
        </ul>
        {input.isTruncated && (
          <p
            className="text-[10px] text-slate-400"
            data-testid="text-natural-hazards-truncated"
          >
            Showing the first {formatNumber(input.returnedCount)} of{' '}
            {formatNumber(input.matchedCount)} matching hazard observations.
          </p>
        )}
      </div>
    ),
  };
}
