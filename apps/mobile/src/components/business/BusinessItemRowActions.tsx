import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Menu, Snackbar, Text } from 'react-native-paper';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import { SimpleMessageDialog } from '../dialogs/SimpleMessageDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessItemActions } from '../../hooks/business/useBusinessItemActions';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import type { BusinessCatalogItem } from '../../types/business/items';
import { getItemInventories } from '../../utils/businessItemUtils';
import { canToggleItemActive } from '../../utils/items/itemStatusUi';
import { BusinessItemIconToolbar, type ToolbarIconSpec } from './BusinessItemIconToolbar';
import { BusinessRestockDialog } from './BusinessRestockDialog';
import { BusinessItemToggleStrip } from './BusinessItemToggleStrip';

type Props = {
  item: BusinessCatalogItem;
  onView?: () => void;
  onSuccess?: () => void;
  /** When restock is tapped but item has no inventory rows. */
  onRequestAddInventory?: () => void;
  /** Hide the view-details action (e.g. on item detail screen). */
  hideViewButton?: boolean;
  /** Open full item edit form (shown in selling-options header or inline action row). */
  onEdit?: () => void;
  /** Item detail: collections / AI refine shortcuts in the merged action row. */
  onCollections?: () => void;
  onRefineAi?: () => void;
  /** Show listing/payment toggles (on card image overlay). */
  showToggles?: boolean;
  /** `inline` merges toggles into the icon row (item detail). */
  toggleVariant?: 'card' | 'inline';
  /** Show icon action row. */
  showIconActions?: boolean;
  /** Item detail: labeled Edit + More instead of unlabeled icons. */
  actionLayout?: 'icons' | 'labeled';
};

