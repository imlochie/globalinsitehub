import React from 'react';
/**
 * Fallback inspector body used by any layer that has not registered bespoke
 * presentation. Renders only base observation fields, so a newly registered
 * layer is inspectable before its own detail view exists.
 */
import { ExternalLink } from 'lucide-react';
import type { BaseObservation } from '@/lib/global-layers';
import { DetailRow, StatusPill, formatCoordinates, safeHttpUrl } from './shared';

export function GenericObservationDetails({
  observation,
}: {
  observation: BaseObservation;
}) {
  const sourceUrl = safeHttpUrl(observation.sourceUrl);
  const catalogueUrl = safeHttpUrl(observation.catalogueUrl);
  return (
    <div className="space-y-4 p-4 sm:p-5" data-testid="generic-observation-details">
      {observation.providerStatus ? (
        <StatusPill
          label={`Catalogue ${observation.providerStatus.status}`}
          tone={observation.providerStatus.status === 'available' ? 'good' : 'warn'}
        />
      ) : null}
      {observation.detail ? (
        <p className="text-[11px] leading-5 text-slate-300/80">{observation.detail}</p>
      ) : null}
      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Source" value={observation.providerName} />
        <DetailRow
          label="Coordinates"
          value={formatCoordinates(observation.latitude, observation.longitude)}
        />
        {observation.observedAt ? (
          <DetailRow label="Observed" value={observation.observedAt} />
        ) : null}
        {observation.attribution ? (
          <DetailRow label="Attribution" value={observation.attribution} />
        ) : null}
      </dl>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-observation-original-source"
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold text-slate-200"
        >
          Open original source <ExternalLink className="size-3" />
        </a>
      ) : null}
      {catalogueUrl ? (
        <a
          href={catalogueUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-observation-catalogue"
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold text-slate-200"
        >
          Open provider catalogue <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
}
