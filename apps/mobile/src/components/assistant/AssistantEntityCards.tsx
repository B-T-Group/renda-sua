import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, spacing } from '@/theme/spacing';
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
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();
  if (!cards.length) return null;
  return (
    <View style={styles.list}>
      {cards.map((card) => (
        <View
          key={`${card.kind}:${card.id}`}
          style={[styles.card, shadows.sm, { borderColor: colors.border, backgroundColor: colors.background.paper }]}
        >
          {card.kind !== 'sign_in' ? <CardImage url={card.imageUrl} /> : null}
          <View style={styles.body}>
            <Text variant="titleSmall">
              {cardTitle(card, t('assistant.card.signInTitle', 'Sign in to see your account'))}
            </Text>
            {card.priceLabel ? (
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>{card.priceLabel}</Text>
            ) : null}
            <View style={styles.actions}>
              <Button mode="contained" compact onPress={() => onOpen(card)}>
                {t(ACTION_KEYS[card.kind][0], ACTION_KEYS[card.kind][1])}
              </Button>
              {card.secondaryHref && onReorder ? (
                <Button mode="text" compact onPress={() => onReorder(card.secondaryHref!)}>
                  {t('assistant.card.reorder', 'Reorder')}
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function CardImage({ url }: { url?: string | null }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <View style={[styles.image, { backgroundColor: colors.background.default }]} />;
  }
  return <Image source={{ uri: url }} style={styles.image} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.sm, width: '100%' },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  image: { width: 72, height: 72, borderRadius: borderRadius.sm },
  body: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
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
