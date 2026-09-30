import React from 'react';
/**
 * Vessel-specific inspector body.
 *
 * Every field shown here is what the vessel broadcast about itself or what the
 * provider published. Missing fields are omitted rather than printed as
 * "Unknown", "N/A" or 0, and no purpose, cargo or affiliation is inferred.
 */
import { ExternalLink } from 'lucide-react';
import type { MaritimeObservation } from '@/lib/global-layers';
import { DetailRow, StatusPill, formatCoordinates, safeHttpUrl } from './shared';

function formatTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toUTCString() : null;
}

const freshnessTone = {
  fresh: 'good',
  aging: 'warn',
  stale: 'bad',
  unknown: 'quiet',
} as const;

const freshnessLabel = {
  fresh: 'Position recent',
  aging: 'Position ageing',
  stale: 'Position stale',
  unknown: 'Position time not supplied',
} as const;

export function MaritimeObservationDetails({
  observation,
}: {
  observation: MaritimeObservation;
}) {
  const { record, providerStatus } = observation;
  const positionAt = formatTimestamp(observation.observedAt);
  const receivedAt = formatTimestamp(observation.receivedAt);
  const sourceUrl = safeHttpUrl(record.sourceUrl);
  const catalogueUrl = safeHttpUrl(observation.catalogueUrl);

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <StatusPill
          label={freshnessLabel[observation.freshness]}
          tone={freshnessTone[observation.freshness]}
        />
        <StatusPill
          label={`Feed ${providerStatus?.status ?? 'status not supplied'}`}
          tone={
            providerStatus?.status === 'available'
              ? 'good'
              : providerStatus?.status === 'stale'
                ? 'warn'
                : providerStatus?.status === 'unavailable'
                  ? 'bad'
                  : 'quiet'
          }
        />
        <StatusPill label="Regional coverage" tone="quiet" />
      </div>

      <p
        className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2.5 text-[10px] leading-4 text-slate-300/75"
        data-testid="text-vessel-ais-policy"
      >
        AIS is self-reported by the vessel. Identity, type and destination are
        claims made by the ship, not verified facts.
      </p>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="MMSI" value={observation.mmsi} />
        {record.name && <DetailRow label="Name" value={record.name} />}
        {record.callSign && <DetailRow label="Call sign" value={record.callSign} />}
        {record.imo && <DetailRow label="IMO" value={record.imo} />}
        {record.shipTypeLabel && (
          <DetailRow label="Reported type" value={record.shipTypeLabel} />
        )}
        {record.draughtMetres !== null && (
          <DetailRow label="Draught" value={`${record.draughtMetres.toFixed(1)} m`} />
        )}
      </dl>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow
          label="Coordinates"
          value={formatCoordinates(record.latitude, record.longitude)}
        />
        {positionAt ? (
          <DetailRow label="Reported by provider at" value={positionAt} />
        ) : (
          <DetailRow
            label="Position time"
            value="Not supplied by the provider"
          />
        )}
        {receivedAt && <DetailRow label="Received by Signalwatch" value={receivedAt} />}
      </dl>

      {(record.navigationalStatusLabel !== null ||
        record.speedOverGround !== null ||
        record.courseOverGround !== null ||
        record.heading !== null ||
        record.destination !== null) && (
        <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
          {record.navigationalStatusLabel && (
            <DetailRow
              label="Navigational status"
              value={record.navigationalStatusLabel}
            />
          )}
          {record.speedOverGround !== null && (
            <DetailRow
              label="Speed over ground"
              value={`${record.speedOverGround.toFixed(1)} kn`}
            />
          )}
          {record.courseOverGround !== null && (
            <DetailRow
              label="Course over ground"
              value={`${record.courseOverGround.toFixed(1)}°`}
            />
          )}
          {record.heading !== null && (
            <DetailRow label="Heading" value={`${record.heading}°`} />
          )}
          {record.destination && (
            <DetailRow label="Destination (crew entered)" value={record.destination} />
          )}
        </dl>
      )}

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Provider" value={observation.providerName} />
        <DetailRow label="Licence" value={observation.licence} />
        {observation.attribution && (
          <DetailRow label="Attribution" value={observation.attribution} />
        )}
        {providerStatus?.message && (
          <DetailRow label="Feed status" value={providerStatus.message} />
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
            data-testid="link-vessel-source"
          >
            <ExternalLink className="size-3" /> Provider feed
          </a>
        ) : null}
        {catalogueUrl ? (
          <a
            href={catalogueUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-slate-200 transition hover:bg-white/[0.06]"
            data-testid="link-vessel-documentation"
          >
            <ExternalLink className="size-3" /> Provider documentation
          </a>
        ) : null}
      </div>
    </div>
  );
}
