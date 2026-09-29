import { Feather } from '@expo/vector-icons';
import type { MonitoringEvent } from '@workspace/api-client-react';
import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { openExternal } from '@/components/SignalwatchUI';

type MapMode = 'street' | 'satellite';

const TILE_URLS: Record<MapMode, string> = {
  street: 'https://tile.openstreetmap.org/0/0/0.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0',
};

const ATTRIBUTION: Record<MapMode, string> = {
  street: '© OpenStreetMap contributors',
  satellite:
    'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
};

function mercatorY(latitude: number) {
  const clipped = Math.max(-85.0511, Math.min(85.0511, latitude));
  const radians = (clipped * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
}

function isMappable(event: MonitoringEvent) {
  return (
    event.latitude !== null &&
    event.longitude !== null &&
    Math.abs(event.latitude) <= 90 &&
    Math.abs(event.longitude) <= 180
  );
}

export function WorldEventMap({
  events,
  height = 216,
}: {
  events: MonitoringEvent[];
  height?: number;
}) {
  const colors = useColors();
  const [mode, setMode] = useState<MapMode>('street');
  const [tileFailed, setTileFailed] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<MonitoringEvent | null>(null);
  const mappable = events.filter(isMappable);

  const toggleMode = () => {
    setMode((current) => (current === 'street' ? 'satellite' : 'street'));
    setTileFailed(false);
  };

  return (
    <View
      accessibilityLabel={`World map with ${mappable.length} geolocated events`}
      testID="world-event-map"
      onLayout={(event) =>
        setSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
      style={[
        styles.mapFrame,
        {
          height,
          backgroundColor: colors.secondary,
          borderColor: colors.border,
        },
      ]}
    >
      {tileFailed ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.secondary }]}>
          <View style={[styles.gridLine, { backgroundColor: colors.border, left: '25%' }]} />
          <View style={[styles.gridLine, { backgroundColor: colors.border, left: '50%' }]} />
          <View style={[styles.gridLine, { backgroundColor: colors.border, left: '75%' }]} />
          <View style={[styles.gridRow, { backgroundColor: colors.border, top: '33%' }]} />
          <View style={[styles.gridRow, { backgroundColor: colors.border, top: '66%' }]} />
        </View>
      ) : (
        <Image
          accessibilityLabel={ATTRIBUTION[mode]}
          source={{ uri: TILE_URLS[mode] }}
          resizeMode="stretch"
          onError={() => setTileFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.mapControls}>
        <Text style={[styles.mapLabel, { color: colors.sidebarForeground, backgroundColor: colors.sidebar }]}>
          {mappable.length} MAPPED
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${mode === 'street' ? 'satellite' : 'street'} map`}
          testID="toggle-map-style"
          onPress={toggleMode}
          style={({ pressed }) => [
            styles.mapToggle,
            { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather
            name={mode === 'street' ? 'globe' : 'map'}
            size={13}
            color={colors.foreground}
          />
          <Text style={[styles.toggleText, { color: colors.foreground }]}>
            {mode === 'street' ? 'SATELLITE' : 'STREET'}
          </Text>
        </Pressable>
      </View>

      {size.width > 0 && size.height > 0
        ? mappable.slice(0, 60).map((item) => {
            const latitude = item.latitude as number;
            const longitude = item.longitude as number;
            const left = ((longitude + 180) / 360) * size.width;
            const top = mercatorY(latitude) * size.height;
            const isSelected = selected?.id === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.title}`}
                testID={`map-marker-${item.id}`}
                onPress={() => setSelected(isSelected ? null : item)}
                style={({ pressed }) => [
                  styles.marker,
                  {
                    left: Math.max(2, Math.min(size.width - 22, left - 10)),
                    top: Math.max(35, Math.min(size.height - 28, top - 10)),
                    backgroundColor: isSelected ? colors.accent : colors.destructive,
                    borderColor: colors.card,
                    transform: [{ scale: pressed ? 0.88 : 1 }],
                  },
                ]}
              >
                <Feather
                  name={item.category.toLowerCase().includes('quake') ? 'activity' : 'alert-circle'}
                  size={13}
                  color={colors.primaryForeground}
                />
              </Pressable>
            );
          })
        : null}

      {selected ? (
        <Pressable
          accessibilityRole="link"
          testID="selected-map-event"
          onPress={() => void openExternal(selected.url)}
          style={[
            styles.selectedEvent,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.flex}>
            <Text numberOfLines={2} style={[styles.selectedTitle, { color: colors.foreground }]}>
              {selected.title}
            </Text>
            <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
              {selected.source.toUpperCase()} · OPEN SOURCE
            </Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={colors.primary} />
        </Pressable>
      ) : null}

      <Text
        style={[
          styles.attribution,
          { color: colors.sidebarForeground, backgroundColor: colors.sidebar },
        ]}
      >
        {tileFailed ? 'MAP TILES UNAVAILABLE · ' : ''}
        {ATTRIBUTION[mode]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mapFrame: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 10,
    position: 'relative',
  },
  mapControls: {
    position: 'absolute',
    zIndex: 3,
    top: 9,
    left: 9,
    right: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapLabel: {
    overflow: 'hidden',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: 'DMMonoMedium',
    fontSize: 9,
    letterSpacing: 0.35,
  },
  mapToggle: {
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleText: {
    fontFamily: 'DMMonoMedium',
    fontSize: 9,
    letterSpacing: 0.25,
  },
  marker: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  attribution: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontFamily: 'DMMono',
    fontSize: 8,
    zIndex: 3,
  },
  selectedEvent: {
    position: 'absolute',
    zIndex: 4,
    left: 10,
    right: 10,
    bottom: 28,
    borderWidth: 1,
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedTitle: {
    fontFamily: 'SpaceGrotesk',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});