export function BusinessItemRowActions({
  item,
  onView,
  onSuccess,
  onRequestAddInventory,
  hideViewButton = false,
  onEdit,
  onCollections,
  onRefineAi,
  showToggles = true,
  toggleVariant = 'card',
  showIconActions = true,
  actionLayout = 'icons',
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { isStripeRail } = useIsStripeRail();
  const {
    actingId,
    snack,
    setSnack,
    updateItem,
    deleteItem,
    setFavorite,
    updateInventory,
  } = useBusinessItemActions(onSuccess);

  const acting = actingId === item.id;
  const inventories = getItemInventories(item);
  const showListingToggle = canToggleItemActive(item.moderation_status);
  const showPayOnDelivery = !isStripeRail;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [noInventoryOpen, setNoInventoryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isLabeled = actionLayout === 'labeled';

  const handleToggleActive = useCallback(
    (checked: boolean) => void updateItem(item.id, { is_active: checked }),
    [item.id, updateItem]
  );

  const handleTogglePayOnDelivery = useCallback(
    (checked: boolean) => void updateItem(item.id, { pay_on_delivery_enabled: checked }),
    [item.id, updateItem]
  );

  const handleTogglePayAtPickup = useCallback(
    (checked: boolean) => void updateItem(item.id, { pay_at_pickup_enabled: checked }),
    [item.id, updateItem]
  );

  const handleFavorite = useCallback(() => {
    void setFavorite(item.id, !item.is_favorite);
  }, [item.id, item.is_favorite, setFavorite]);

  const handleRestock = useCallback(() => {
    if (!inventories.length) {
      if (onRequestAddInventory) {
        onRequestAddInventory();
        return;
      }
      setNoInventoryOpen(true);
      return;
    }
    setRestockOpen(true);
  }, [inventories.length, onRequestAddInventory]);

  const handleConfirmDelete = useCallback(async () => {
    setDeleteOpen(false);
    try {
      await deleteItem(item.id);
    } catch {
      /* snack from hook */
    }
  }, [deleteItem, item.id]);

  const inlineToggles = showToggles && toggleVariant === 'inline';
  const cardToggles = showToggles && toggleVariant === 'card';

  const toggleStrip = cardToggles ? (
    <BusinessItemToggleStrip
      variant="card"
      listingActive={item.is_active !== false}
      payOnDelivery={Boolean(item.pay_on_delivery_enabled)}
      payAtPickup={Boolean(item.pay_at_pickup_enabled)}
      showListingToggle={showListingToggle}
      showPayOnDelivery={showPayOnDelivery}
      disabled={acting}
      onToggleListing={(v) => void handleToggleActive(v)}
      onTogglePayOnDelivery={(v) => void handleTogglePayOnDelivery(v)}
      onTogglePayAtPickup={(v) => void handleTogglePayAtPickup(v)}
      onEdit={onEdit}
    />
  ) : null;

  const toolbarIcons = useMemo((): ToolbarIconSpec[] => {
    if (!showIconActions && !onCollections && !onRefineAi) return [];
    const icons: ToolbarIconSpec[] = [];
    if (onCollections) {
      icons.push({
        key: 'collections',
        icon: 'folder-multiple-outline',
        color: colors.primary.main,
        onPress: onCollections,
        accessibilityLabel: t('business.items.collections.title', 'Collections'),
      });
    }
    if (onRefineAi) {
      icons.push({
        key: 'refine',
        icon: 'auto-fix',
        color: colors.primary.main,
        onPress: onRefineAi,
        accessibilityLabel: t('business.items.refineWithAi.title', 'Refine with AI'),
      });
    }
    if (onEdit && !isLabeled) {
      icons.push({
        key: 'edit',
        icon: 'pencil-outline',
        color: colors.primary.main,
        onPress: onEdit,
        accessibilityLabel: t('business.items.editItem', 'Edit item'),
      });
    }
    if (!hideViewButton && onView) {
      icons.push({
        key: 'view',
        icon: 'eye-outline',
        color: colors.primary.main,
        onPress: onView,
        accessibilityLabel: t('business.items.viewItem', 'View item'),
      });
    }
    if (showIconActions) {
      icons.push(
        {
          key: 'restock',
          icon: 'package-variant',
          color: colors.warning.main,
          onPress: handleRestock,
          accessibilityLabel: t('business.inventory.restock', 'Restock'),
        },
        {
          key: 'favorite',
          icon: item.is_favorite ? 'star' : 'star-outline',
          color: colors.warning.dark,
          onPress: handleFavorite,
          disabled: acting,
          accessibilityLabel: t('business.items.favorite', 'Favorite'),
        },
        {
          key: 'delete',
          icon: 'delete-outline',
          color: colors.error.main,
          onPress: () => setDeleteOpen(true),
          accessibilityLabel: t('business.items.deleteItem', 'Delete item'),
        }
      );
    }
    return icons;
  }, [
    acting,
    colors.error.main,
    colors.primary.main,
    colors.warning.dark,
    colors.warning.main,
    handleFavorite,
    handleRestock,
    hideViewButton,
    isLabeled,
    item.is_favorite,
    onCollections,
    onEdit,
    onRefineAi,
    onView,
    showIconActions,
    t,
  ]);

  const mergedPanel =
    inlineToggles || toolbarIcons.length > 0 || (isLabeled && !!onEdit) ? (
      <View
        style={[
          styles.mergedPanel,
          {
            marginTop: spacing.sm,
            borderColor: colors.divider,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            opacity: acting ? 0.65 : 1,
          },
        ]}
        pointerEvents={acting ? 'none' : 'auto'}
      >
        {inlineToggles ? (
          <>
            <Text
              variant="labelSmall"
              style={[styles.panelLabel, { color: colors.text.secondary }]}
            >
              {t('business.items.sellingOptions', 'Selling options')}
            </Text>
            <BusinessItemToggleStrip
              variant="inline"
              listingActive={item.is_active !== false}
              payOnDelivery={Boolean(item.pay_on_delivery_enabled)}
              payAtPickup={Boolean(item.pay_at_pickup_enabled)}
              showListingToggle={showListingToggle}
              showPayOnDelivery={showPayOnDelivery}
              disabled={acting}
              onToggleListing={(v) => void handleToggleActive(v)}
              onTogglePayOnDelivery={(v) => void handleTogglePayOnDelivery(v)}
              onTogglePayAtPickup={(v) => void handleTogglePayAtPickup(v)}
            />
          </>
        ) : null}
        {isLabeled ? (
          <View
            style={[
              styles.labeledRow,
              inlineToggles && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.divider,
              },
            ]}
          >
            {onEdit ? (
              <Button
                mode="contained-tonal"
                icon="pencil-outline"
                onPress={onEdit}
                style={styles.editBtn}
                contentStyle={styles.editBtnContent}
              >
                {t('business.items.editDetails', 'Edit details')}
              </Button>
            ) : null}
            {toolbarIcons.length > 0 ? (
              <Menu
                visible={moreOpen}
                onDismiss={() => setMoreOpen(false)}
                anchor={
                  <Button
                    mode="outlined"
                    icon="dots-horizontal"
                    onPress={() => setMoreOpen(true)}
                    accessibilityLabel={t('common.more', 'More')}
                  >
                    {t('common.more', 'More')}
                  </Button>
                }
              >
                {toolbarIcons.map((spec) => (
                  <Menu.Item
                    key={spec.key}
                    leadingIcon={spec.icon}
                    title={spec.accessibilityLabel}
                    disabled={spec.disabled}
                    onPress={() => {
                      setMoreOpen(false);
                      spec.onPress();
                    }}
                    titleStyle={
                      spec.key === 'delete' ? { color: colors.error.main } : undefined
                    }
                  />
                ))}
              </Menu>
            ) : null}
          </View>
        ) : (
          <BusinessItemIconToolbar icons={toolbarIcons} showTopDivider={inlineToggles} />
        )}
      </View>
    ) : null;

  const legacyIconRow =
    !inlineToggles && toolbarIcons.length > 0 ? (
      <View
        style={[
          styles.legacyIconRow,
          {
            borderTopColor: colors.divider,
            marginTop: spacing.md,
            paddingTop: spacing.xs,
          },
        ]}
      >
        <BusinessItemIconToolbar icons={toolbarIcons} />
      </View>
    ) : null;

  return (
    <>
      {toggleStrip}
      {mergedPanel}
      {legacyIconRow}

      <ConfirmActionDialog
        visible={deleteOpen}
        title={t('business.items.deleteConfirmTitle', 'Delete item?')}
        message={t(
          'business.items.deleteConfirmBody',
          'This will remove the item from your catalog. This action cannot be undone.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('business.items.deleteItem', 'Delete item')}
        loading={acting}
        destructive
        onDismiss={() => !acting && setDeleteOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <BusinessRestockDialog
        visible={restockOpen}
        item={item}
        loading={acting}
        onDismiss={() => setRestockOpen(false)}
        onSubmit={async (inventoryId, body) => {
          await updateInventory(inventoryId, body);
        }}
      />

      <SimpleMessageDialog
        visible={noInventoryOpen}
        title={t('business.items.restockNoInventoryTitle', 'No inventory')}
        message={t(
          'business.items.restockNoInventoryBody',
          'Add inventory for this item from the business dashboard on rendasua.com first.'
        )}
        dismissLabel={t('common.ok', 'OK')}
        onDismiss={() => setNoInventoryOpen(false)}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  mergedPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  panelLabel: {
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 2,
  },
  labeledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  editBtn: { flex: 1 },
  editBtnContent: { minHeight: 44 },
  legacyIconRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
