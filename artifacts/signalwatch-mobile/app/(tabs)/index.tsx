import { Feather } from '@expo/vector-icons';
import {
  getGetMonitoringBriefingQueryKey,
  useGetMonitoringBriefing,
} from '@workspace/api-client-react';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import {
  ErrorState,
  EmptyState,
  LoadingState,
  NewsCard,
  ScreenScroll,
  ScreenTitle,
  SectionHeading,
  StatTile,
  openExternal,
} from '@/components/SignalwatchUI';
import { WorldEventMap } from '@/components/WorldEventMap';
import { Pressable, Text, View, StyleSheet } from 'react-native';

export default function BriefingScreen() {
  const colors = useColors();
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
  } = useGetMonitoringBriefing(undefined, {
    query: {
      queryKey: getGetMonitoringBriefingQueryKey(),
      refetchInterval: 60_000,
      staleTime: 25_000,
    },
  });

  if (isPending) {
    return (
      <ScreenScroll>
        <ScreenTitle eyebrow="SIGNALWATCH / LIVE MONITORING" title="Briefing" />
        <LoadingState label="Connecting to public monitoring feeds…" />
      </ScreenScroll>
    );
  }
  if (!data && error) {
    return (
      <ScreenScroll>
        <ScreenTitle eyebrow="SIGNALWATCH / LIVE MONITORING" title="Briefing" />
        <ErrorState
          message={error instanceof Error ? error.message : 'Please try again.'}
          onRetry={() => void refetch()}
        />
      </ScreenScroll>
    );
  }
  if (!data) return null;

  const channels = data.sources.filter(
    (source) => source.category === 'Public live video',
  );
  const items = data.headlines.slice(0, 5);
  const latestEvents = data.events.slice(0, 24);
  const onlinePublishers = data.sources.filter(
    (source) => source.category === 'Global news' && source.status === 'online',
  ).length;

  return (
    <ScreenScroll
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    >
      <ScreenTitle
        eyebrow="SIGNALWATCH / LIVE MONITORING"
        title="Briefing"
        subtitle="Public reporting and event signals, with every source visible."
      />

      {error ? (
        <View style={[styles.staleBanner, { backgroundColor: colors.muted }]}>
          <Feather name="alert-triangle" size={15} color={colors.accentForeground} />
          <Text style={[styles.staleText, { color: colors.foreground }]}>
            Showing the last briefing. The latest refresh failed.
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.statusPanel,
          { backgroundColor: colors.sidebar, borderColor: colors.sidebar },
        ]}
      >
        <View style={styles.statusTop}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.kicker, { color: colors.sidebarForeground }]}>
            PUBLIC FEEDS
          </Text>
          <Text style={[styles.updated, { color: colors.sidebarForeground }]}>
            UPDATED {new Date(data.generatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.sidebarForeground }]}>
          A world in motion.
        </Text>
        <Text style={[styles.heroCopy, { color: colors.sidebarForeground }]}>
          Independent public sources, brought into one view.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatTile label="HEADLINES" value={data.headlineCount} />
        <StatTile label="EVENTS" value={data.eventCount} />
        <StatTile label="SOURCES" value={data.sourcesOnline} />
      </View>

      <View>
        <SectionHeading title="World event map" trailing={`${latestEvents.length} SIGNALS`} />
        <WorldEventMap events={latestEvents} height={184} />
        <Pressable
          accessibilityRole="button"
          testID="open-full-map"
          onPress={() => router.push('/map')}
          style={({ pressed }) => [
            styles.mapLink,
            { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.linkText, { color: colors.foreground }]}>
            Explore all event signals
          </Text>
          <Feather name="arrow-right" size={15} color={colors.foreground} />
        </Pressable>
      </View>

      <View>
        <SectionHeading
          title="Public live channels"
          trailing="PUBLISHER PLAYERS"
        />
        <View style={styles.channelList}>
          {channels.map((channel) => (
            <Pressable
              key={channel.id}
              accessibilityRole="link"
              testID={`live-channel-${channel.id}`}
              onPress={() => void openExternal(channel.url)}
              style={({ pressed }) => [
                styles.channelCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={[styles.channelIcon, { backgroundColor: colors.accent }]}>
                <Feather name="play" size={14} color={colors.accentForeground} />
              </View>
              <View style={styles.channelInfo}>
                <Text style={[styles.channelName, { color: colors.foreground }]}>
                  {channel.name}
                </Text>
                <Text style={[styles.channelSource, { color: colors.mutedForeground }]}>
                  OFFICIAL PUBLISHER LINK
                </Text>
              </View>
              <Feather name="arrow-up-right" size={15} color={colors.mutedForeground} />
            </Pressable>
          ))}
          {channels.length === 0 ? (
            <EmptyState
              icon="video-off"
              title="No public channel links"
              message="Publisher links will appear here when configured."
            />
          ) : null}
        </View>
        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          Playback and live status are controlled by each publisher.
        </Text>
      </View>

      <View>
        <SectionHeading
          title="Global headlines"
          trailing={`${onlinePublishers} PUBLISHERS ONLINE`}
        />
        <View style={styles.newsList}>
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
          {items.length === 0 ? (
            <EmptyState
              icon="radio"
              title="No headlines available"
              message="Publisher feeds may be quiet or temporarily unavailable. Check sources for current status."
            />
          ) : null}
        </View>
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  statusPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 17,
    gap: 8,
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  kicker: {
    fontFamily: 'DMMonoMedium',
    fontSize: 9,
    letterSpacing: 0.8,
    flex: 1,
  },
  updated: {
    fontFamily: 'DMMono',
    fontSize: 8,
  },
  heroTitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.45,
    marginTop: 4,
  },
  heroCopy: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.78,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  channelList: {
    gap: 8,
  },
  channelCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelIcon: {
    width: 31,
    height: 31,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: {
    flex: 1,
    gap: 3,
  },
  channelName: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 14,
    fontWeight: '700',
  },
  channelSource: {
    fontFamily: 'DMMono',
    fontSize: 8,
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 7,
  },
  newsList: {
    gap: 8,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    marginTop: 1,
  },
  linkText: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 13,
    fontWeight: '600',
  },
  staleBanner: {
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  staleText: {
    fontFamily: 'SpaceGrotesk',
    flex: 1,
    fontSize: 12,
  },
});
