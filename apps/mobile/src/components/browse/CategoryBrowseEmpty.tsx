import { View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export function CategoryBrowseEmpty({ searching }: { searching: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const title = searching
    ? t('client.browse.categoriesEmptySearch', 'No categories match that search')
    : t('client.browse.categoriesEmpty', 'No categories in this market yet');
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
      <EmptyCategoriesMark />
      <Text style={{ marginTop: spacing.md, fontWeight: '700', color: colors.text.primary, textAlign: 'center' }}>
        {title}
      </Text>
    </View>
  );
}

function EmptyCategoriesMark() {
  const { colors } = useTheme();
  return (
    <Svg width={120} height={80} viewBox="0 0 120 80" accessibilityElementsHidden>
      <Rect x="8" y="10" width="46" height="60" rx="10" fill={colors.primary.light} />
      <Rect x="66" y="10" width="46" height="28" rx="10" fill={colors.primary.main} opacity={0.35} />
      <Rect x="66" y="44" width="46" height="26" rx="10" fill={colors.primary.main} opacity={0.55} />
    </Svg>
  );
}
