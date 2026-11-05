import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Menu, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { RankedOrderActions } from '../../utils/rankOrderDetailActions';

export type OrderActionBarProps = {
  ranked: RankedOrderActions;
  onAction: (actionId: string) => void;
  loadingId?: string | null;
  /** When true, disable all actions (e.g. any mutation in flight). */
  busy?: boolean;
  /** Override primary button label (e.g. pay amount). */
  primaryLabel?: string;
  /** Render a custom primary control (e.g. Send PIN) instead of the button. */
  renderPrimary?: (() => React.ReactNode) | null;
  accentPrimary?: boolean;
  onLayoutHeight?: (height: number) => void;
  /** Skip sticky chrome when the parent already provides a footer shell. */
  plain?: boolean;
};

/**
 * Sticky order-detail action bar: one primary, optional companion, More overflow.
 */
export function OrderActionBar({
  ranked,
  onAction,
  loadingId,
  busy,
  primaryLabel,
  renderPrimary,
  accentPrimary,
  onLayoutHeight,
  plain,
}: OrderActionBarProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  const { primary, companion, overflow } = ranked;
  if (!primary && overflow.length === 0 && !companion && !renderPrimary) {
    return null;
  }

  const disabled = busy || Boolean(loadingId);
  const primaryNode = renderPrimary ? renderPrimary() : null;

  return (
    <View
      onLayout={(e) => onLayoutHeight?.(e.nativeEvent.layout.height)}
      style={
        plain
          ? { gap: spacing.sm }
          : [
              styles.bar,
              {
                borderTopColor: colors.divider,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.sm,
                paddingTop: spacing.sm,
                paddingBottom: insets.bottom + spacing.sm,
                gap: spacing.sm,
              },
            ]
      }
    >
      {primaryNode ? (
        primaryNode
      ) : primary && !renderPrimary ? (
        <Button
          mode="contained"
          buttonColor={accentPrimary ? colors.cta.main : undefined}
          textColor={accentPrimary ? colors.cta.contrast : undefined}
          loading={busy || loadingId === primary.id}
          disabled={disabled}
          onPress={() => onAction(primary.id)}
        >
          {primaryLabel ?? t(primary.labelKey, primary.defaultLabel)}
        </Button>
      ) : null}

      {companion ? (
        <Button
          mode="text"
          textColor={companion.destructive ? colors.error.main : undefined}
          loading={loadingId === companion.id}
          disabled={disabled}
          onPress={() => onAction(companion.id)}
        >
          {t(companion.labelKey, companion.defaultLabel)}
        </Button>
      ) : null}

      {overflow.length > 0 ? (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuOpen(true)}
              disabled={disabled}
            >
              {t('orders.actionBar.more', 'More actions')}
            </Button>
          }
        >
          {overflow.map((item) => (
            <Menu.Item
              key={item.id}
              onPress={() => {
                setMenuOpen(false);
                onAction(item.id);
              }}
              title={t(item.labelKey, item.defaultLabel)}
              titleStyle={
                item.destructive ? { color: colors.error.main } : undefined
              }
            />
          ))}
        </Menu>
      ) : null}
    </View>
  );
}

/** Compact “Now” sentence above the scroll details. */
export function OrderNowLine({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string | null;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm, gap: 4 }}>
      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Thin exception callout (refund, no agent, cash exception, etc.). */
export function OrderExceptionLine({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.warning.main + '15',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Text variant="titleSmall" style={{ color: colors.warning.dark }}>
        {title}
      </Text>
      {body ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text
            variant="labelLarge"
            style={{ color: colors.primary.main, marginTop: spacing.xs }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
