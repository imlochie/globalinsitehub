import React from 'react';
export type DetailTone = 'good' | 'warn' | 'bad' | 'quiet';

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[10px] text-slate-500">{label}</dt>
      <dd className="max-w-[68%] break-words text-right text-[10px] leading-4 text-slate-200/85">
        {value}
      </dd>
    </div>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: DetailTone }) {
  const colors = {
    good: 'border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200',
    warn: 'border-amber-300/20 bg-amber-300/[0.05] text-amber-200',
    bad: 'border-red-300/20 bg-red-300/[0.05] text-red-200',
    quiet: 'border-white/10 bg-white/[0.025] text-slate-400',
  }[tone];
  return (
    <span
      className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${colors}`}
    >
      {label}
    </span>
  );
}

export function formatCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return 'Not supplied';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
