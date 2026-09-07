import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../constants/personaTheme';

interface Props {
  visible: boolean;
  onPress: () => void;
  /** When true, show first-rental copy instead of first-sale. */
  rentalMode?: boolean;
}

export function BusinessDashboardFirstItemCta({
  visible,
  onPress,
  rentalMode = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const accent = PERSONA_ACCENT.business;

  if (!visible) return null;

  const title = rentalMode
    ? t('business.dashboard.firstItem.rentalTitle', 'List your first rental')
    : t('business.dashboard.firstItem.saleTitle', 'Add your first product');
  const body = rentalMode
    ? t(
        'business.dashboard.firstItem.rentalBody',
        'Add photos, set operated or take-home mode, then publish rates at a location.'
      )
    : t(
        'business.dashboard.firstItem.saleBody',
        'Add photos, create the item (AI or manual), then add it to a location.'
      );
  const cta = rentalMode
    ? t('business.dashboard.firstItem.rentalCta', 'Start rental setup')
    : t('business.dashboard.firstItem.saleCta', 'Start guided setup');
  const icon = rentalMode ? 'calendar-clock' : 'package-variant-plus';

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: borderRadius.lg,
          borderColor: accent + '40',
          backgroundColor: accent + '12',
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
          <MaterialCommunityIcons name={icon} size={28} color={accent} />
        </View>
        <View style={styles.copy}>
          <Text variant="titleMedium" style={[styles.title, { color: colors.text.primary }]}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={[styles.body, { color: colors.text.secondary }]}>
            {body}
          </Text>
        </View>
      </View>
      <Button
        mode="contained"
        icon="arrow-right"
        contentStyle={styles.ctaContent}
        buttonColor={accent}
        textColor={colors.onDark}
        style={styles.cta}
        onPress={onPress}
      >
        {cta}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '600',
  },
  body: {
    marginTop: 6,
  },
  cta: {
    alignSelf: 'stretch',
  },
  ctaContent: {
    flexDirection: 'row-reverse',
  },
});
