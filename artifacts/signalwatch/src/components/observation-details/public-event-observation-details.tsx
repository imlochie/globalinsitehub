import React from 'react';
/**
 * Civic incident inspector body.
 *
 * Every field shown is published by the reporting authority. Missing fields
 * are omitted rather than printed as "Unknown" or 0. The source's priority
 * label is shown as the source's own wording and is never turned into a score
 * or compared with another provider's.
 */
import { ExternalLink } from 'lucide-react';
import type { PublicEventObservation } from '@/lib/global-layers';
import { DetailRow, StatusPill, formatCoordinates, safeHttpUrl } from './shared';

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toUTCString() : null;
}

export function PublicEventObservationDetails({
  observation,
}: {
  observation: PublicEventObservation;
}) {
  const { record, providerStatus } = observation;
  const publishedAt = formatTimestamp(record.publishedAt);
  const lastUpdatedAt = formatTimestamp(record.lastUpdatedAt);
  const startedAt = formatTimestamp(record.startedAt);
  const endsAt = formatTimestamp(record.endsAt);
  const receivedAt = formatTimestamp(observation.receivedAt);
  const sourceUrl = safeHttpUrl(record.sourceUrl);
  const catalogueUrl = safeHttpUrl(observation.catalogueUrl);

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <StatusPill label={observation.eventType} tone="quiet" />
        {observation.sourcePriority && (
          <StatusPill
            label={`Source priority: ${observation.sourcePriority}`}
            tone="quiet"
          />
        )}
        {observation.status && (
          <StatusPill label={observation.status} tone="quiet" />
        )}
        <StatusPill
          label={`Provider ${providerStatus?.status ?? 'status not supplied'}`}
          tone={
            providerStatus?.status === 'available'
              ? 'good'
              : providerStatus?.status === 'unconfigured'
                ? 'warn'
                : providerStatus?.status === 'unavailable'
                  ? 'bad'
                  : 'quiet'
          }
        />
      </div>

      <p
        className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2.5 text-[10px] leading-4 text-slate-300/75"
        data-testid="text-public-event-policy"
      >
        Reported by a road authority as a current condition. Categories and
        priority are the authority&apos;s own; Signalwatch does not rank
        incidents or compare them across providers.
      </p>

      {observation.locationDerived && observation.locationNote && (
        <p
          className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2.5 text-[10px] leading-4 text-slate-300/75"
          data-testid="text-public-event-derived-location"
        >
          {observation.locationNote}
        </p>
      )}

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Reported type" value={observation.eventType} />
        {observation.eventSubtype && (
          <DetailRow label="Subtype" value={observation.eventSubtype} />
        )}
        {record.eventDueTo && (
          <DetailRow label="Reported cause" value={record.eventDueTo} />
        )}
        {record.roadSummary?.roadName && (
          <DetailRow label="Road" value={record.roadSummary.roadName} />
        )}
        {record.roadSummary?.locality && (
          <DetailRow label="Locality" value={record.roadSummary.locality} />
        )}
        {record.roadSummary?.localGovernmentArea && (
          <DetailRow
            label="Local government area"
            value={record.roadSummary.localGovernmentArea}
          />
        )}
      </dl>

      {record.impact && (
        <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
          {record.impact.impactType && (
            <DetailRow label="Impact" value={record.impact.impactType} />
          )}
          {record.impact.impactSubtype && (
            <DetailRow label="Impact detail" value={record.impact.impactSubtype} />
          )}
          {record.impact.direction && (
            <DetailRow label="Direction" value={record.impact.direction} />
          )}
          {record.impact.delay && (
            <DetailRow label="Delay" value={record.impact.delay} />
          )}
        </dl>
      )}

      {(record.description || record.advice) && (
        <div className="space-y-2">
          {record.description && (
            <p className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2.5 text-[11px] leading-5 text-slate-300">
              {record.description}
            </p>
          )}
          {record.advice && (
            <p
              className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2.5 text-[11px] leading-5 text-slate-300"
              data-testid="text-public-event-advice"
            >
              Advice: {record.advice}
            </p>
          )}
        </div>
      )}

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow
          label={
            observation.locationDerived
              ? 'Representative coordinates'
              : 'Coordinates'
          }
          value={formatCoordinates(record.latitude, record.longitude)}
        />
        {startedAt && <DetailRow label="Reported start" value={startedAt} />}
        {endsAt && <DetailRow label="Reported end" value={endsAt} />}
        {publishedAt && <DetailRow label="Published by source" value={publishedAt} />}
        {lastUpdatedAt && (
          <DetailRow label="Updated by source" value={lastUpdatedAt} />
        )}
        {receivedAt && (
          <DetailRow label="Received by Signalwatch" value={receivedAt} />
        )}
      </dl>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Provider" value={observation.providerName} />
        {record.suppliedBy && (
          <DetailRow label="Originally supplied by" value={record.suppliedBy} />
        )}
        <DetailRow label="Licence" value={observation.licence} />
        {observation.attribution && (
          <DetailRow label="Attribution" value={observation.attribution} />
        )}
        {providerStatus?.message && (
          <DetailRow label="Provider status" value={providerStatus.message} />
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
            data-testid="link-public-event-source"
          >
            <ExternalLink className="size-3" /> Authority record
          </a>
        ) : null}
        {catalogueUrl ? (
          <a
            href={catalogueUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-slate-200 transition hover:bg-white/[0.06]"
            data-testid="link-public-event-documentation"
          >
            <ExternalLink className="size-3" /> Provider documentation
          </a>
        ) : null}
      </div>
    </div>
  );
}
