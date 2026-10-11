import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { RestockBellButton } from './RestockBellButton';

export interface RestockSoldOutBarProps {
  itemId: string;
  itemName: string;
  bellOn: boolean;
  busy: boolean;
  /** Bell needs a like (server: 404 not_liked otherwise). */
  showBell: boolean;
  onToggle: (itemId: string, nextEnabled: boolean) => void;
}

/** Sold-out item screen: disabled Add to cart with the restock bell next to it (#343 §5). */
export function RestockSoldOutBar({
  itemId,
  itemName,
  bellOn,
  busy,
  showBell,
  onToggle,
}: RestockSoldOutBarProps) {
  const { t } = useTranslation();
  const { borderRadius } = useTheme();
  return (
    <View style={styles.row}>
      <Button
        mode="outlined"
        icon="cart-plus"
        disabled
        style={[styles.addBtn, { borderRadius: borderRadius.button }]}
        contentStyle={styles.btnContent}
        labelStyle={styles.btnLabel}
        accessibilityLabel={t('cart.addToCart', 'Add to cart')}
        accessibilityState={{ disabled: true }}
      >
        {t('cart.addToCart', 'Add to cart')}
      </Button>
      {showBell ? (
        <RestockBellButton
          itemId={itemId}
          itemName={itemName}
          enabled={bellOn}
          busy={busy}
          onToggle={onToggle}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { flex: 1 },
  btnContent: { height: 52 },
  btnLabel: { fontSize: 15, fontWeight: '700' },
});
