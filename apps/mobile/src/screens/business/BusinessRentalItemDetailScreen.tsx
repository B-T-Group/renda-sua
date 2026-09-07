import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Snackbar,
  Text,
} from 'react-native-paper';
import { ImageLightbox } from '../../components/common/ImageLightbox';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { BusinessRentalItemDetail } from '../../types/rentals';
import { formatRentalMoney, rentalListingModerationColors, rentalListingModerationLabelKey, aggregateListingModerationStatus, findFirstProposalPendingListingId } from '../../utils/rentals';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalItemDetail'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function BusinessRentalItemDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const itemId = route.params.itemId;

  const [item, setItem] = useState<BusinessRentalItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const data = await rentalsApi.getBusinessItem(itemId);
      setItem(data);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useFocusEffect(
    useCallback(() => {
      void load({ soft: true });
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ soft: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const softDeleteItem = useCallback(() => {
    Alert.alert(
      t('business.rentals.deleteItemTitle', 'Remove rental?'),
      t(
        'business.rentals.deleteItemBody',
        'This soft-deletes the item and its listings if there are no active bookings.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await rentalsApi.deleteBusinessItem(itemId);
                navigation.navigate('BusinessRentalsStudio', { tab: 'catalog' });
              } catch (e: unknown) {
                setSnack(
                  e instanceof Error
                    ? e.message
                    : t('business.rentals.deleteFailed', 'Could not delete')
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  }, [itemId, navigation, t]);

  const softDeleteListing = useCallback(
    (listingId: string) => {
      Alert.alert(
        t('business.rentals.deleteListingTitle', 'Remove listing?'),
        t(
          'business.rentals.deleteListingBody',
          'This location listing will be removed if there are no open bookings.'
        ),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('common.delete', 'Delete'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setBusy(true);
                try {
                  await rentalsApi.deleteBusinessListing(listingId);
                  await load();
                } catch (e: unknown) {
                  setSnack(
                    e instanceof Error
                      ? e.message
                      : t('business.rentals.deleteFailed', 'Could not delete')
                  );
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ]
      );
    },
    [load, t]
  );

  const publishListing = useCallback(
    (listingId: string) => {
      void (async () => {
        setBusy(true);
        try {
          await rentalsApi.publishBusinessListing(listingId);
          setSnack(
            t(
              'business.rentals.moderation.publishSuccess',
              'Listing submitted for approval'
            )
          );
          await load();
        } catch (e: unknown) {
          setSnack(
            e instanceof Error
              ? e.message
              : t(
                  'business.rentals.moderation.publishFailed',
                  'Could not publish listing'
                )
          );
        } finally {
          setBusy(false);
        }
      })();
    },
    [load, t]
  );

  const images = item?.rental_item_images ?? [];

  const openLightbox = useCallback(
    (index: number) => {
      const count = item?.rental_item_images?.length ?? 0;
      if (count === 0) return;
      setLightboxIdx(Math.min(Math.max(0, index), count - 1));
      setLightboxOpen(true);
    },
    [item?.rental_item_images?.length]
  );

  if (loading && !item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text style={{ color: colors.text.secondary }}>
          {t('business.rentals.notFound', 'Rental not found')}
        </Text>
      </View>
    );
  }

  const mode = item.operation_mode ?? 'business_operated';
  const listings = (item.rental_location_listings ?? []).filter((l) => !l.deleted_at);
  const itemModeration = aggregateListingModerationStatus(listings);
  const showActivePill =
    itemModeration === 'approved' || itemModeration === null;
  const firstProposalListingId = findFirstProposalPendingListingId(item);
  const proposalPendingCount = listings.filter(
    (l) => l.moderation_status === 'proposal_pending'
  ).length;

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
        >
          {images.map((img, index) => (
            <Pressable
              key={img.id}
              onPress={() => openLightbox(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t(
                'business.rentals.catalog.openGallery',
                'View photos'
              )}
              style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
            >
              <Image
                source={{ uri: img.image_url }}
                style={[styles.hero, { borderRadius: borderRadius.md, marginRight: 8 }]}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Text style={[typography.h6, { color: colors.text.primary }]}>{item.name}</Text>
      <View style={styles.pills}>
        <StatusPill
          compact
          label={
            mode === 'take_home'
              ? t('business.rentals.modes.takeHomeShort', 'Take-home')
              : t('business.rentals.modes.operatedShort', 'Operated')
          }
          backgroundColor={
            mode === 'take_home' ? colors.info.main + '22' : colors.primaryTint
          }
          textColor={mode === 'take_home' ? colors.info.main : colors.primary.main}
        />
        {showActivePill ? (
          <StatusPill
            compact
            label={
              item.is_active
                ? t('business.rentals.catalog.active', 'Active')
                : t('business.rentals.catalog.inactive', 'Inactive')
            }
            backgroundColor={item.is_active ? colors.success.main + '22' : colors.divider}
            textColor={
              item.is_active
                ? colors.success.dark ?? colors.success.main
                : colors.text.secondary
            }
          />
        ) : null}
      </View>

      {item.description ? (
        <Text style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
          {item.description}
        </Text>
      ) : null}

      {firstProposalListingId ? (
        <>
          <Button
            mode="contained-tonal"
            style={{ marginTop: spacing.md }}
            onPress={() =>
              navigation.navigate('BusinessRentalAiProposal', {
                listingId: firstProposalListingId,
              })
            }
          >
            {t('business.rentals.aiProposal.reviewCta', 'Review AI suggestions')}
          </Button>
          {proposalPendingCount > 1 ? (
            <Text
              style={{
                color: colors.text.secondary,
                marginTop: spacing.xs,
                fontSize: 13,
              }}
            >
              {t(
                'business.rentals.multipleProposalsHint',
                'Review suggestions for each location below.'
              )}
            </Text>
          ) : null}
        </>
      ) : null}

      <Button
        mode="contained"
        style={{ marginTop: spacing.md }}
        onPress={() => navigation.navigate('BusinessRentalItemEdit', { itemId })}
      >
        {t('business.rentals.edit', 'Edit')}
      </Button>
      <Button mode="outlined" style={{ marginTop: 8 }} disabled={busy} onPress={softDeleteItem}>
        {t('business.rentals.deleteItem', 'Delete rental')}
      </Button>

      <Text
        style={[
          typography.subtitle2,
          { color: colors.text.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
        ]}
      >
        {t('business.rentals.listings', 'Listings')}
      </Text>
      <Button
        mode="outlined"
        icon="map-marker-plus"
        style={{ marginBottom: spacing.sm }}
        disabled={busy}
        onPress={() =>
          navigation.navigate('BusinessRentalAddListing', { itemId })
        }
      >
        {t('business.rentals.addListing', 'Add location listing')}
      </Button>
      {listings.length === 0 ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('business.rentals.noListings', 'No location listings yet.')}
        </Text>
      ) : (
        listings.map((listing) => {
          const modColors = rentalListingModerationColors(
            listing.moderation_status,
            colors
          );
          return (
          <View
            key={listing.id}
            style={[
              styles.listingCard,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <Text style={{ color: colors.text.primary, fontWeight: '600' }}>
              {listing.business_location?.name ?? listing.business_location_id}
            </Text>
            <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
              {formatRentalMoney(Number(listing.base_price_per_hour), item.currency)} /{' '}
              {t('rentals.perHour', 'hr')}
              {' · '}
              {formatRentalMoney(Number(listing.base_price_per_day), item.currency)} /{' '}
              {t('rentals.perDay', 'day')}
            </Text>
            <StatusPill
              compact
              style={{ marginTop: 8 }}
              label={t(
                rentalListingModerationLabelKey(listing.moderation_status),
                listing.moderation_status === 'approved'
                  ? 'Live'
                  : listing.moderation_status === 'rejected'
                    ? 'Rejected'
                    : listing.moderation_status === 'proposal_pending'
                      ? 'AI suggestions ready'
                      : listing.moderation_status === 'ai_reviewing'
                        ? 'AI reviewing'
                        : listing.moderation_status === 'draft'
                          ? 'Draft'
                          : 'Pending approval'
              )}
              backgroundColor={modColors.backgroundColor}
              textColor={modColors.textColor}
            />
            {listing.moderation_status === 'draft' ? (
              <Button
                mode="contained"
                style={{ marginTop: 8 }}
                disabled={busy}
                loading={busy}
                onPress={() => publishListing(listing.id)}
              >
                {t('business.rentals.moderation.publish', 'Publish')}
              </Button>
            ) : null}
            {listing.moderation_status === 'rejected' ? (
              <View style={{ marginTop: 8 }}>
                {(listing.rejection_reason ||
                  listing.ai_reviews?.[0]?.decision_reason) ? (
                  <>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: 13,
                        fontWeight: '600',
                        marginBottom: 4,
                      }}
                    >
                      {t(
                        'business.rentals.moderation.rejectionReason',
                        'Why this listing was rejected'
                      )}
                    </Text>
                    <Text
                      style={{
                        color: colors.error.main,
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      {listing.rejection_reason ||
                        listing.ai_reviews?.[0]?.decision_reason}
                    </Text>
                  </>
                ) : null}
                <Text
                  style={{
                    color: colors.text.secondary,
                    fontSize: 13,
                  }}
                >
                  {t(
                    'business.rentals.moderation.resubmitHint',
                    'If this listing was rejected, saving changes will send it for review again.'
                  )}
                </Text>
              </View>
            ) : null}
            {listing.moderation_status === 'proposal_pending' ? (
              <Button
                mode="contained-tonal"
                style={{ marginTop: 8 }}
                onPress={() =>
                  navigation.navigate('BusinessRentalAiProposal', {
                    listingId: listing.id,
                  })
                }
              >
                {t('business.rentals.aiProposal.reviewCta', 'Review AI suggestions')}
              </Button>
            ) : null}
            <Button
              mode="text"
              textColor={colors.error.main}
              disabled={busy}
              onPress={() => softDeleteListing(listing.id)}
            >
              {t('business.rentals.deleteListing', 'Remove listing')}
            </Button>
          </View>
          );
        })
      )}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </ScrollView>
    <ImageLightbox
      visible={lightboxOpen}
      images={images}
      index={lightboxIdx}
      onClose={() => setLightboxOpen(false)}
      onIndexChange={setLightboxIdx}
    />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: 220, height: 160 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  listingCard: { borderWidth: 1 },
});
