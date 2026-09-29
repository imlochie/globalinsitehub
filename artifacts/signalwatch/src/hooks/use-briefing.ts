import { useMemo } from 'react';
import { getGetMonitoringBriefingQueryKey, useGetMonitoringBriefing } from '@workspace/api-client-react';
import type { Briefing } from '@/lib/monitoring';

export function useBriefing(limit = 40) {
  const params = useMemo(() => ({ limit }), [limit]);
  const query = useGetMonitoringBriefing(params, {
    query: {
      queryKey: getGetMonitoringBriefingQueryKey(params),
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
      staleTime: 30_000,
    },
  });
  return { ...query, briefing: query.data as Briefing | undefined };
}