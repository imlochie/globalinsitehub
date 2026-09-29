import type { MonitoringEvent } from '@workspace/api-client-react';
import {
  getGetMonitoringBriefingQueryKey,
  useGetMonitoringBriefing,
} from '@workspace/api-client-react';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  EmptyState,
  ErrorState,
  EventCard,
  FilterChip,
  LoadingState,
  ScreenScroll,
  ScreenTitle,
} from '@/components/SignalwatchUI';
import { WorldEventMap } from '@/components/WorldEventMap';

type MapFilter = 'all-events' | 'mapped-only';

export default function EventMapScreen() {
  const colors = useColors();
  const [category, setCategory] = useState('All');
  const [mapFilter, setMapFilter] = useState<MapFilter>('all-events');
  const { data, error, isPending, isRefetching, refetch } =
    useGetMonitoringBriefing(undefined, {
      query: {
        queryKey: getGetMonitoringBriefingQueryKey(),
        refetchInterval: 60_000,
        staleTime: 25_000,
      },
    });

  const categories = useMemo(
    () => ['All', ...new Set(data?.events.map((event) => event.category) ?? [])],
    [data?.events],
  );
  const visibleEvents = useMemo<MonitoringEvent[]>(() => {
    let events = data?.events ?? [];
    if (category !== 'All') {
      events = events.filter((event) => event.category === category);
    }
    if (mapFilter === 'mapped-only') {
      events = events.filter(
        (event) => event.latitude !== null && event.longitude !== null,
      );
    }
    return events;
  }, [category, data?.events, mapFilter]);

  if (isPending) {
    return (
      <ScreenScroll>
        <ScreenTitle eyebrow="SIGNALWATCH / EVENT INTELLIGENCE" title="Event map" />
        <LoadingState label="Loading geolocated public events…" />
      </ScreenScroll>
    );
  }
  if (!data && error) {
    return (
      <ScreenScroll>
        <ScreenTitle eyebrow="SIGNALWATCH / EVENT INTELLIGENCE" title="Event map" />
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
        eyebrow="SIGNALWATCH / EVENT INTELLIGENCE"
        title="Event map"
        subtitle="Only coordinates returned by the public event sources are plotted."
      />
      <View style={styles.filterRow}>
        <FilterChip
          label="All events"
          selected={mapFilter === 'all-events'}
          onPress={() => setMapFilter('all-events')}
          testID="map-filter-all"
        />
        <FilterChip
          label="Mapped only"
          selected={mapFilter === 'mapped-only'}
          onPress={() => setMapFilter('mapped-only')}
          testID="map-filter-mapped"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
      >
        {categories.map((item) => (
          <FilterChip
            key={item}
            label={item === 'All' ? 'All categories' : item}
            selected={category === item}
            onPress={() => setCategory(item)}
            testID={`category-${item.toLowerCase().replace(/\s+/g, '-')}`}
          />
        ))}
      </ScrollView>
      <View style={styles.mapBlock}>
        <WorldEventMap events={visibleEvents} height={254} />
        <Text style={[styles.mapSummary, { color: colors.mutedForeground }]}>
          {visibleEvents.filter((event) => event.latitude !== null && event.longitude !== null).length}
          {' '}of {visibleEvents.length} shown with coordinates · refreshes every minute
        </Text>
      </View>
      <View style={styles.eventList}>
        <Text style={[styles.listHeading, { color: colors.foreground }]}>
          Public event signals
        </Text>
        {visibleEvents.map((event) => (
          <EventCard key={event.id} item={event} />
        ))}
        {visibleEvents.length === 0 ? (
          <EmptyState
            icon="map-pin"
            title="No matching events"
            message="Try a different category or switch back to all public events."
          />
        ) : null}
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryList: {
    gap: 7,
    paddingVertical: 1,
  },
  mapBlock: {
    gap: 8,
  },
  mapSummary: {
    fontFamily: 'DMMono',
    fontSize: 10,
    lineHeight: 16,
  },
  eventList: {
    gap: 9,
  },
  listHeading: {
    fontFamily: 'SpaceGrotesk',
    fontWeight: '700',
    fontSize: 19,
    marginBottom: 2,
  },
});