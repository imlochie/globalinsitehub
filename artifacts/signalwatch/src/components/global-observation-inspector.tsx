import { ArrowUpRight, ExternalLink, MapPinned, X } from "lucide-react";
import { Link } from "wouter";
import {
  formatAbsoluteTime,
} from "@/lib/monitoring";
import type {
  CameraObservation,
  GlobalObservation,
  PublicEventObservation,
} from "@/lib/global-layers";

type GlobalObservationInspectorProps = {
  observation: GlobalObservation;
  onClear: () => void;
};

export function GlobalObservationInspector({
  observation,
  onClear,
}: GlobalObservationInspectorProps) {
  const isCamera = observation.kind === "camera";
  return (
    <aside
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1119]/95"
      aria-label="Selected public-source record"
      data-testid="global-observation-inspector"
    >
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-cyan-200/80">
              {isCamera ? "Public camera record" : "Public event record"}
            </p>
            <h2 className="mt-1 text-sm font-semibold leading-5 tracking-tight text-slate-100">
              {observation.label}
            </h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">
              {isCamera ? observation.record.provider : observation.record.source}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selected record"
            data-testid="button-clear-selected-observation"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-white/20 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {isCamera ? (
        <CameraDetails observation={observation} />
      ) : (
        <EventDetails observation={observation} />
      )}

      <div className="border-t border-white/[0.08] p-4">
        <Link
          href="/map"
          data-testid="link-open-observation-map"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-2.5 text-[10px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
        >
          Open detailed map and list <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </aside>
  );
}

function CameraDetails({ observation }: { observation: CameraObservation }) {
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
          label={`Catalogue ${providerStatus?.status ?? "status not supplied"}`}
          tone={
            providerStatus?.status === "available"
              ? "good"
              : providerStatus?.status === "stale"
                ? "warn"
                : providerStatus?.status === "unavailable"
                  ? "bad"
                  : "quiet"
          }
        />
        <StatusPill label={`Feed ${record.feedStatus}`} tone="quiet" />
        <StatusPill label={record.publicAccess} tone="quiet" />
      </div>

      <p
        className="rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2.5 text-[10px] leading-4 text-slate-300/75"
        data-testid="text-camera-feed-policy"
      >
        The catalogue entry is not a live-status check. Signalwatch does not
        probe or proxy the feed.
      </p>

      <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/15 px-3">
        <DetailRow label="Location" value={location.join(", ") || "Not supplied"} />
        <DetailRow label="Coordinates" value={formatCoordinates(record.latitude, record.longitude)} />
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

function EventDetails({ observation }: { observation: PublicEventObservation }) {
  const { record } = observation;
  const sourceUrl = safeHttpUrl(record.url);
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={record.category || "Public event"} tone="warn" />
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
        <DetailRow label="Coordinates" value={formatCoordinates(record.latitude, record.longitude)} />
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[10px] text-slate-500">{label}</dt>
      <dd className="max-w-[68%] break-words text-right text-[10px] leading-4 text-slate-200/85">
        {value}
      </dd>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "warn" | "bad" | "quiet";
}) {
  const colors = {
    good: "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200",
    warn: "border-amber-300/20 bg-amber-300/[0.05] text-amber-200",
    bad: "border-red-300/20 bg-red-300/[0.05] text-red-200",
    quiet: "border-white/10 bg-white/[0.025] text-slate-400",
  }[tone];
  return (
    <span className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${colors}`}>
      {label}
    </span>
  );
}

function formatCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return "Not supplied";
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}