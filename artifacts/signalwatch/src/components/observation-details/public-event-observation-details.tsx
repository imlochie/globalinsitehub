import React from 'react';
/** Public-event specific inspector body. */
import { ExternalLink } from 'lucide-react';
import { formatAbsoluteTime } from '@/lib/monitoring';
import type { PublicEventObservation } from '@/lib/global-layers';
import { DetailRow, StatusPill, formatCoordinates, safeHttpUrl } from './shared';

export function PublicEventObservationDetails({
  observation,
}: {
  observation: PublicEventObservation;
}) {
  const { record } = observation;
  const sourceUrl = safeHttpUrl(record.url);
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={record.category || 'Public event'} tone="warn" />
        <span className="text-[10px] text-slate-400">
          {formatAbsoluteTime(record.occurredAt)}
        </span>
      </div>

      {record.detail && (
        <p className="text-[11px] leading-5 text-slate-300/80">{record.detail}</p>
      )}

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Source" value={record.source} />
        <DetailRow label="Occurred" value={formatAbsoluteTime(record.occurredAt)} />
        <DetailRow
          label="Coordinates"
          value={formatCoordinates(record.latitude, record.longitude)}
        />
        {record.magnitude !== null && (
          <DetailRow label="Magnitude" value={String(record.magnitude)} />
        )}
      </dl>

      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-event-original-source"
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold text-slate-200 transition-colors hover:border-amber-200/25 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
        >
          Open public source <ExternalLink className="size-3" />
        </a>
      ) : (
        <p className="text-[10px] text-slate-500">Source URL unavailable</p>
      )}
    </div>
  );
}
