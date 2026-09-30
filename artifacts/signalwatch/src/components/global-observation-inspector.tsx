import React from 'react';
/**
 * Shared observation inspector.
 *
 * The shell is layer-agnostic: the header comes from the registry definition
 * plus base observation fields, and the body is resolved from the observation
 * presentation registry.
 */
import { ArrowUpRight, X } from "lucide-react";
import { Link } from "wouter";
import { ObservationDetails } from "@/components/observation-details";
import type { BaseObservation } from "@/lib/global-layers";
import { layerRegistry, type LayerRegistry } from "@/lib/layer-registry";

type GlobalObservationInspectorProps = {
  observation: BaseObservation;
  onClear: () => void;
  registry?: LayerRegistry;
};

export function GlobalObservationInspector({
  observation,
  onClear,
  registry = layerRegistry,
}: GlobalObservationInspectorProps) {
  const definition = registry.get(observation.layerId);
  const recordLabel = definition
    ? `${definition.label} record`
    : "Public-source record";

  return (
    <aside
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1119]/95"
      aria-label="Selected public-source record"
      data-testid="global-observation-inspector"
      data-layer={String(observation.layerId)}
    >
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-cyan-200/80">
              {recordLabel}
            </p>
            <h2 className="mt-1 text-sm font-semibold leading-5 tracking-tight text-slate-100">
              {observation.label}
            </h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">
              {observation.providerName}
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

      <ObservationDetails observation={observation} />

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
