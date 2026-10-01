import React from 'react';
/**
 * Public events control UI.
 *
 * Coverage is regional and the caption says so before any counter. A provider
 * that needs a credential reports `unconfigured` — a configuration state, not
 * a failure — and the panel says which region is consequently not covered
 * rather than implying those roads are clear.
 */
import type { PublicEventProviderStatus } from '@workspace/api-client-react';
import {
  layerCoverage,
  layerRegistry,
  type LayerDefinition,
} from '@/lib/layer-registry';
import { StatusDot } from './status-dot';
import type { LayerPanelModel } from './types';

export type PublicEventLayerPanelInput = {
  definition?: LayerDefinition;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  provider: string;
  onProviderChange: (provider: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  providers: PublicEventProviderStatus[];
  matchedCount: number;
  returnedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  isUnavailable: boolean;
  isTruncated: boolean;
};

const formatNumber = (value: number) => value.toLocaleString();

export function publicEventLayerPanel(
  input: PublicEventLayerPanelInput,
): LayerPanelModel {
  const definition = input.definition ?? layerRegistry.require('public-events');
  const coverage = layerCoverage(definition);
  const available = input.providers.filter(
    (provider) => provider.status === 'available',
  );
  const unconfigured = input.providers.filter(
    (provider) => provider.status === 'unconfigured',
  );

  const status = !input.enabled
    ? { label: 'Incident feeds not requested · layer off', tone: 'quiet' as const }
    : input.isUnavailable
      ? { label: 'Incident feeds unavailable', tone: 'bad' as const }
      : input.hasError
        ? { label: 'Some incident feeds failed', tone: 'warn' as const }
        : input.isLoading
          ? { label: 'Loading civic incidents', tone: 'quiet' as const }
          : input.providers.length > 0 && available.length < input.providers.length
            ? {
                label:
                  unconfigured.length > 0 && available.length > 0
                    ? 'Some providers not configured'
                    : 'Some incident feeds unavailable',
                tone: 'warn' as const,
              }
            : { label: 'Incident feeds available', tone: 'good' as const };

  return {
    definition,
    enabled: input.enabled,
    onEnabledChange: input.onEnabledChange,
    reachable: !input.isUnavailable,
    status,
    note: `Regional: ${coverage.regions.join(' · ')}`,
    noteTestId: 'text-public-events-coverage',
    summary: (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
        data-testid="status-global-events-source"
      >
        <StatusDot tone={status.tone} label={status.label} />
      </span>
    ),
    metricsLabel: 'Civic incident counts',
    metricsTestId: 'status-global-events-counts',
    metrics: [
      {
        label: 'Incidents shown',
        value: formatNumber(input.returnedCount),
        testId: 'events-returned',
      },
      {
        label: 'Incidents matched',
        value: formatNumber(input.matchedCount),
        testId: 'events-matched',
      },
      {
        label: 'Providers',
        value: `${formatNumber(available.length)} / ${formatNumber(input.providers.length)}`,
        testId: 'events-providers-available',
      },
    ],
    details: (
      <div className="space-y-2">
        <p
          className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2 text-[10px] leading-4 text-slate-300/75"
          data-testid="text-public-events-coverage-note"
        >
          {coverage.note}
        </p>
        <ul className="space-y-1.5" data-testid="list-public-event-providers">
          {input.providers.map((provider) => (
            <li
              key={provider.id}
              className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2 text-[10px] leading-4 text-slate-300/80"
              data-testid={`row-public-event-provider-${provider.id}`}
            >
              <StatusDot
                tone={
                  provider.status === 'available'
                    ? 'good'
                    : provider.status === 'unconfigured'
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
          <p
            className="text-[10px] text-slate-400"
            data-testid="text-public-events-truncated"
          >
            Showing the first {formatNumber(input.returnedCount)} of{' '}
            {formatNumber(input.matchedCount)} matching incidents.
          </p>
        )}
      </div>
    ),
  };
}
