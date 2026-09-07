import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../contexts/ThemeContext';
import type { Order } from '../../types/agent';
import { shadows } from '../../theme/shadows';
import {
  availableOrdersLeafletHtml,
  type MapOrderPoint,
} from './availableOrdersMapHtml';
import { OrderCardCompact } from './OrderCardCompact';

export interface OrderMapViewProps {
  orders: Order[];
  onAccept: (order: Order) => void;
  onViewDetails: (orderId: string) => void;
  busyOrderId?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentBottomPadding?: number;
  claimEnabled?: boolean;
  claimBlockedLabel?: string;
}

interface OrderMapCommands {
  focusOrder: (orderId: string) => void;
  setUserLocation: (lat: number, lng: number, center?: boolean) => void;
  centerOnUser: () => void;
}

interface UserCoords {
  lat: number;
  lng: number;
}

function parseCoordinate(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAddress(addr: { address_line_1?: string; city?: string } | undefined): string {
  if (!addr) return '';
  return [addr.address_line_1, addr.city].filter(Boolean).join(', ');
}

function buildOrderPoint(order: Order): MapOrderPoint | null {
  const pickupAddress = order.business_location?.address;
  const pickupLat = parseCoordinate(pickupAddress?.latitude);
  const pickupLng = parseCoordinate(pickupAddress?.longitude);
  if (pickupLat == null || pickupLng == null) return null;
  return {
    id: order.id,
    orderNumber: order.order_number,
    pickupLat,
    pickupLng,
    deliveryLat: parseCoordinate(order.delivery_address?.latitude) ?? undefined,
    deliveryLng: parseCoordinate(order.delivery_address?.longitude) ?? undefined,
    commission: order.delivery_commission,
    currency: order.currency ?? 'XAF',
    isExpress: order.requires_fast_delivery,
    pickupLabel: formatAddress(pickupAddress),
    deliveryLabel: formatAddress(order.delivery_address),
  };
}

function parseSelectedOrderId(raw: string): string | null {
  try {
    const data = JSON.parse(raw) as { type?: string; orderId?: string };
    return data.type === 'select-order' && data.orderId ? data.orderId : null;
  } catch {
    return null;
  }
}

interface WebMessageEventLike {
  data?: unknown;
}

interface WebWindowLike {
  addEventListener: (type: 'message', handler: (event: WebMessageEventLike) => void) => void;
  removeEventListener: (type: 'message', handler: (event: WebMessageEventLike) => void) => void;
}

function getWebWindow(): WebWindowLike | null {
  return (globalThis as { window?: WebWindowLike }).window ?? null;
}

function injectMapCommand(webView: WebView | null, payload: object): void {
  if (!webView) return;
  const raw = JSON.stringify(payload);
  webView.injectJavaScript(
    `(function(){try{var d=${raw};var m=window.__orderMap;if(!m)return;if(d.type==='focus-order')m.focusOrder(d.orderId,{silent:true});if(d.type==='set-user-location')m.setUserLocation(d.lat,d.lng,!!d.center);if(d.type==='center-on-user')m.centerOnUser();}catch(e){}true;})();`
  );
}

const MapHtmlEmbed = forwardRef<
  OrderMapCommands,
  {
    html: string;
    onSelectOrderId: (orderId: string) => void;
    onMapReady: () => void;
  }
>(function MapHtmlEmbed({ html, onSelectOrderId, onMapReady }, ref) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<{ contentWindow?: { postMessage: (data: string, origin: string) => void } } | null>(
    null
  );

  const sendCommand = useCallback((payload: object) => {
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
      return;
    }
    injectMapCommand(webViewRef.current, payload);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusOrder: (orderId) => sendCommand({ type: 'focus-order', orderId }),
      setUserLocation: (lat, lng, center) =>
        sendCommand({ type: 'set-user-location', lat, lng, center: !!center }),
      centerOnUser: () => sendCommand({ type: 'center-on-user' }),
    }),
    [sendCommand]
  );

  useEffect(() => {
    const webWindow = Platform.OS === 'web' ? getWebWindow() : null;
    if (!webWindow) return undefined;
    const handler = (event: WebMessageEventLike) => {
      if (typeof event.data !== 'string') return;
      const orderId = parseSelectedOrderId(event.data);
      if (orderId) onSelectOrderId(orderId);
    };
    webWindow.addEventListener('message', handler);
    return () => webWindow.removeEventListener('message', handler);
  }, [onSelectOrderId]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const orderId = parseSelectedOrderId(event.nativeEvent.data);
      if (orderId) onSelectOrderId(orderId);
    },
    [onSelectOrderId]
  );

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      title: 'Available orders map',
      srcDoc: html,
      sandbox: 'allow-scripts allow-same-origin',
      ref: iframeRef,
      onLoad: onMapReady,
      style: { border: 0, width: '100%', height: '100%', flex: 1 },
    });
  }

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html }}
      onMessage={handleMessage}
      onLoadEnd={onMapReady}
      style={styles.web}
    />
  );
});

