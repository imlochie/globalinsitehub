import React from 'react';
import type { StatusTone } from './types';

export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  const toneClass = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
    quiet: 'bg-muted-foreground/60',
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-1.5 rounded-full ${toneClass}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
