import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { CatalogEmptyIllustration } from '../illustrations/CatalogEmptyIllustration';
import type { CatalogHealthState } from '../../utils/catalogHealth';
import { PERSONA_ACCENT } from '../../constants/personaTheme';

type Props = {
  health: CatalogHealthState;
  compact?: boolean;
  onPrimary: () => void;
};

export function BusinessCatalogHealthCard({
  health,
  compact = false,
  onPrimary,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const accent = PERSONA_ACCENT.business;
  const { primary, approved, target, pendingCount, rejectedCount, isRental } =
    health;

  const title =
    primary === 'first_item'
      ? isRental
        ? t('business.dashboard.firstItem.rentalTitle', 'List your first rental')
        : t('business.dashboard.firstItem.saleTitle', 'Add your first product')
      : t('business.quietHome.catalog.title', 'Catalog health');

  const body =
    primary === 'first_item'
      ? isRental
        ? t(
            'business.dashboard.firstItem.rentalBody',
            'Add photos, set operated or take-home mode, then publish rates at a location.'
          )
        : t(
            'business.dashboard.firstItem.saleBody',
            'Add photos, create the item (AI or manual), then add it to a location.'
          )
      : primary === 'fix_rejected'
        ? t(
            'business.quietHome.catalog.rejectedBody',
            'Fix rejected items so they can go live for customers.'
          )
        : primary === 'restock'
          ? t(
              'business.quietHome.catalog.restockBody',
              'A popular item is out of stock. Restock it while interest is high.'
            )
          : primary === 'add_product'
            ? t(
                'business.quietHome.catalog.progressBody',
                '{{approved}} of {{target}} products live. Fuller catalogs get more discovery.',
                { approved, target }
              )
            : t(
                'business.quietHome.catalog.healthyBody',
                '{{count}} products live.',
                { count: approved }
              );

  const cta =
    primary === 'first_item'
      ? isRental
        ? t('business.dashboard.firstItem.rentalCta', 'Start rental setup')
        : t('business.dashboard.firstItem.saleCta', 'Start guided setup')
      : primary === 'fix_rejected'
        ? t('business.tips.rejectedCta', 'Review items')
        : primary === 'restock'
          ? t('business.tips.restockCta', 'Manage inventory')
          : primary === 'add_product'
            ? t('business.tips.catalogGoalCta', 'Add a product')
            : t('business.quietHome.catalog.manageCta', 'Manage items');

  const showIllustration = !compact && primary === 'first_item';
  const metaParts: string[] = [];
  if (pendingCount > 0) {
    metaParts.push(
      t('business.quietHome.catalog.pendingMeta', '{{count}} pending', {
        count: pendingCount,
      })
    );
  }
  if (rejectedCount > 0 && primary !== 'fix_rejected') {
    metaParts.push(
      t('business.quietHome.catalog.rejectedMeta', '{{count}} rejected', {
        count: rejectedCount,
      })
    );
  }

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderRadius: borderRadius.lg,
          borderColor:
            primary === 'first_item' ? accent + '40' : colors.divider,
          backgroundColor:
            primary === 'first_item' ? accent + '12' : colors.surface,
          marginBottom: spacing.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
      accessibilityRole="summary"
    >
      {showIllustration ? (
        <View style={styles.illustrationWrap}>
          <CatalogEmptyIllustration />
        </View>
      ) : null}

      <Text
        variant="titleMedium"
        style={{ color: colors.text.primary, fontWeight: '700' }}
      >
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
        {body}
      </Text>
      {metaParts.length > 0 ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {metaParts.join(' · ')}
        </Text>
      ) : null}
      {primary === 'add_product' ? (
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: colors.divider },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: accent,
                width: `${Math.min(100, (approved / target) * 100)}%`,
              },
            ]}
          />
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={onPrimary}
        buttonColor={primary === 'first_item' ? accent : undefined}
        textColor={primary === 'first_item' ? colors.onDark : undefined}
      >
        {cta}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  illustrationWrap: { alignItems: 'center' },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
