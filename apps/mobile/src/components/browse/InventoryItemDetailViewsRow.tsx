import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface InventoryItemDetailViewsRowProps {
  viewsCount?: number | null;
  style?: StyleProp<ViewStyle>;
}

export function InventoryItemDetailViewsRow({ viewsCount, style }: InventoryItemDetailViewsRowProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const hasViews = typeof viewsCount === 'number';

  if (!hasViews) return null;

  return (
    <View style={[{ marginTop: spacing.md }, style]}>
      <Chip
        mode="outlined"
        icon={() => <MaterialCommunityIcons name="eye-outline" size={18} color={colors.primary.main} />}
        style={[styles.chip, { borderColor: colors.divider, borderRadius: borderRadius.sm }]}
        textStyle={[typography.body2, { fontWeight: '600' }]}
      >
        {t('items.detail.socialProof.views', '{{count}} views', { count: viewsCount })}
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start' },
});