async function fetchCurrentCoords(): Promise<UserCoords | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

export function OrderMapView({
  orders,
  onAccept,
  onViewDetails,
  busyOrderId,
  refreshing = false,
  onRefresh,
  contentBottomPadding = 24,
  claimEnabled = true,
  claimBlockedLabel,
}: OrderMapViewProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const mapRef = useRef<OrderMapCommands>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapPoints = useMemo(
    () => orders.map(buildOrderPoint).filter((point): point is MapOrderPoint => point != null),
    [orders]
  );
  const mapOrderIds = useMemo(() => mapPoints.map((point) => point.id), [mapPoints]);

  const selectedIndex = useMemo(() => {
    if (!selectedOrderId) return mapOrderIds.length > 0 ? 0 : -1;
    const index = mapOrderIds.indexOf(selectedOrderId);
    return index >= 0 ? index : mapOrderIds.length > 0 ? 0 : -1;
  }, [mapOrderIds, selectedOrderId]);

  const activeMapOrderId = useMemo(
    () => (selectedIndex >= 0 ? mapOrderIds[selectedIndex] ?? null : null),
    [mapOrderIds, selectedIndex]
  );

  const selectedOrder = useMemo(
    () => (activeMapOrderId ? orders.find((order) => order.id === activeMapOrderId) ?? null : null),
    [activeMapOrderId, orders]
  );

  useEffect(() => {
    if (mapOrderIds.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !mapOrderIds.includes(selectedOrderId)) {
      setSelectedOrderId(mapOrderIds[0]);
    }
  }, [mapOrderIds, selectedOrderId]);

  const syncMapSelection = useCallback(
    (orderId: string | null) => {
      if (!orderId || !mapOrderIds.includes(orderId)) return;
      mapRef.current?.focusOrder(orderId);
      if (userCoords) {
        mapRef.current?.setUserLocation(userCoords.lat, userCoords.lng, false);
      }
    },
    [mapOrderIds, userCoords]
  );

  const handleMapReady = useCallback(() => {
    syncMapSelection(activeMapOrderId);
  }, [activeMapOrderId, syncMapSelection]);

  useEffect(() => {
    if (!activeMapOrderId) return;
    mapRef.current?.focusOrder(activeMapOrderId);
  }, [activeMapOrderId]);

  const html = useMemo(() => {
    if (mapPoints.length === 0) return '';
    return availableOrdersLeafletHtml({
      points: mapPoints,
      pickupColor: colors.primary.main,
      deliveryColor: colors.info.main,
      highlightColor: colors.warning.main,
      userColor: colors.info.dark,
      lineColor: colors.primary.main,
      textColor: colors.text.primary,
      surfaceColor: colors.surface,
      pickupLabel: t('agent.orders.pickup', 'Pickup'),
      deliveryLabel: t('agent.orders.dropoff', 'Dropoff'),
      expressLabel: t('agent.openOrders.fastDelivery', 'Express'),
      youLabel: t('agent.orders.mapYou', 'You'),
    });
  }, [
    colors.surface,
    colors.info.dark,
    colors.info.main,
    colors.primary.main,
    colors.text.primary,
    colors.warning.main,
    mapPoints,
    t,
  ]);

  const goToRelativeOrder = useCallback(
    (delta: number) => {
      if (mapOrderIds.length === 0 || selectedIndex < 0) return;
      const nextIndex = (selectedIndex + delta + mapOrderIds.length) % mapOrderIds.length;
      setSelectedOrderId(mapOrderIds[nextIndex]);
    },
    [mapOrderIds, selectedIndex]
  );

  const centerOnMyLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const coords = await fetchCurrentCoords();
      if (!coords) {
        setLocationError(
          t('agent.orders.mapLocationUnavailable', 'Could not get your location. Check permissions.')
        );
        return;
      }
      setUserCoords(coords);
      mapRef.current?.setUserLocation(coords.lat, coords.lng, true);
    } catch {
      setLocationError(
        t('agent.orders.mapLocationUnavailable', 'Could not get your location. Check permissions.')
      );
    } finally {
      setLocating(false);
    }
  }, [t]);

  const missingLocationCount = orders.length - mapPoints.length;
  const canNavigate = mapOrderIds.length > 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {mapPoints.length > 0 && html ? (
        <>
          <MapHtmlEmbed
            ref={mapRef}
            html={html}
            onSelectOrderId={setSelectedOrderId}
            onMapReady={handleMapReady}
          />
          <View
            pointerEvents="box-none"
            style={[styles.mapHeader, { left: spacing.md, right: spacing.md, top: spacing.sm }]}
          >
            <View
              style={[
                styles.summaryPill,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.divider,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <MaterialCommunityIcons name="map-marker-multiple" size={18} color={colors.primary.main} />
              <Text variant="labelMedium" style={[styles.summaryText, { color: colors.text.primary }]}>
                {t('agent.orders.mapOrderCount', '{{count}} order on map', {
                  count: mapPoints.length,
                  defaultValue_plural: '{{count}} orders on map',
                })}
              </Text>
              {missingLocationCount > 0 ? (
                <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                  {t('agent.orders.mapMissingLocationCount', '{{count}} without GPS', {
                    count: missingLocationCount,
                    defaultValue_plural: '{{count}} without GPS',
                  })}
                </Text>
              ) : null}
              {onRefresh ? (
                <Pressable onPress={onRefresh} hitSlop={10} style={styles.refreshButton}>
                  {refreshing ? (
                    <ActivityIndicator size={16} color={colors.primary.main} />
                  ) : (
                    <MaterialCommunityIcons name="refresh" size={18} color={colors.text.secondary} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          <View
            pointerEvents="box-none"
            style={[styles.myLocationWrap, { right: spacing.md, top: spacing.sm + 56 }]}
          >
            {locating ? (
              <View
                style={[
                  styles.myLocationButton,
                  shadows.sm,
                  {
                    backgroundColor: colors.surface,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <ActivityIndicator size={18} color={colors.primary.main} />
              </View>
            ) : (
              <IconButton
                icon="crosshairs-gps"
                mode="contained"
                size={22}
                onPress={() => void centerOnMyLocation()}
                accessibilityLabel={t('agent.orders.mapMyLocation', 'Center on my location')}
                style={[
                  styles.myLocationButton,
                  shadows.sm,
                  { backgroundColor: colors.surface },
                ]}
                iconColor={colors.primary.main}
              />
            )}
          </View>

          {locationError ? (
            <View
              pointerEvents="none"
              style={[
                styles.locationError,
                { top: spacing.sm + 108, left: spacing.md, right: spacing.md + 56 },
              ]}
            >
              <Text variant="labelSmall" style={{ color: colors.error.main, textAlign: 'center' }}>
                {locationError}
              </Text>
            </View>
          ) : null}

          {selectedOrder ? (
            <View
              pointerEvents="box-none"
              style={[styles.selectedCard, { paddingBottom: contentBottomPadding, paddingTop: spacing.sm }]}
            >
              <View
                style={[
                  styles.navBar,
                  shadows.sm,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.divider,
                    borderRadius: borderRadius.md,
                    marginHorizontal: spacing.md,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <IconButton
                  icon="chevron-left"
                  size={22}
                  disabled={!canNavigate}
                  onPress={() => goToRelativeOrder(-1)}
                  accessibilityLabel={t('agent.orders.mapPrevOrder', 'Previous order')}
                />
                <Pressable
                  onPress={() => activeMapOrderId && mapRef.current?.focusOrder(activeMapOrderId)}
                  style={styles.navCenter}
                  accessibilityRole="button"
                  accessibilityLabel={t('agent.orders.mapShowOnMap', 'Show on map')}
                >
                  <MaterialCommunityIcons name="map-marker" size={16} color={colors.primary.main} />
                  <Text variant="labelMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
                    {t('agent.orders.mapOrderPosition', '{{current}} of {{total}}', {
                      current: selectedIndex + 1,
                      total: mapOrderIds.length,
                    })}
                  </Text>
                  <Text variant="labelSmall" style={{ color: colors.primary.main }}>
                    {t('agent.orders.mapShowOnMap', 'Show on map')}
                  </Text>
                </Pressable>
                <IconButton
                  icon="chevron-right"
                  size={22}
                  disabled={!canNavigate}
                  onPress={() => goToRelativeOrder(1)}
                  accessibilityLabel={t('agent.orders.mapNextOrder', 'Next order')}
                />
              </View>
              <OrderCardCompact
                order={selectedOrder}
                onAccept={() => onAccept(selectedOrder)}
                onViewDetails={() => onViewDetails(selectedOrder.id)}
                isBusy={busyOrderId === selectedOrder.id}
                claimEnabled={claimEnabled}
                acceptLabel={claimEnabled ? undefined : claimBlockedLabel}
              />
            </View>
          ) : null}
        </>
      ) : (
        <View style={[styles.emptyState, { paddingHorizontal: spacing.xl }]}>
          {refreshing ? (
            <ActivityIndicator size="large" color={colors.primary.main} />
          ) : (
            <MaterialCommunityIcons name="map-marker-off-outline" size={52} color={colors.text.disabled} />
          )}
          <Text variant="titleSmall" style={[styles.emptyTitle, { color: colors.text.primary }]}>
            {refreshing
              ? t('agent.orders.mapLoading', 'Loading order map')
              : orders.length > 0
                ? t('agent.orders.mapNoLocationsTitle', 'No mappable orders')
                : t('agent.openOrders.noOrdersFound', 'No orders available')}
          </Text>
          <Text variant="bodySmall" style={[styles.emptyText, { color: colors.text.secondary }]}>
            {orders.length > 0
              ? t(
                  'agent.orders.mapNoLocationsHint',
                  'Available orders need pickup GPS coordinates before they can appear on the map.'
                )
              : t('agent.home.checkBackSoon', 'Pull to refresh to check for new orders')}
          </Text>
          {onRefresh ? (
            <Button mode="outlined" icon="refresh" onPress={onRefresh} loading={refreshing} disabled={refreshing}>
              {t('common.retry', 'Retry')}
            </Button>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  web: { flex: 1 },
  mapHeader: {
    position: 'absolute',
  },
  summaryPill: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    fontWeight: '700',
  },
  refreshButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myLocationWrap: {
    position: 'absolute',
  },
  myLocationButton: {
    margin: 0,
  },
  locationError: {
    position: 'absolute',
  },
  selectedCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  navCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
