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
  const mediaUrl = safeHttpUrl(record.mediaUrl ?? null);
  const viewUrl = safeHttpUrl(record.viewUrl ?? null);
  const capability = record.viewCapability;
  // Imagery is loaded straight from the provider. Signalwatch never proxies
  // it, so the desktop app does not become a media relay.
  const showsImage = capability === 'live-image' && mediaUrl !== null;
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
        <DetailRow
          label="Public viewing"
          value={
            capability === 'live-image'
              ? 'Current image published by the provider'
              : capability === 'video-stream'
                ? 'Public live stream published by the provider'
                : capability === 'external-viewer'
                  ? "Viewable on the provider's own page"
                  : capability === 'unavailable'
                    ? 'Provider reports this camera as unavailable'
                    : 'Catalogue only — no public viewing mechanism published'
          }
        />
        {record.direction && <DetailRow label="Direction" value={record.direction} />}
        {record.format && <DetailRow label="Format" value={record.format} />}
        {record.encoding && <DetailRow label="Encoding" value={record.encoding} />}
        <DetailRow label="Attribution" value={record.attribution} />
        {providerStatus?.message && (
          <DetailRow label="Provider status" value={providerStatus.message} />
        )}
      </dl>

      {showsImage ? (
        <figure className="space-y-1" data-testid="camera-live-image">
          <img
            src={mediaUrl ?? undefined}
            alt={`Current public image from ${record.displayName}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full rounded-lg border border-white/10 bg-black/30"
          />
          <figcaption className="text-[10px] text-slate-400">
            Loaded directly from {record.attribution}. Refresh rate is set by the
            provider; this is not a continuous stream.
          </figcaption>
        </figure>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {capability === 'live-image' && mediaUrl ? (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-camera-view-image"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-200/25 bg-cyan-200/[0.06] px-3 py-2 text-center text-[10px] font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            View live image <ExternalLink className="size-3" />
          </a>
        ) : null}
        {capability === 'video-stream' && mediaUrl ? (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-camera-watch-live"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-200/25 bg-cyan-200/[0.06] px-3 py-2 text-center text-[10px] font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            Watch live <ExternalLink className="size-3" />
          </a>
        ) : null}
        {capability === 'external-viewer' && viewUrl ? (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-camera-open-viewer"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-200/25 bg-cyan-200/[0.06] px-3 py-2 text-center text-[10px] font-semibold text-cyan-100 transition-colors hover:border-cyan-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            Open camera <ExternalLink className="size-3" />
          </a>
        ) : null}
        {capability === 'catalogue-only' || capability === 'unavailable' ? (
          <span
            data-testid="text-camera-catalogue-only"
            className="rounded-lg border border-white/10 px-3 py-2 text-center text-[10px] text-slate-500"
          >
            {capability === 'unavailable'
              ? 'Unavailable'
              : 'Catalogue only'}
          </span>
        ) : null}
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
