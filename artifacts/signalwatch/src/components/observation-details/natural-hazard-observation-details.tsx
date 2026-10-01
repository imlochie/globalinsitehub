import React from 'react';
/**
 * Natural-hazard inspector body.
 *
 * Every field shown here is published by the hazard source. Missing fields are
 * omitted rather than printed as "Unknown" or 0, magnitudes are always shown
 * with the scale they were measured on, and no severity ranking is invented or
 * compared across sources.
 */
import { ExternalLink } from 'lucide-react';
import type { NaturalHazardObservation } from '@/lib/global-layers';
import { DetailRow, StatusPill, formatCoordinates, safeHttpUrl } from './shared';

function formatTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toUTCString() : null;
}

/** NASA asks that the EONET caveat travel with the data. */
const EONET_DISCLAIMER =
  'NASA states EONET records are for visualization and general information only, are not official as to spatial or temporal extent, and are approximations at best.';

export function NaturalHazardObservationDetails({
  observation,
}: {
  observation: NaturalHazardObservation;
}) {
  const { record, providerStatus } = observation;
  const observedAt = formatTimestamp(observation.observedAt);
  const receivedAt = formatTimestamp(observation.receivedAt);
  const updatedAt = formatTimestamp(record.updatedAt ?? null);
  const sourceUrl = safeHttpUrl(record.sourceUrl);
  const catalogueUrl = safeHttpUrl(observation.catalogueUrl);
  const sourceNote =
    observation.providerId === 'nasa-eonet' ? EONET_DISCLAIMER : null;

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <StatusPill label={observation.hazardType} tone="quiet" />
        {observation.activityStatus && (
          <StatusPill
            label={
              observation.activityStatus === 'open'
                ? 'Source reports event open'
                : 'Source reports event ended'
            }
            tone={observation.activityStatus === 'open' ? 'warn' : 'quiet'}
          />
        )}
        <StatusPill
          label={`Source ${providerStatus?.status ?? 'status not supplied'}`}
          tone={
            providerStatus?.status === 'available'
              ? 'good'
              : providerStatus?.status === 'unavailable'
                ? 'bad'
                : 'quiet'
          }
        />
      </div>

      <p
        className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2.5 text-[10px] leading-4 text-slate-300/75"
        data-testid="text-hazard-source-policy"
      >
        {sourceNote ??
          'Values are as published by the source. Signalwatch does not rank, rate or combine hazards across sources.'}
      </p>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Reported type" value={observation.hazardType} />
        {observation.place && (
          <DetailRow label="Place described by source" value={observation.place} />
        )}
        {observation.magnitudeValue !== null && (
          <DetailRow
            label={
              observation.magnitudeUnit
                ? `Magnitude (${observation.magnitudeUnit})`
                : 'Magnitude as published'
            }
            value={String(observation.magnitudeValue)}
          />
        )}
        {observation.magnitudeDescription && (
          <DetailRow
            label="Magnitude description"
            value={observation.magnitudeDescription}
          />
        )}
        {observation.depthKm !== null && (
          <DetailRow label="Depth" value={`${observation.depthKm} km`} />
        )}
        {observation.sourceSeverity && (
          <DetailRow
            label="Severity reported by source"
            value={observation.sourceSeverity}
          />
        )}
        {observation.reviewStatus && (
          <DetailRow label="Source review state" value={observation.reviewStatus} />
        )}
      </dl>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow
          label="Coordinates"
          value={formatCoordinates(record.latitude, record.longitude)}
        />
        {observedAt && <DetailRow label="Observed by source at" value={observedAt} />}
        {updatedAt && <DetailRow label="Revised by source at" value={updatedAt} />}
        {receivedAt && (
          <DetailRow label="Received by Signalwatch" value={receivedAt} />
        )}
      </dl>

      {record.description && (
        <p className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2.5 text-[11px] leading-5 text-slate-300">
          {record.description}
        </p>
      )}

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Source" value={observation.providerName} />
        <DetailRow label="Licence" value={observation.licence} />
        {observation.attribution && (
          <DetailRow label="Attribution" value={observation.attribution} />
        )}
        {providerStatus?.message && (
          <DetailRow label="Source status" value={providerStatus.message} />
        )}
        {providerStatus && 'coverage' in providerStatus && (
          <DetailRow label="Coverage" value={providerStatus.coverage.note} />
        )}
      </dl>

      <div className="grid gap-2 sm:grid-cols-2">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-slate-200 transition hover:bg-white/[0.06]"
            data-testid="link-hazard-source"
          >
            <ExternalLink className="size-3" /> Source record
          </a>
        ) : null}
        {catalogueUrl ? (
          <a
            href={catalogueUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-slate-200 transition hover:bg-white/[0.06]"
            data-testid="link-hazard-documentation"
          >
            <ExternalLink className="size-3" /> Source documentation
          </a>
        ) : null}
      </div>
    </div>
  );
}
