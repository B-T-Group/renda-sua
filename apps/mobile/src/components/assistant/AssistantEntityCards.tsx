import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/common/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/theme/spacing';
import type { AssistantResultCard } from '@/utils/assistantResultCards';

const ACTION_KEYS = {
  item: ['assistant.card.viewItem', 'View item'],
  order: ['assistant.card.viewOrder', 'View order'],
  rental: ['assistant.card.viewRental', 'View rental'],
  store: ['assistant.card.viewStore', 'View restaurant'],
  sign_in: ['assistant.card.signIn', 'Sign in'],
} as const;

function cardTitle(card: AssistantResultCard, signInTitle: string): string {
  if (card.kind === 'sign_in') return signInTitle;
  return card.title || '';
}

export function AssistantEntityCards({
  cards,
  onOpen,
  onReorder,
}: {
  cards: AssistantResultCard[];
  onOpen: (card: AssistantResultCard) => void;
  onReorder?: (href: string) => void;
}) {
  if (!cards.length) return null;
  return (
    <View style={styles.list}>
      {cards.map((card) => (
        <ResultCard key={`${card.kind}:${card.id}`} card={card} onOpen={onOpen} onReorder={onReorder} />
      ))}
    </View>
  );
}

function ResultCard({
  card,
  onOpen,
  onReorder,
}: {
  card: AssistantResultCard;
  onOpen: (card: AssistantResultCard) => void;
  onReorder?: (href: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const title = cardTitle(card, t('assistant.card.signInTitle', 'Sign in to see your account'));
  const action = ACTION_KEYS[card.kind];
  const label = t(action[0], action[1]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onOpen(card)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {card.kind !== 'sign_in' ? <CardImage url={card.imageUrl} /> : null}
      <View style={styles.body}>
        <AppText role="body" color={colors.text.primary} numberOfLines={2} style={styles.title}>{title}</AppText>
        {card.priceLabel ? <AppText role="bodySmall" color={colors.text.secondary}>{card.priceLabel}</AppText> : null}
        <CardActions card={card} label={label} onReorder={onReorder} />
      </View>
    </Pressable>
  );
}

function CardActions({
  card,
  label,
  onReorder,
}: {
  card: AssistantResultCard;
  label: string;
  onReorder?: (href: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.actions}>
      <AppText role="bodySmall" color={colors.primary.main} style={styles.actionLabel}>{label}</AppText>
      {card.secondaryHref && onReorder ? (
        <ReorderLink label={t('assistant.card.reorder', 'Reorder')} href={card.secondaryHref} onReorder={onReorder} />
      ) : null}
    </View>
  );
}

function ReorderLink({
  label,
  href,
  onReorder,
}: {
  label: string;
  href: string;
  onReorder: (href: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={() => onReorder(href)}>
      <AppText role="bodySmall" color={colors.text.secondary} style={styles.actionLabel}>{label}</AppText>
    </Pressable>
  );
}

function CardImage({ url }: { url?: string | null }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <View style={[styles.image, { backgroundColor: colors.primaryTint }]} />;
  }
  return (
    <Image source={{ uri: url }} style={styles.image} resizeMode="cover" onError={() => setFailed(true)} />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs, marginTop: spacing.sm, width: '100%', alignSelf: 'stretch' },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
  },
  image: { width: 64, height: 64, borderRadius: 16 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  actionLabel: { fontWeight: '600' },
});

export function openAssistantCard(
  navigation: { navigate: (name: string, params?: object) => void },
  card: AssistantResultCard,
  persona: string | null
): void {
  if (card.kind === 'sign_in') {
    navigation.navigate('GuestTabs', { screen: 'GuestAuth', params: { screen: 'Login' } });
    return;
  }
  const href = card.href || '';
  const item = href.match(/^\/items\/([^/?]+)/);
  if (item) {
    navigation.navigate('InventoryItemDetail', { inventoryItemId: item[1] });
    return;
  }
  const booking = href.match(/^\/rentals\/bookings\/([^/?]+)/);
  if (booking) {
    navigation.navigate('RentalBookingDetail', { bookingId: booking[1] });
    return;
  }
  const rental = href.match(/^\/rentals\/([^/?]+)/);
  if (rental) {
    navigation.navigate('RentalListingDetail', { listingId: rental[1] });
    return;
  }
  if (href.startsWith('/business/rentals')) {
    navigation.navigate('BusinessRentalsStudio');
    return;
  }
  const store = href.match(/^\/store\/([^/?]+)/);
  if (store) {
    navigation.navigate('StoreDetail', { businessId: store[1], foodOnly: href.includes('menu=food') });
    return;
  }
  const order = href.match(/^\/orders\/([^/?]+)/);
  if (!order || order[1] === undefined) return;
  openOrder(navigation, order[1], persona);
}

function openOrder(
  navigation: { navigate: (name: string, params?: object) => void },
  orderId: string,
  persona: string | null
): void {
  if (persona === 'business') {
    navigation.navigate('BusinessOrderDetail', { orderId });
    return;
  }
  if (persona === 'agent') {
    navigation.navigate('MainTabs', {
      screen: 'Orders',
      params: { screen: 'OrderDetail', params: { orderId } },
    });
    return;
  }
  navigation.navigate('OrderDetail', { orderId });
}
