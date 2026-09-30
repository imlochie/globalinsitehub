import React from 'react';
/** Camera-specific inspector body. */
import { ExternalLink } from 'lucide-react';
import type { CameraObservation } from '@/lib/global-layers';
import { DetailRow, StatusPill, formatCoordinates, safeHttpUrl } from './shared';

export function CameraObservationDetails({
  observation,
}: {
  observation: CameraObservation;
}) {
  const { record, providerStatus } = observation;
  const location = [
    record.locality,
    record.district,
    record.region,
    record.postcode,
    record.countryCode,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const sourceUrl = safeHttpUrl(record.sourceUrl);
  const catalogueUrl = safeHttpUrl(record.catalogueUrl);

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <StatusPill
          label={`Catalogue ${providerStatus?.status ?? 'status not supplied'}`}
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
        <StatusPill label={`Feed ${record.feedStatus}`} tone="quiet" />
        <StatusPill label={record.publicAccess} tone="quiet" />
      </div>

      <p
        className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2.5 text-[10px] leading-4 text-slate-300/75"
        data-testid="text-camera-feed-policy"
      >
        The catalogue entry is not a live-status check. Signalwatch does not probe or
        proxy the feed.
      </p>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Location" value={location.join(', ') || 'Not supplied'} />
        <DetailRow
          label="Coordinates"
          value={formatCoordinates(record.latitude, record.longitude)}
        />
        <DetailRow label="Feed type" value={record.streamKind} />
        {record.direction && <DetailRow label="Direction" value={record.direction} />}
        {record.format && <DetailRow label="Format" value={record.format} />}
        {record.encoding && <DetailRow label="Encoding" value={record.encoding} />}
        <DetailRow label="Attribution" value={record.attribution} />
        {providerStatus?.message && (
          <DetailRow label="Provider status" value={providerStatus.message} />
        )}
      </dl>

      <div className="grid gap-2 sm:grid-cols-2">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-camera-original-source"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-center text-[10px] font-semibold text-slate-200 transition-colors hover:border-cyan-200/25 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            Open original feed URL <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="rounded-lg border border-white/10 px-3 py-2 text-center text-[10px] text-slate-500">
            Original source URL unavailable
          </span>
        )}
        {catalogueUrl ? (
          <a
            href={catalogueUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-camera-provider-catalogue"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-center text-[10px] font-semibold text-slate-200 transition-colors hover:border-cyan-200/25 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            Open provider catalogue <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="rounded-lg border border-white/10 px-3 py-2 text-center text-[10px] text-slate-500">
            Provider catalogue URL unavailable
          </span>
        )}
      </div>
    </div>
  );
}
