import type { MonitoringSource } from '@workspace/api-client-react';
import {
  getGetMonitoringBriefingQueryKey,
  useGetMonitoringBriefing,
} from '@workspace/api-client-react';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  ScreenScroll,
  ScreenTitle,
  SourceCard,
} from '@/components/SignalwatchUI';

type SourceFilter = 'all' | MonitoringSource['status'];

const FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'online', label: 'Online' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'configured', label: 'Configured' },
  { value: 'provider-needed', label: 'Provider needed' },
  { value: 'not-integrated', label: 'Not integrated' },
];

export default function SourcesScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<SourceFilter>('all');
  const { data, error, isPending, isRefetching, refetch } =
    useGetMonitoringBriefing(undefined, {
      query: {
        queryKey: getGetMonitoringBriefingQueryKey(),
        refetchInterval: 60_000,
        staleTime: 25_000,
      },
    });

  const sources = useMemo(
    () =>
      (data?.sources ?? []).filter(
        (source) => filter === 'all' || source.status === filter,
      ),
    [data?.sources, filter],
  );
  const onlineCount =
    data?.sources.filter((source) => source.status === 'online').length ?? 0;
  const providerNeededCount =
    data?.sources.filter((source) => source.status === 'provider-needed').length ?? 0;
  const notIntegratedCount =
    data?.sources.filter((source) => source.status === 'not-integrated').length ?? 0;

  if (isPending) {
    return (
      <ScreenScroll>
        <ScreenTitle eyebrow="SIGNALWATCH / SOURCE LEDGER" title="Sources" />
        <LoadingState label="Checking public source availability…" />
      </ScreenScroll>
    );
  }
  if (!data && error) {
    return (
      <ScreenScroll>
        <ScreenTitle eyebrow="SIGNALWATCH / SOURCE LEDGER" title="Sources" />
        <ErrorState
          message={error instanceof Error ? error.message : 'Please try again.'}
          onRetry={() => void refetch()}
        />
      </ScreenScroll>
    );
  }
  if (!data) return null;

  return (
    <ScreenScroll
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    >
      <ScreenTitle
        eyebrow="SIGNALWATCH / SOURCE LEDGER"
        title="Sources"
        subtitle="Availability and attribution, not estimates of unverified coverage."
      />
      <View
        style={[
          styles.summaryPanel,
          { backgroundColor: colors.sidebar, borderColor: colors.sidebar },
        ]}
      >
        <Text style={[styles.summaryLabel, { color: colors.sidebarForeground }]}>
          SOURCE STATUS
        </Text>
        <View style={styles.summaryNumbers}>
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: colors.sidebarForeground }]}>
              {onlineCount}
            </Text>
            <Text style={[styles.summaryCaption, { color: colors.sidebarForeground }]}>
              ONLINE
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.sidebarForeground }]} />
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: colors.sidebarForeground }]}>
              {providerNeededCount}
            </Text>
            <Text style={[styles.summaryCaption, { color: colors.sidebarForeground }]}>
              PROVIDER NEEDED
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.sidebarForeground }]} />
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: colors.sidebarForeground }]}>
              {notIntegratedCount}
            </Text>
            <Text style={[styles.summaryCaption, { color: colors.sidebarForeground }]}>
              NOT INTEGRATED
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.filterList}>
        {FILTERS.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            selected={filter === item.value}
            onPress={() => setFilter(item.value)}
            testID={`source-filter-${item.value}`}
          />
        ))}
      </View>
      <View style={styles.sourceList}>
        {sources.map((source) => (
          <SourceCard key={source.id} item={source} />
        ))}
        {sources.length === 0 ? (
          <EmptyState
            icon="radio"
            title="No sources in this group"
            message="Choose another status to review the source ledger."
          />
        ) : null}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  summaryPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  summaryLabel: {
    fontFamily: 'DMMonoMedium',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  summaryNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  summaryCell: {
    gap: 2,
  },
  summaryValue: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 25,
    fontWeight: '700',
  },
  summaryCaption: {
    fontFamily: 'DMMono',
    fontSize: 9,
    letterSpacing: 0.3,
    opacity: 0.8,
  },
  summaryDivider: {
    height: 34,
    width: StyleSheet.hairlineWidth,
    opacity: 0.28,
  },
  filterList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  sourceList: {
    gap: 9,
  },
});