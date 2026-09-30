import React from 'react';
/**
 * Maritime control UI.
 *
 * The one thing this panel must never do is imply worldwide vessel coverage.
 * The coverage note is rendered before any counter, and per-provider status
 * names the region that goes dark when a feed fails.
 */
import type { MaritimeProviderStatus } from '@workspace/api-client-react';
import {
  layerCoverage,
  layerRegistry,
  type LayerDefinition,
} from '@/lib/layer-registry';
import { StatusDot } from './status-dot';
import type { LayerPanelModel } from './types';

export type MaritimeLayerPanelInput = {
  definition?: LayerDefinition;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  provider: string;
  onProviderChange: (provider: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  providers: MaritimeProviderStatus[];
  matchedCount: number;
  returnedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  isUnavailable: boolean;
  isTruncated: boolean;
};

const formatNumber = (value: number) => value.toLocaleString();

export function maritimeLayerPanel(input: MaritimeLayerPanelInput): LayerPanelModel {
  const definition = input.definition ?? layerRegistry.require('maritime');
  const coverage = layerCoverage(definition);

  const status = !input.enabled
    ? { label: 'Vessel feeds not requested · layer off', tone: 'quiet' as const }
    : input.isUnavailable
      ? { label: 'Vessel feeds unavailable', tone: 'bad' as const }
      : input.hasError
        ? { label: 'Some vessel feeds failed', tone: 'warn' as const }
        : input.isLoading
          ? { label: 'Loading vessel positions', tone: 'quiet' as const }
          : { label: 'Vessel feeds available', tone: 'good' as const };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    status,
    // Coverage is a caption on the layer itself, not a footnote in a dialog.
    note: `Regional: ${coverage.regions.join(' · ')}`,
    noteTestId: 'text-maritime-coverage',
    summary: (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-global-maritime-source"
      >
        <StatusDot tone={status.tone} label={status.label} />
      </span>
    ),
    metricsLabel: 'Vessel position counts',
    metricsTestId: 'status-global-maritime-counts',
    metrics: [
      {
        label: 'Vessels shown',
        value: formatNumber(input.returnedCount),
        testId: 'maritime-returned',
      },
      {
        label: 'Vessels matched',
        value: formatNumber(input.matchedCount),
        testId: 'maritime-matched',
      },
      {
        label: 'Feeds',
        value: `${formatNumber(
          input.providers.filter((provider) => provider.status === 'available').length,
        )} / ${formatNumber(input.providers.length)}`,
        testId: 'maritime-feeds-available',
      },
    ],
    details: (
      <div className="space-y-2">
        <p
          className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2 text-[10px] leading-4 text-slate-300/75"
          data-testid="text-maritime-coverage-note"
        >
          {coverage.note}
        </p>
        <ul className="space-y-1.5" data-testid="list-maritime-providers">
          {input.providers.map((provider) => (
            <li
              key={provider.id}
              className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2 text-[10px] leading-4 text-slate-300/80"
              data-testid={`row-maritime-provider-${provider.id}`}
            >
              <StatusDot
                tone={
                  provider.status === 'available'
                    ? 'good'
                    : provider.status === 'stale'
                      ? 'warn'
                      : 'bad'
                }
                label={`${provider.name} · ${provider.status}`}
              />
              <p className="mt-1 text-slate-400">{provider.coverage.note}</p>
              <p className="mt-1 text-slate-500">
                {provider.attribution} ({provider.licence})
              </p>
              {provider.status !== 'available' && (
                <p className="mt-1 text-slate-400">{provider.message}</p>
              )}
            </li>
          ))}
        </ul>
        {input.isTruncated && (
          <p className="text-[10px] text-slate-400" data-testid="text-maritime-truncated">
            Showing the first {formatNumber(input.returnedCount)} of{' '}
            {formatNumber(input.matchedCount)} matching vessels.
          </p>
        )}
      </div>
    ),
  };
}
