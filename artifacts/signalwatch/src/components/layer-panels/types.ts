import type { ReactNode } from 'react';
import type { LayerDefinition } from '@/lib/layer-registry';

export type StatusTone = 'good' | 'warn' | 'bad' | 'quiet';

export type LayerPanelMetric = {
  label: string;
  value: string;
  testId: string;
  compact?: boolean;
};

/**
 * View model consumed by the shared layer control. Everything generic (title,
 * description, toggle, status line, metrics) comes from the registry
 * definition plus runtime state; `controls`/`details` carry the small amount
 * of genuinely layer-specific UI.
 */
export type LayerPanelModel = {
  definition: LayerDefinition;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  status: { label: string; tone: StatusTone };
  /** Extra caption rendered next to the layer title. */
  note?: string;
  noteTestId?: string;
  summary?: ReactNode;
  metrics?: LayerPanelMetric[];
  metricsLabel?: string;
  metricsTestId?: string;
  controls?: ReactNode;
  details?: ReactNode;
};
