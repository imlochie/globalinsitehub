import {
  ArrowUpRight,
  Camera,
  LockKeyhole,
  Search,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import type { CameraProviderStatus } from "@workspace/api-client-react";
import type { SectorDefinition } from "@/lib/sectors";

type SectorPreviewPanelProps = {
  sector: SectorDefinition;
  cameraLayer?: {
    enabled: boolean;
    returnedCount: number;
    matchedCount: number;
    isLoading: boolean;
    isUnavailable: boolean;
    providers: CameraProviderStatus[];
    requestedProviderIds: string[];
  };
};

export function SectorPreviewPanel({
  sector,
  cameraLayer,
}: SectorPreviewPanelProps) {
  const Icon = sector.icon;
  const isOperationalCameras = sector.id === "cameras" && cameraLayer;

  return (
    <aside
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1119]/95"
      aria-label={
        sector.id === "cameras"
          ? "Camera operations panel"
          : `${sector.title} preview`
      }
      data-testid="sector-preview-panel"
    >
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07]">
              <Icon className={`size-4.5 ${sector.accentClass}`} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-400">
                Sector {sector.index} / 09
              </p>
              <h2 className="mt-1 text-sm font-semibold leading-4 tracking-tight text-slate-100">
                {sector.title}
              </h2>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ${
              sector.status === "connected"
                ? "border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-200"
                : "border-white/10 bg-white/[0.03] text-slate-400"
            }`}
          >
              {sector.id === "cameras"
                ? "Operational layer"
                : sector.status === "connected"
                  ? "Catalogue linked"
                  : "UI preview"}
          </span>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-300/75">{sector.detail}</p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {isOperationalCameras ? (
          <section
            className="rounded-xl border border-cyan-200/15 bg-cyan-200/[0.035] p-3"
            aria-label="Operational camera catalogue status"
            data-testid="camera-sector-operational-summary"
          >
            <div className="flex items-start gap-2.5">
              <Camera className="mt-0.5 size-3.5 shrink-0 text-cyan-200/80" />
              <div className="min-w-0">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/80">
                  Public camera catalogue
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-100">
                  {!cameraLayer.enabled
                    ? "Layer off · catalogue not requested"
                    : cameraLayer.isLoading
                    ? "Loading catalogue records"
                    : cameraLayer.isUnavailable
                      ? "Catalogue unavailable"
                      : `${cameraLayer.returnedCount.toLocaleString()} records shown`}
                </p>
                {cameraLayer.enabled &&
                  !cameraLayer.isLoading &&
                  !cameraLayer.isUnavailable && (
                  <p className="mt-1 text-[9px] leading-4 text-slate-400">
                    {cameraLayer.matchedCount.toLocaleString()} matching
                    catalogue entries. Individual feeds are not probed.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cameraLayer.providers
                .filter((provider) =>
                  cameraLayer.requestedProviderIds.includes(provider.id),
                )
                .map((provider) => (
                  <span
                    key={provider.id}
                    className="rounded-md border border-white/10 bg-black/15 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-slate-300"
                  >
                    {provider.name} · {provider.status}
                  </span>
                ))}
              {!cameraLayer.enabled && (
                <span className="rounded-md border border-white/10 bg-black/15 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-slate-400">
                  Layer off
                </span>
              )}
            </div>
            <p className="mt-2 border-t border-white/[0.07] pt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">
              Feed reachability: not probed
            </p>
          </section>
        ) : (
          <>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="sector-preview-query"
              className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400"
            >
              {sector.queryLabel}
            </label>
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-amber-200/75">
              Disabled
            </span>
          </div>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3">
            <Search className="size-3.5 shrink-0 text-slate-500" />
            <input
              id="sector-preview-query"
              disabled
              placeholder={sector.queryExample}
              className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 placeholder:text-slate-500 disabled:cursor-not-allowed"
            />
            <LockKeyhole className="size-3 shrink-0 text-slate-600" />
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/20">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-slate-400">
              Illustrative record
            </span>
            <Sparkles className="size-3 text-amber-200/70" />
          </div>
          <dl className="divide-y divide-white/[0.06] px-3">
            {sector.previewRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[10px] text-slate-500">{row.label}</dt>
                <dd className="max-w-[62%] text-right text-[10px] leading-4 text-slate-200/85">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {sector.briefClaim && (
          <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2.5">
            <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-amber-200/75">
              Brief claim · verify before launch
            </p>
            <p className="mt-1 text-[10px] text-slate-300/80">{sector.briefClaim}</p>
          </div>
        )}
          </>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
          <LockKeyhole className="mt-0.5 size-3 shrink-0 text-cyan-200/65" />
          <p className="text-[9px] leading-4 text-slate-400">
            {sector.id === "cameras"
              ? "Camera locations and attribution come from public catalogues. Feed reachability is not probed or proxied."
              : sector.safetyNote}
          </p>
        </div>

        {sector.id === "cameras" && (
          <Link
            href="/map"
            data-testid="link-open-current-camera-map"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-2.5 text-[10px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-200/[0.14]"
          >
            Open camera map and catalogue <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
    </aside>
  );
}