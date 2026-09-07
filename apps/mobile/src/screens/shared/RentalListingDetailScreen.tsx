import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageLightbox } from '../../components/common/ImageLightbox';
import { StatusPill } from '../../components/common/StatusPill';
import { TrustBadge } from '../../components/common/TrustBadge';
import { RentalRequestSheet } from '../../components/rentals/RentalRequestSheet';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalListingDetail } from '../../hooks/useRentalListingDetail';
import { useStore } from '../../stores/RootStore';
import type {
  ClientRootStackParamList,
  GuestRootStackParamList,
} from '../../navigation/types';
import { merchantCanAcceptOrders } from '../../utils/merchantLifecycle';
import { formatRentalMoney } from '../../utils/rentals';

type DetailParams = { RentalListingDetail: { listingId: string } };

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function toNumber(v: string | number): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function formatAddress(addr: {
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}): string {
  const street = [addr.address_line_1, addr.address_line_2].filter(Boolean).join(', ');
  const locality = [addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
  if (street && locality) return `${street} · ${locality}`;
  return street || locality || '';
}

function weekdayLabel(weekday: number, t: (k: string, d: string) => string): string {
  const key = WEEKDAY_KEYS[weekday] ?? 'monday';
  const defaults: Record<string, string> = {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
  };
  return t(`common.weekdays.${key}`, defaults[key] ?? key);
}

function todayCloseLabel(
  weeklySorted: Array<{ weekday: number; is_available?: boolean; end_time?: string | null }>
): string | null {
  const weekday = new Date().getDay();
  const row = weeklySorted.find((r) => r.weekday === weekday);
  if (!row?.is_available || !row.end_time) return null;
  return row.end_time.slice(0, 5);
}

const BOTTOM_BAR_HEIGHT = 120;

export default function RentalListingDetailScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { auth } = useStore();
  const route = useRoute<RouteProp<DetailParams, 'RentalListingDetail'>>();
  const navigation = useNavigation();
  const listingId = route.params?.listingId;
  const { listing, bookedWindows, loading, error, refetch } = useRentalListingDetail(listingId);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const images = listing?.rental_item.rental_item_images ?? [];
  const heroH = width * (10 / 16);

  const openLightbox = useCallback((index: number) => {
    if (!images.length) return;
    setGalleryIdx(Math.min(Math.max(0, index), images.length - 1));
    setLightboxOpen(true);
  }, [images.length]);

  const onHeroScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (images.length <= 1) return;
      const x = e.nativeEvent.contentOffset.x;
      const w = e.nativeEvent.layoutMeasurement.width || width;
      setGalleryIdx(Math.min(Math.max(0, Math.round(x / w)), images.length - 1));
    },
    [images.length, width]
  );

  const onLoginRequired = useCallback(() => {
    const parent = navigation.getParent() ?? navigation;
    (parent as unknown as NativeStackNavigationProp<GuestRootStackParamList>).navigate(
      'GuestTabs',
      { screen: 'GuestAuth', params: { screen: 'Login' } }
    );
  }, [navigation]);

  const onSubmitted = useCallback(
    (requestId: string) => {
      (navigation as unknown as NativeStackNavigationProp<ClientRootStackParamList>).navigate(
        'RentalRequestSubmitted',
        { requestId }
      );
    },
    [navigation]
  );

  const currency = listing?.rental_item.currency || 'XAF';
  const weeklySorted = useMemo(() => {
    const rows = listing?.weekly_availability ?? [];
    return [...rows].sort((a, b) => a.weekday - b.weekday);
  }, [listing?.weekly_availability]);

  if (loading && !listing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.md }]}>
          {t('rentals.loading', 'Loading rentals')}
        </Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.lg }]}>
        <Text style={[typography.h6, { color: colors.text.primary, textAlign: 'center' }]}>
          {t('rentals.detail.notFoundTitle', 'We couldn’t find this listing')}
        </Text>
        <Text
          style={[
            typography.body2,
            { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          {error || t('rentals.detail.notFoundBody', 'It may have been removed or is no longer available.')}
        </Text>
        <Button mode="contained" style={{ marginTop: spacing.md }} onPress={() => navigation.goBack()}>
          {t('rentals.detail.browseRentals', 'Browse rentals')}
        </Button>
        <Button mode="text" onPress={() => void refetch()}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const item = listing.rental_item;
  const addr = listing.business_location.address;
  const acceptsOrders = merchantCanAcceptOrders(item.business);
  const hourlyPrice = toNumber(listing.base_price_per_hour);
  const dailyPrice = toNumber(listing.base_price_per_day);
  const depositAmount = toNumber(listing.security_deposit_amount ?? 0);
  const closeToday = todayCloseLabel(weeklySorted);
  const priceSnapshotParts = [
    t('rentals.detail.fromHourly', 'From {{price}}/h', {
      price: formatRentalMoney(hourlyPrice, currency),
    }),
    closeToday
      ? t('rentals.detail.openTodayUntil', 'Open today until {{time}}', { time: closeToday })
      : null,
    t('rentals.detail.minHoursSnapshot', '{{h}}h minimum', { h: listing.min_rental_hours }),
  ].filter(Boolean);

  const pickerProps = {
    listingId: listing.id,
    isAuthenticated: auth.isAuthenticated,
    bookedWindows,
    minRentalHours: listing.min_rental_hours,
    maxRentalHours: listing.max_rental_hours,
    unitsAvailable: Number(listing.units_available) || 1,
    weeklyAvailability: listing.weekly_availability,
    basePricePerHour: hourlyPrice,
    basePricePerDay: dailyPrice,
    currency,
    onLoginRequired,
    onSubmitted: auth.isAuthenticated ? onSubmitted : undefined,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_BAR_HEIGHT + spacing.md }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          colors={[colors.primary.main]}
          tintColor={colors.primary.main}
        />
      }
    >
      {images.length > 0 ? (
        <View style={{ width, height: heroH, backgroundColor: colors.disabled }}>
          <FlatList
            horizontal
            pagingEnabled
            data={images}
            keyExtractor={(im) => im.id}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onHeroScrollEnd}
            renderItem={({ item: im, index }) => (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={t(
                  'public.items.detail.viewFullImage',
                  'View full image'
                )}
                onPress={() => openLightbox(index)}
                style={{ width, height: heroH }}
              >
                <Image
                  source={{ uri: im.image_url }}
                  style={{ width, height: heroH }}
                  resizeMode="cover"
                />
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={{ width, height: heroH, backgroundColor: colors.disabled }}>
          <View style={styles.center}>
            <Text style={{ color: colors.text.disabled }}>
              {t('rentals.noImage', 'No image')}
            </Text>
          </View>
        </View>
      )}
      {images.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.sm, gap: spacing.xs }}
        >
          {images.map((im, i) => (
            <Pressable
              key={im.id}
              onPress={() => openLightbox(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t(
                'public.items.detail.goToPhoto',
                'Go to photo {{n}}',
                { n: i + 1 }
              )}
            >
              <Image
                source={{ uri: im.image_url }}
                style={[
                  styles.thumb,
                  {
                    borderColor: i === galleryIdx ? colors.primary.main : colors.divider,
                    borderRadius: borderRadius.sm,
                  },
                ]}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md }}>
        <View>
          <Text style={[typography.h5, { color: colors.text.primary }]}>{item.name}</Text>
          <View style={[styles.metaRow, { marginTop: spacing.xs, gap: spacing.xs }]}>
            {item.business?.is_verified ? (
              <TrustBadge
                variant="verified_seller"
                label={t('rentals.detail.verifiedBusiness', 'Verified')}
                inline
              />
            ) : null}
            {listing.distance_text ? (
              <StatusPill
                icon="map-marker-distance"
                label={listing.distance_text}
                backgroundColor={colors.pageBackground}
                textColor={colors.text.secondary}
                compact
              />
            ) : null}
            {listing.duration_text ? (
              <StatusPill
                icon="clock-outline"
                label={listing.duration_text}
                backgroundColor={colors.pageBackground}
                textColor={colors.text.secondary}
                compact
              />
            ) : null}
          </View>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
            {priceSnapshotParts.join(' · ')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}>
            {item.rental_category?.name}
            {item.business?.name
              ? ` · ${t('rentals.detail.offeredBy', 'Offered by')} ${item.business.name}`
              : ''}
          </Text>
        </View>

        <View
          style={[
            styles.notice,
            {
              backgroundColor: colors.info.main + '14',
              borderColor: colors.info.main + '44',
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              item.operation_mode === 'take_home'
                ? 'home-export-outline'
                : 'storefront-outline'
            }
            size={20}
            color={colors.info.main}
          />
          <Text style={[typography.body2, { color: colors.text.primary, flex: 1, marginLeft: spacing.sm }]}>
            {item.operation_mode === 'take_home'
              ? t(
                  'rentals.takeHomeNotice',
                  'Take-home rental: pick up this item, use it off-site, and return it by the booked end time.'
                )
              : t(
                  'rentals.businessOperatedNotice',
                  'Business-operated rental: the business runs this with you at their location (not unattended take-home).'
                )}
          </Text>
        </View>

        {item.description?.trim() ? (
          <View>
            <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
              {t('rentals.detail.overview', 'About this rental')}
            </Text>
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}>
              {item.description.trim()}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.detail.pricing', 'Pricing')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary, marginTop: spacing.xs }]}>
            {t('rentals.detail.hourlyRate', 'Hourly rate')}:{' '}
            <Text style={{ fontWeight: '700' }}>
              {formatRentalMoney(toNumber(listing.base_price_per_hour), currency)}
            </Text>
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary, marginTop: 4 }]}>
            {t('rentals.detail.fullDayRate', 'Full day (daily rate)')}:{' '}
            <Text style={{ fontWeight: '700' }}>
              {formatRentalMoney(toNumber(listing.base_price_per_day), currency)}
            </Text>
          </Text>
          {toNumber(listing.security_deposit_amount ?? 0) > 0 ? (
            <>
              <Text style={[typography.body2, { color: colors.text.primary, marginTop: 4 }]}>
                {t('rentals.detail.securityDeposit', 'Security deposit (card rentals)')}:{' '}
                <Text style={{ fontWeight: '700' }}>
                  {formatRentalMoney(
                    toNumber(listing.security_deposit_amount ?? 0),
                    currency
                  )}
                </Text>
              </Text>
              <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
                {t(
                  'rentals.detail.securityDepositHint',
                  'Held on your card with the rental total and only used for extra hours past your booked end time.'
                )}
              </Text>
            </>
          ) : null}
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.sm }]}>
            {t('rentals.minHours', 'Min hours')}: {listing.min_rental_hours}
            {listing.max_rental_hours != null
              ? ` · ${t('rentals.maxHours', 'Max hours')}: ${listing.max_rental_hours}`
              : ''}
          </Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.detail.howItWorksTitle', 'How it works')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}>
            {t(
              'rentals.detail.howItWorksIntro',
              'Rentals on Rendasua are coordinated with the business in a few steps:'
            )}
          </Text>
          {[1, 2, 3, 4].map((n) => {
            const step4Default =
              item.operation_mode === 'take_home'
                ? 'Pick up the item, use it off-site, and return it by the booked end time. Follow pickup and return instructions on this page.'
                : 'The rental is operated by the business at their location. Follow the pickup and return instructions on this page when you arrive.';
            const step4Key =
              item.operation_mode === 'take_home'
                ? 'rentals.detail.howItWorksStep4TakeHome'
                : 'rentals.detail.howItWorksStep4';
            return (
              <Text
                key={n}
                style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}
              >
                {`${n}. `}
                {n === 4
                  ? t(step4Key, step4Default)
                  : t(
                      `rentals.detail.howItWorksStep${n}`,
                      n === 1
                        ? 'Send a request with your preferred start and end date and time.'
                        : n === 2
                          ? 'The business checks availability and responds.'
                          : 'If they confirm availability, you can complete a booking.'
                    )}
              </Text>
            );
          })}
        </View>

        {weeklySorted.length > 0 ? (
          <View
            style={[
              styles.sectionCard,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
              {t('rentals.detail.weeklyHours', 'Weekly hours')}
            </Text>
            {weeklySorted.map((row) => (
              <View key={`${row.weekday}-${row.id ?? ''}`} style={styles.hoursRow}>
                <Text style={[typography.body2, { color: colors.text.primary, flex: 1 }]}>
                  {weekdayLabel(row.weekday, t)}
                </Text>
                <Text style={[typography.body2, { color: colors.text.secondary }]}>
                  {row.is_available && row.start_time && row.end_time
                    ? `${row.start_time.slice(0, 5)} – ${row.end_time.slice(0, 5)}`
                    : t('common.closed', 'Closed')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.detail.locationTitle', 'Pickup location')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary, marginTop: 4 }]}>
            {listing.business_location.name}
          </Text>
          {addr ? (
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
              {formatAddress(addr)}
            </Text>
          ) : null}
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.sm }]}>
            {t('rentals.pickupInstructions', 'Pickup / service instructions')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary }]}>
            {listing.pickup_instructions?.trim() ||
              t('rentals.detail.noInstructionsYet', 'No instructions provided yet.')}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.sm }]}>
            {t('rentals.dropoffInstructions', 'Return instructions')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary }]}>
            {listing.dropoff_instructions?.trim() ||
              t('rentals.detail.noInstructionsYet', 'No instructions provided yet.')}
          </Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
            {t('rentals.detail.requestCtaTitle', 'Ready to book?')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xxs }]}>
            {acceptsOrders
              ? t(
                  'rentals.detail.requestCtaBody',
                  'Tap Request rental below to pick your dates. Nothing is charged until the business accepts.'
                )
              : t(
                  'checkout.merchantNotAcceptingOrders',
                  'This merchant is currently completing account setup and is not yet accepting orders.'
                )}
          </Text>
          <Button
            mode="contained"
            style={{ marginTop: spacing.sm }}
            onPress={() => setRequestSheetOpen(true)}
            disabled={!acceptsOrders}
          >
            {acceptsOrders
              ? t('rentals.requestRental', 'Request this rental')
              : t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
          </Button>
        </View>
      </View>
    </ScrollView>

    <View
      style={[
        styles.bottomBarWrap,
        {
          paddingBottom: insets.bottom + spacing.sm,
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
        },
      ]}
    >
      <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700' }]}>
          {t('rentals.detail.fromHourly', 'From {{price}}/h', {
            price: formatRentalMoney(hourlyPrice, currency),
          })}
          {' · '}
          {t('rentals.detail.fromDaily', 'From {{price}}/day', {
            price: formatRentalMoney(dailyPrice, currency),
          })}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2, textAlign: 'center' }]}>
          {!acceptsOrders
            ? t(
                'checkout.merchantNotAcceptingOrders',
                'This merchant is currently completing account setup and is not yet accepting orders.'
              )
            : depositAmount > 0
              ? t(
                  'rentals.detail.depositBarHint',
                  'Deposit held on card · Nothing charged until accepted'
                )
              : t(
                  'rentals.detail.noChargeUntilAccepted',
                  'Nothing charged until the business accepts your request'
                )}
        </Text>
      </View>
      <Button
        mode="contained"
        onPress={() => setRequestSheetOpen(true)}
        disabled={!acceptsOrders}
        contentStyle={styles.ctaBtnContent}
        labelStyle={styles.ctaBtnLabel}
        accessibilityLabel={
          acceptsOrders
            ? t('rentals.requestRental', 'Request this rental')
            : t(
                'checkout.merchantNotAcceptingOrders',
                'This merchant is not yet accepting orders.'
              )
        }
      >
        {acceptsOrders
          ? t('rentals.requestRental', 'Request this rental')
          : t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
      </Button>
    </View>

    <RentalRequestSheet
      visible={requestSheetOpen}
      onDismiss={() => setRequestSheetOpen(false)}
      listingName={item.name}
      {...pickerProps}
    />
    <ImageLightbox
      visible={lightboxOpen}
      images={images}
      index={galleryIdx}
      onClose={() => setLightboxOpen(false)}
      onIndexChange={setGalleryIdx}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 64, height: 48, borderWidth: 2 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    padding: 12,
  },
  sectionCard: { borderWidth: 1 },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  bottomBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaBtnContent: { height: 52 },
  ctaBtnLabel: { fontSize: 15, fontWeight: '700' },
});
