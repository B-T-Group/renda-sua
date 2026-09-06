import { useCallback, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Badge, FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';

export const BrowseCartFab = observer(function BrowseCartFab() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  /** 0 on stack screens (e.g. StoreDetail) that are outside the tab navigator. */
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const navigation = useNavigation();
  const { cart } = useStore();

  const onPress = useCallback(() => {
    // Works from tab screens (bubbles to root) and stack screens like StoreDetail.
    (navigation as { navigate: (n: string) => void }).navigate('Cart');
  }, [navigation]);

  if (cart.distinctLineCount === 0) return null;

  const bottom = tabBarHeight + insets.bottom + spacing.md;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.badgeWrap}>
        <FAB
          icon="cart"
          customSize={52}
          mode="flat"
          color={colors.primary.contrast}
          style={{ backgroundColor: colors.primary.main }}
          onPress={onPress}
          accessibilityLabel={t('cart.fabA11y', 'Open cart')}
        />
        <Badge style={[styles.badge, { backgroundColor: colors.error.main }]} size={20}>
          {cart.lineCount > 99 ? '99+' : String(cart.lineCount)}
        </Badge>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, zIndex: 20 },
  badgeWrap: { position: 'relative', alignSelf: 'flex-end' },
  badge: { position: 'absolute', top: -4, right: -4 },
});
