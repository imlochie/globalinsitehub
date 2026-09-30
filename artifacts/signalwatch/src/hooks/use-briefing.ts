import { useMemo } from 'react';
import { getGetMonitoringBriefingQueryKey, useGetMonitoringBriefing } from '@workspace/api-client-react';
import type { Briefing } from '@/lib/monitoring';

type UseBriefingOptions = {
  /** Data acquisition follows layer enablement: disabled layers do not fetch. */
  enabled?: boolean;
};

export function useBriefing(limit = 40, { enabled = true }: UseBriefingOptions = {}) {
  const params = useMemo(() => ({ limit }), [limit]);
  const query = useGetMonitoringBriefing(params, {
    query: {
      enabled,
      queryKey: getGetMonitoringBriefingQueryKey(params),
      refetchInterval: enabled ? 60_000 : false,
      refetchIntervalInBackground: enabled,
      staleTime: 30_000,
    },
  });
  return { ...query, briefing: query.data as Briefing | undefined };
}
