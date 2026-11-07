import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export type CheckoutChoiceSummaryRow = {
  key: string;
  label: string;
  value: string;
};

type Props = {
  rows: CheckoutChoiceSummaryRow[];
  onEdit: () => void;
};

export function CheckoutChoiceSummary({ rows, onEdit }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const editLabel = t('client.placeOrder.review.edit', 'Edit');

  if (rows.length === 0) return null;

  return (
    <View
      style={{
        marginBottom: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.divider,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text variant="titleSmall" style={{ fontWeight: '700', color: colors.text.primary }}>
        {t('client.placeOrder.review.choicesTitle', 'Your choices')}
      </Text>
      {rows.map((row) => (
        <View
          key={row.key}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="labelSmall"
              style={{ color: colors.text.secondary, marginBottom: 2 }}
            >
              {row.label}
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.primary, fontWeight: '600' }}
              numberOfLines={3}
            >
              {row.value}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${editLabel}: ${row.label}`}
            onPress={onEdit}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs }}
          >
            <Text style={[typography.caption, { color: colors.primary.main, fontWeight: '700' }]}>
              {editLabel}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
