import { useEffect } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { AppImage } from '../common/AppImage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '@/contexts/ClientFlagsContext';
import { useClientReorderFlow } from '@/hooks/useClientReorderFlow';
import { useTheme } from '@/contexts/ThemeContext';
import type { OrderItem } from '@/types/agent';
import { orderItemImageUrl } from '@/utils/clientOrderListDisplay';
import { ReorderCartConflictSheet } from '../orders/ReorderCartConflictSheet';
import { AppText } from '../common/AppText';

export type BuyAgainLine = { name: string; imageUrl?: string | null };

type Props = {
  orderId: string;
  orderStatus?: string | null;
  items?: BuyAgainLine[];
  /** Drop outer padding when the card already sits inside a padded row. */
  embedded?: boolean;
  /** Restaurants: reorder only the cooked-food lines. */
  foodOnly?: boolean;
};

/** Product lines for a buy-again card, skipping empty rows. */
export function buyAgainLines(items: OrderItem[] | null | undefined): BuyAgainLine[] {
  return (items ?? []).flatMap((line) => {
    const name = (line.item_name || line.item?.name || '').trim();
    const imageUrl = orderItemImageUrl(line);
    if (!name && !imageUrl) return [];
    return [{ name, imageUrl }];
  });
}

/** Reuses the existing reorder flow. Hidden unless reorder_v1 is on and the order is done. */
export function BuyAgainCard({
  orderId,
  orderStatus,
  items = [],
  embedded = false,
  foodOnly = false,
}: Props) {
  const { t } = useTranslation();
  const { flags } = useClientFlags();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const flow = useClientReorderFlow(orderId, orderStatus, foodOnly);
  useEffect(() => {
    if (!flow.snack) return;
    const timer = setTimeout(() => flow.setSnack(null), 4000);
    return () => clearTimeout(timer);
  }, [flow.snack, flow.setSnack]);
  if (!flags.reorder_v1 || !flow.enabled) return null;
  const label = t('orders.reorder.action', 'Order again');
  return (
    <View style={{ paddingHorizontal: embedded ? 0 : spacing.md, paddingBottom: spacing.md }}>
      <AppText role="label">{t('client.home.buyAgain', 'Buy again')}</AppText>
      <BuyAgainPreview items={items} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={flow.loading}
        onPress={() => void flow.onReorderPress()}
        style={{
          marginTop: spacing.sm,
          minHeight: 48,
          borderRadius: borderRadius.button,
          borderWidth: 1.5,
          borderColor: colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: flow.loading ? 0.6 : 1,
        }}
      >
        <AppText role="label" color={colors.primary.main} style={typography.button}>
          {flow.loading ? t('common.loading', 'Loading...') : label}
        </AppText>
      </Pressable>
      {flow.snack ? (
        <AppText role="caption" color={colors.error.main} style={{ marginTop: spacing.xs }}>
          {flow.snack}
        </AppText>
      ) : null}
      <ReorderCartConflictSheet
        visible={flow.sheetOpen}
        allowAdd={flow.allowAdd}
        otherStoreBlocked={flow.otherStoreBlocked}
        onReplace={flow.onReplace}
        onAdd={flow.onAdd}
        onDismiss={flow.onDismissSheet}
      />
    </View>
  );
}

function BuyAgainPreview({ items }: { items: BuyAgainLine[] }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const named = items.filter((item) => item.name);
  const primary = named[0] ?? items[0];
  if (!primary) return null;
  const extra = Math.max(named.length - 1, 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
      <PreviewImage uri={primary.imageUrl} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <AppText role="body" numberOfLines={2}>
          {primary.name || t('client.home.buyAgain', 'Buy again')}
        </AppText>
        {extra > 0 ? (
          <AppText role="caption" color={colors.text.muted}>
            {t('client.home.buyAgainMore', 'and {{count}} more', { count: extra })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function PreviewImage({ uri }: { uri?: string | null }) {
  const { colors, borderRadius } = useTheme();
  const frame = {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
  if (!uri) {
    return (
      <View style={frame}>
        <MaterialCommunityIcons name="package-variant" size={22} color={colors.text.muted} />
      </View>
    );
  }
  return <AppImage uri={uri} style={frame} recyclingKey={uri} />;
}
