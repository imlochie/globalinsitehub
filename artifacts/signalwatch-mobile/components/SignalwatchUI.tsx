import { Feather } from '@expo/vector-icons';
import type {
  MonitoringEvent,
  MonitoringHeadline,
  MonitoringSource,
} from '@workspace/api-client-react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open link', 'The publisher link could not be opened.');
  }
}

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.screenContent,
        {
          paddingTop: web ? 16 : Math.max(12, insets.top),
          paddingBottom: web ? 118 : 34,
          backgroundColor: colors.background,
        },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function ScreenTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  const colors = useColors();

  return (
    <View style={styles.screenTitle}>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
        {eyebrow}
      </Text>
      <Text style={[styles.screenHeading, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.screenSubtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionHeading({
  title,
  trailing,
}: {
  title: string;
  trailing?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {trailing ? (
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

export function StatTile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

export function StatusPill({
  status,
  category,
}: {
  status: MonitoringSource['status'];
  category?: string;
}) {
  const colors = useColors();
  const isOnline = status === 'online';
  const isUnavailable = status === 'unavailable';
  const needsProvider = status === 'provider-needed';
  const notIntegrated = status === 'not-integrated';
  const label = isOnline
    ? 'ONLINE'
    : isUnavailable
      ? 'UNAVAILABLE'
      : category === 'Public live video' && status === 'configured'
        ? 'PUBLISHER LINK'
        : needsProvider
          ? 'PROVIDER NEEDED'
          : notIntegrated
            ? 'NOT INTEGRATED'
            : 'CONFIGURED';
  const color = isOnline
    ? colors.success
    : isUnavailable
      ? colors.destructive
      : needsProvider
        ? colors.accentForeground
        : colors.mutedForeground;
  const icon = isOnline
    ? 'check-circle'
    : isUnavailable
      ? 'alert-triangle'
      : category === 'Public live video'
        ? 'external-link'
        : needsProvider
          ? 'settings'
          : notIntegrated
            ? 'alert-circle'
            : 'layers';

  return (
    <View style={[styles.statusPill, { backgroundColor: colors.muted }]}>
      <Feather name={icon} size={12} color={color} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statePanel,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ActivityIndicator color={colors.accent} />
      <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statePanel,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name="alert-circle" size={22} color={colors.destructive} />
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>
        Monitoring data is unavailable
      </Text>
      <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        testID="retry-monitoring"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
          Retry connection
        </Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.emptyPanel,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name={icon} size={21} color={colors.mutedForeground} />
      <View style={styles.flex}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

export function NewsCard({ item }: { item: MonitoringHeadline }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      testID={`headline-${item.id}`}
      onPress={() => void openExternal(item.url)}
      style={({ pressed }) => [
        styles.contentCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.cardMetaRow}>
        <Text style={[styles.metaStrong, { color: colors.success }]}>
          {item.source.toUpperCase()}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {formatTime(item.publishedAt)}
        </Text>
      </View>
      <Text style={[styles.newsTitle, { color: colors.foreground }]}>
        {item.title}
      </Text>
      {item.summary ? (
        <Text
          numberOfLines={3}
          style={[styles.bodyText, { color: colors.mutedForeground }]}
        >
          {item.summary}
        </Text>
      ) : null}
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {item.language.toUpperCase()} · ORIGINAL REPORT
        </Text>
        <Feather name="arrow-up-right" size={15} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

export function EventCard({ item }: { item: MonitoringEvent }) {
  const colors = useColors();
  const place = item.detail || item.category;
  return (
    <Pressable
      accessibilityRole="link"
      testID={`event-${item.id}`}
      onPress={() => void openExternal(item.url)}
      style={({ pressed }) => [
        styles.contentCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.cardMetaRow}>
        <Text style={[styles.metaStrong, { color: colors.accent }]}>
          {item.category.toUpperCase()}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {formatTime(item.occurredAt)}
        </Text>
      </View>
      <Text style={[styles.newsTitle, { color: colors.foreground }]}>
        {item.title}
      </Text>
      <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
        {place}
        {item.magnitude !== null ? ` · M${item.magnitude.toFixed(1)}` : ''}
      </Text>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {item.source.toUpperCase()}
          {item.latitude !== null && item.longitude !== null
            ? ` · ${item.latitude.toFixed(2)}, ${item.longitude.toFixed(2)}`
            : ' · LOCATION NOT PROVIDED'}
        </Text>
        <Feather name="arrow-up-right" size={15} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

export function SourceCard({ item }: { item: MonitoringSource }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.sourceCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardMetaRow}>
        <View style={styles.flex}>
          <Text style={[styles.metaStrong, { color: colors.mutedForeground }]}>
            {item.category.toUpperCase()}
          </Text>
          <Text style={[styles.sourceTitle, { color: colors.foreground }]}>
            {item.name}
          </Text>
        </View>
        <StatusPill
          status={item.status}
          category={item.category}
        />
      </View>
      <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
        {item.message}
      </Text>
      <View style={[styles.sourceFooter, { borderTopColor: colors.border }]}>
        <View style={styles.flex}>
          <Text style={[styles.meta, { color: colors.foreground }]}>
            {item.attribution}
          </Text>
          {item.status === 'online' ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {item.itemsReceived} items · checked {formatTime(item.checkedAt)}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${item.name} source`}
          testID={`source-link-${item.id}`}
          onPress={() => void openExternal(item.url)}
          hitSlop={8}
        >
          <Feather name="external-link" size={17} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export function FilterChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.filterText,
          { color: selected ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'TIME UNKNOWN'
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 18,
    gap: 18,
  },
  screenTitle: {
    gap: 4,
    paddingBottom: 2,
  },
  eyebrow: {
    fontFamily: 'DMMonoMedium',
    fontSize: 10,
    letterSpacing: 1.1,
  },
  screenHeading: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  screenSubtitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  meta: {
    fontFamily: 'DMMono',
    fontSize: 10,
    lineHeight: 15,
  },
  metaStrong: {
    fontFamily: 'DMMonoMedium',
    fontSize: 10,
    letterSpacing: 0.35,
  },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 9,
    gap: 4,
  },
  statValue: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 22,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: 'DMMonoMedium',
    fontSize: 9,
    letterSpacing: 0.25,
  },
  statePanel: {
    minHeight: 190,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 12,
  },
  emptyPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  contentCard: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 14,
    gap: 9,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  newsTitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  sourceTitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 16,
    fontWeight: '700',
  },
  bodyText: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sourceCard: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 14,
    gap: 10,
  },
  sourceFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  buttonText: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 14,
    fontWeight: '700',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterText: {
    fontFamily: 'DMMonoMedium',
    fontSize: 10,
  },
  flex: {
    flex: 1,
  },
});