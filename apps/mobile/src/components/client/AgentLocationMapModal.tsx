import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { ActivityIndicator, Button, Divider, Modal, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { WebView } from 'react-native-webview';
import { agentApi } from '../../services/agentApi';
import { useOrderAgentLocationSubscription } from '../../hooks/useOrderAgentLocationSubscription';

export interface AgentLocationMapModalProps {
  visible: boolean;
  orderId: string;
  onDismiss: () => void;
}

/** Opens Apple Maps on iOS, geo intent on Android, Google Maps in browser on web. */
export function openAgentLocationInMaps(lat: number, lng: number): void {
  const label = encodeURIComponent('Agent');
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`
      : Platform.OS === 'android'
        ? `geo:${lat},${lng}?q=${lat},${lng}(${label})`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  void Linking.openURL(url);
}

interface LeafletMapOptions {
  agentLat: number;
  agentLng: number;
  clientLat?: number | null;
  clientLng?: number | null;
  agentColor: string;
  clientColor: string;
  lineColor: string;
  agentLabel: string;
  youLabel: string;
}

function leafletHtml(opts: LeafletMapOptions): string {
  const { agentLat, agentLng, clientLat, clientLng } = opts;
  const hasClient = clientLat != null && clientLng != null;
  const clientLayer = hasClient
    ? `var you=L.circleMarker([${clientLat},${clientLng}],{radius:8,color:'#fff',weight:2,fillColor:'${opts.clientColor}',fillOpacity:1}).addTo(map).bindPopup('${opts.youLabel}');
L.polyline([[${agentLat},${agentLng}],[${clientLat},${clientLng}]],{color:'${opts.lineColor}',weight:3,opacity:0.65,dashArray:'6,8'}).addTo(map);
map.fitBounds(L.latLngBounds([[${agentLat},${agentLng}],[${clientLat},${clientLng}]]),{padding:[60,60],maxZoom:16});`
    : `map.setView([${agentLat},${agentLng}],14);`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{height:100%;width:100%;margin:0;padding:0}</style></head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var map=L.map('m',{zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
L.circleMarker([${agentLat},${agentLng}],{radius:9,color:'#fff',weight:2,fillColor:'${opts.agentColor}',fillOpacity:1}).addTo(map).bindPopup('${opts.agentLabel}');
${clientLayer}
</script></body></html>`;
}

/** Haversine distance in kilometers. */
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapHtmlEmbed({ html }: { html: string }) {
  if (Platform.OS === 'web') {
    return createElement('iframe', {
      title: 'Agent location map',
      srcDoc: html,
      sandbox: 'allow-scripts allow-same-origin',
      style: { border: 0, width: '100%', height: '100%', flex: 1 },
    });
  }
  return <WebView originWhitelist={['*']} source={{ html }} style={styles.web} />;
}

export function AgentLocationMapModal({ visible, orderId, onDismiss }: AgentLocationMapModalProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [agentLoc, setAgentLoc] = useState<{ lat: number; lng: number; updatedAt: string } | null>(null);
  const [clientLoc, setClientLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAgent = useCallback(async () => {
    if (!orderId || !visible) return;
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.orders.getOrderAgentLocation(orderId);
      if (res.success && res.location) {
        setAgentLoc({
          lat: res.location.latitude,
          lng: res.location.longitude,
          updatedAt: res.location.updatedAt,
        });
      } else {
        setAgentLoc(null);
        if (res.error) setError(res.error);
      }
    } catch (e: unknown) {
      setAgentLoc(null);
      setError(e instanceof Error ? e.message : 'Location error');
    } finally {
      setLoading(false);
    }
  }, [orderId, visible]);

  const loadClient = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setClientLoc(null);
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setClientLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }, []);

  // Live agent position via Hasura subscription (scoped to this order's agent).
  const { location: liveLoc } = useOrderAgentLocationSubscription(orderId, visible);

  useEffect(() => {
    if (!visible) return;
    // One-shot REST fetch for the initial paint / fallback; live updates arrive via subscription.
    void loadAgent();
    void loadClient();
  }, [visible, loadAgent, loadClient]);

  useEffect(() => {
    if (liveLoc) {
      setAgentLoc(liveLoc);
      setLoading(false);
    }
  }, [liveLoc]);

  const html = useMemo(() => {
    if (!agentLoc) return '';
    return leafletHtml({
      agentLat: agentLoc.lat,
      agentLng: agentLoc.lng,
      clientLat: clientLoc?.lat,
      clientLng: clientLoc?.lng,
      agentColor: colors.primary.main,
      clientColor: colors.info.main,
      lineColor: colors.primary.main,
      agentLabel: t('orders.mapAgentLabel', 'Agent'),
      youLabel: t('orders.mapYouLabel', 'You'),
    });
  }, [agentLoc, clientLoc, colors.primary.main, colors.info.main, t]);

  const distanceText = useMemo(() => {
    if (!agentLoc || !clientLoc) return null;
    const km = distanceKm(agentLoc.lat, agentLoc.lng, clientLoc.lat, clientLoc.lng);
    return km < 1
      ? t('orders.distanceMeters', '{{value}} m away', { value: Math.round(km * 1000) })
      : t('orders.distanceKm', '{{value}} km away', { value: km.toFixed(1) });
  }, [agentLoc, clientLoc, t]);

  const onOpenMaps = useCallback(() => {
    if (!agentLoc) return;
    openAgentLocationInMaps(agentLoc.lat, agentLoc.lng);
  }, [agentLoc]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.fullscreen,
          {
            width: windowWidth,
            height: windowHeight,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text variant="titleLarge">{t('orders.viewOnMap', 'View agent location on map')}</Text>
          {distanceText ? (
            <Text variant="bodyMedium" style={{ color: colors.primary.main, fontWeight: '700', marginTop: 2 }}>
              {distanceText}
            </Text>
          ) : agentLoc && !clientLoc ? (
            <Text
              variant="bodySmall"
              onPress={() => void loadClient()}
              style={{ color: colors.info.main, marginTop: 2 }}
            >
              {t('orders.enableLocationForDistance', 'Enable location to see your distance')}
            </Text>
          ) : null}
          {agentLoc?.updatedAt ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {t('orders.agentLocationUpdated', 'Updated: {{time}}', {
                time: new Date(agentLoc.updatedAt).toLocaleString(),
              })}
            </Text>
          ) : null}
        </View>
        <Divider />

        <View style={styles.body}>
          {agentLoc && html ? (
            <MapHtmlEmbed html={html} />
          ) : (
            <View style={styles.center}>
              {loading ? (
                <ActivityIndicator />
              ) : error ? (
                <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
                  {error}
                </Text>
              ) : (
                <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
                  {t('orders.agentLocationUnavailable', 'Agent location is not available yet.')}
                </Text>
              )}
            </View>
          )}
        </View>

        <Divider />
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Button onPress={onDismiss}>{t('common.close', 'Close')}</Button>
          {agentLoc ? (
            <Button mode="contained" icon="map" onPress={onOpenMaps}>
              {Platform.OS === 'web'
                ? t('orders.openInMapsBrowser', 'Open in Google Maps')
                : t('orders.openInMapsApp', 'Open in Maps')}
            </Button>
          ) : null}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, margin: 0, alignSelf: 'stretch' },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  web: { flex: 1 },
});
