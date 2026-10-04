import { View } from 'react-native';
import { AppImage } from '../common/AppImage';
import { Snackbar } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '@/contexts/ClientFlagsContext';
import { useClientReorderFlow } from '@/hooks/useClientReorderFlow';
import { useTheme } from '@/contexts/ThemeContext';
import type { OrderItem } from '@/types/agent';
import { orderItemImageUrl } from '@/utils/clientOrderListDisplay';
import { ReorderCartConflictSheet } from '../orders/ReorderCartConflictSheet';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';

export type BuyAgainLine = { name: string; imageUrl?: string | null };

type Props = {
  orderId: string;
  orderStatus?: string | null;
  items?: BuyAgainLine[];
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
export function BuyAgainCard({ orderId, orderStatus, items = [] }: Props) {
  const { t } = useTranslation();
  const { flags } = useClientFlags();
  const { spacing } = useTheme();
  const flow = useClientReorderFlow(orderId, orderStatus);
  if (!flags.reorder_v1 || !flow.enabled) return null;
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
      <AppText role="label">{t('client.home.buyAgain', 'Buy again')}</AppText>
      <BuyAgainPreview items={items} />
      <AppButton
        label={t('orders.reorder.action', 'Order again')}
        onPress={() => void flow.onReorderPress()}
        loading={flow.loading}
        variant="outline"
        size="medium"
        style={{ marginTop: spacing.sm }}
      />
      <ReorderCartConflictSheet
        visible={flow.sheetOpen}
        allowAdd={flow.allowAdd}
        otherStoreBlocked={flow.otherStoreBlocked}
        onReplace={flow.onReplace}
        onAdd={flow.onAdd}
        onDismiss={flow.onDismissSheet}
      />
      <Snackbar visible={!!flow.snack} onDismiss={() => flow.setSnack(null)} duration={4000}>
        {flow.snack}
      </Snackbar>
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
