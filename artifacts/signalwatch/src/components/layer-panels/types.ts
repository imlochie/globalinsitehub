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
  /**
   * Whether the layer's feed is answering right now.
   *
   * Separate from `definition.status`, which says whether Signalwatch has an
   * admitted source at all. A transient provider outage must not make an
   * implemented layer look unimplemented, and an admitted source that is
   * currently silent must not read as healthy. Omit for layers with no
   * runtime feed; absent means "no reason to think otherwise".
   */
  reachable?: boolean;
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
