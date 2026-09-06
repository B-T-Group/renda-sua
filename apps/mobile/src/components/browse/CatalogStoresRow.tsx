import { memo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CatalogStore } from '../../types/stores';
import { shadows, type Theme } from '../../theme';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import { StatusPill } from '../common/StatusPill';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';

export interface CatalogStoresRowProps {
  theme: Theme;
  stores: CatalogStore[];
  loading: boolean;
  onStorePress: (businessLocationId: string) => void;
  onSeeAllStores?: () => void;
}

const CARD_WIDTH = 148;
const CARD_HERO_HEIGHT = 56;
/** Reserve two lines so 1-line and 2-line names keep equal card height. */
const TITLE_LINE_HEIGHT = 20;
const TITLE_BLOCK_HEIGHT = TITLE_LINE_HEIGHT * 2;
/** Reserve the city line so the meta line aligns on cards without a city. */
const META_LINE_HEIGHT = 16;

function formatDistanceKm(
  meters: number | null | undefined,
  approxLabel: (km: string) => string
) {
  if (meters == null || !Number.isFinite(meters)) return null;
  const km =
    meters < 1000 ? (meters / 1000).toFixed(1) : Math.round(meters / 1000).toString();
  return approxLabel(km);
}

export const CatalogStoresRow = memo(function CatalogStoresRow({
  theme,
  stores,
  loading,
  onStorePress,
  onSeeAllStores,
}: CatalogStoresRowProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = theme;
  const cardGap = spacing.sm;
  const canScroll = stores.length > 1;

  if (!loading && stores.length === 0) return null;

  return (
    <View
      style={[
        styles.section,
        shadows.sm,
        {
          marginTop: spacing.md,
          marginHorizontal: -spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      <View
        style={[
          styles.headerRow,
          { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
        ]}
      >
        <View style={styles.titleRow}>
          <MaterialCommunityIcons
            name="storefront-outline"
            size={18}
            color={colors.primary.main}
          />
          <Text
            variant="labelLarge"
            style={{ color: colors.text.secondary, fontWeight: '700', marginLeft: 6 }}
          >
            {t('stores.rowTitle', 'Browse by store locations')}
          </Text>
        </View>
        {onSeeAllStores ? (
          <Button mode="text" compact onPress={onSeeAllStores} style={styles.seeAllBtn}>
            {t('stores.seeAll', 'See all')}
          </Button>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator style={{ paddingVertical: spacing.sm }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={canScroll}
          nestedScrollEnabled
          directionalLockEnabled
          style={Platform.OS === 'web' ? styles.listWeb : undefined}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              gap: cardGap,
            },
          ]}
        >
          {stores.map((store, index) => (
            <StorePillCard
              key={store.business_location_id || `store-${index}`}
              store={store}
              colors={colors}
              spacing={spacing}
              borderRadius={borderRadius.md}
              onPress={() => onStorePress(store.business_location_id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
});

interface StorePillCardProps {
  store: CatalogStore;
  colors: Theme['colors'];
  spacing: Theme['spacing'];
  borderRadius: number;
  onPress: () => void;
}

const StorePillCard = memo(function StorePillCard({
  store,
  colors,
  spacing,
  borderRadius,
  onPress,
}: StorePillCardProps) {
  const { t } = useTranslation();
  const name = store.name?.trim() || t('stores.unnamed', 'Store');
  const city = store.city?.trim() || null;
  const distance = formatDistanceKm(store.distance_meters, (km) =>
    t('stores.approxKm', '~{{km}} km', { km })
  );
  const itemPhrase = t('stores.itemCount', '{{count}} items', {
    count: store.item_count,
  });
  const meta = distance ? `${distance} · ${itemPhrase}` : itemPhrase;
  const openingSoon = store.is_storefront_visible && !store.can_accept_orders;
  const palette = storeAvatarPalette(name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={city ? `${name}, ${city}` : name}
      style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            width: CARD_WIDTH,
            borderRadius,
            borderColor: palette.bg + '33',
            backgroundColor: colors.surface,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={[
            styles.cardHero,
            { backgroundColor: palette.bgSoft, height: CARD_HERO_HEIGHT },
          ]}
        >
          {store.logo_url ? (
            <Image
              source={{ uri: store.logo_url }}
              style={[
                styles.logo,
                { borderColor: palette.bg + '44', backgroundColor: '#fff' },
              ]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <StoreDefaultAvatar name={name} size={48} />
          )}
        </View>
        <View style={[styles.cardBody, { padding: spacing.sm }]}>
          <Text
            variant="titleSmall"
            numberOfLines={2}
            style={{
              color: colors.text.primary,
              fontWeight: '800',
              height: TITLE_BLOCK_HEIGHT,
              lineHeight: TITLE_LINE_HEIGHT,
            }}
          >
            {name}
          </Text>
          {city ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{
                color: colors.text.secondary,
                marginTop: 2,
                height: META_LINE_HEIGHT,
                lineHeight: META_LINE_HEIGHT,
              }}
            >
              {city}
            </Text>
          ) : (
            <View style={{ height: META_LINE_HEIGHT + 2 }} />
          )}
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{
              color: colors.text.secondary,
              marginTop: 2,
              height: META_LINE_HEIGHT,
              lineHeight: META_LINE_HEIGHT,
            }}
          >
            {meta}
          </Text>
          {openingSoon ? (
            <View style={[styles.badgeSlot, { paddingTop: spacing.xs }]}>
              <StatusPill
                compact
                label={t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
                backgroundColor={colors.warning.main + '22'}
                textColor={colors.warning.dark ?? colors.warning.main}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  seeAllBtn: {
    marginTop: -4,
    marginRight: -8,
  },
  listWeb: Platform.select({
    web: { overflow: 'scroll' as const },
    default: {},
  }),
  listContent: {
    flexDirection: 'row',
    // Stretch so every card matches the tallest one (e.g. cards with a badge).
    alignItems: 'stretch',
  },
  cardPressable: {
    alignSelf: 'stretch',
  },
  card: {
    borderWidth: 1,
    // flexGrow (not flex) keeps the intrinsic content height that the row
    // measures its stretch target from.
    flexGrow: 1,
  },
  cardBody: {
    flexGrow: 1,
  },
  badgeSlot: {
    marginTop: 'auto',
    alignItems: 'flex-start',
  },
  cardHero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});
