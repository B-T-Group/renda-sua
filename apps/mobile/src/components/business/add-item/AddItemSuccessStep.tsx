import React, { useMemo, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import type { CreatedSaleItemSummary } from '../../../types/business/items';
import { useTheme } from '../../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../../constants/personaTheme';
import { ProductEnrichmentNudge } from './ProductEnrichmentNudge';

const PRODUCT_SUCCESS = require('../../../../assets/animations/product-success.json') as AnimationObject;
const ANIMATION_SIZE = 148;

export interface AddItemSuccessStepProps {
  item: CreatedSaleItemSummary;
  businessId?: string;
  locationName?: string;
  savedAsDraft?: boolean;
  photoCount?: number;
  onBackToItems: () => void;
  onBackToDashboard?: () => void;
  onViewItem: () => void;
  onAddAnother?: () => void;
  onPhotoAdded?: () => void;
  onEnrichmentError?: (message: string) => void;
}

type NextStep = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
};

export function AddItemSuccessStep({
  item,
  businessId,
  locationName,
  savedAsDraft = false,
  photoCount = 1,
  onBackToItems,
  onBackToDashboard,
  onViewItem,
  onAddAnother,
  onPhotoAdded,
  onEnrichmentError,
}: AddItemSuccessStepProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const accent = PERSONA_ACCENT.business;
  const locationSuffix = locationName
    ? t('business.onboarding.firstSale.success.atLocation', ' at {{location}}', {
        location: locationName,
      })
    : '';

  const formattedPrice =
    item.price != null && item.currency
      ? `${item.price} ${item.currency}`
      : null;

  useEffect(() => {
    lottieRef.current?.reset();
    lottieRef.current?.play();
  }, [item.id, savedAsDraft]);

  const nextSteps: NextStep[] = useMemo(
    () => [
      {
        icon: 'palette-swatch-outline',
        title: t(
          'business.onboarding.firstSale.success.nextSteps.variantsTitle',
          'Add variants'
        ),
        body: t(
          'business.onboarding.firstSale.success.nextSteps.variantsBody',
          'Open the product to create sizes, colors, or packaging options with their own photos and prices.'
        ),
      },
      {
        icon: 'pencil-outline',
        title: t(
          'business.onboarding.firstSale.success.nextSteps.editTitle',
          'Edit details & photos'
        ),
        body: t(
          'business.onboarding.firstSale.success.nextSteps.editBody',
          'Update the name, description, category, tags, or gallery anytime from the product page.'
        ),
      },
      {
        icon: 'warehouse',
        title: t(
          'business.onboarding.firstSale.success.nextSteps.inventoryTitle',
          'Adjust stock & location prices'
        ),
        body: t(
          'business.onboarding.firstSale.success.nextSteps.inventoryBody',
          'Change quantity, availability, and optional per-variant prices at each location.'
        ),
      },
      ...(savedAsDraft
        ? [
            {
              icon: 'send-check-outline' as const,
              title: t(
                'business.onboarding.firstSale.success.nextSteps.publishTitle',
                'Publish when ready'
              ),
              body: t(
                'business.onboarding.firstSale.success.nextSteps.publishBody',
                'Submit the product for approval so it can appear in the public catalog.'
              ),
            },
          ]
        : []),
    ],
    [savedAsDraft, t]
  );

  const heroLabel = savedAsDraft
    ? t('business.onboarding.firstSale.success.draftTitle', 'Draft saved')
    : t(
        'business.onboarding.firstSale.success.titleSubmitted',
        'Submitted for approval'
      );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            borderColor: colors.divider,
          },
        ]}
      >
        <View
          style={styles.hero}
          accessibilityRole="image"
          accessibilityLabel={heroLabel}
        >
          <LottieView
            ref={lottieRef}
            source={PRODUCT_SUCCESS}
            autoPlay
            loop={false}
            style={{ width: ANIMATION_SIZE, height: ANIMATION_SIZE }}
          />
        </View>

        <Text
          variant="headlineSmall"
          style={[styles.title, { color: colors.text.primary }, typography.h5 as object]}
        >
          {heroLabel}
        </Text>

        <Text
          variant="bodyLarge"
          style={[styles.subtitle, { color: colors.text.secondary }]}
        >
          {savedAsDraft
            ? t(
                'business.onboarding.firstSale.success.draftBody',
                '{{name}} is saved as a draft{{location}}. Publish it when you are ready for review.',
                { name: item.name, location: locationSuffix }
              )
            : t(
                'business.onboarding.firstSale.success.bodySubmitted',
                '{{name}} is stocked{{location}} and awaits review before it appears in the public catalog.',
                { name: item.name, location: locationSuffix }
              )}
        </Text>

        <View
          style={[
            styles.itemCard,
            {
              backgroundColor: colors.primary.main + '0A',
              borderColor: colors.primary.main + '22',
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text variant="labelSmall" style={{ color: colors.text.secondary, marginBottom: 4 }}>
            {savedAsDraft
              ? t('business.onboarding.firstSale.success.draftLabel', 'Draft product')
              : t(
                  'business.onboarding.firstSale.success.productLabel',
                  'Submitted product'
                )}
          </Text>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '600' }}>
            {item.name}
          </Text>
          {formattedPrice ? (
            <Text
              variant="labelLarge"
              style={{ color: colors.primary.main, fontWeight: '600', marginTop: 10 }}
            >
              {formattedPrice}
            </Text>
          ) : null}
        </View>

        {!savedAsDraft ? (
          <ProductEnrichmentNudge
            itemId={item.id}
            businessId={businessId}
            photoCount={photoCount}
            visible
            onPhotoAdded={onPhotoAdded}
            onError={onEnrichmentError}
          />
        ) : null}

        <View style={[styles.nextSteps, { borderTopColor: colors.divider }]}>
          <Text
            variant="titleSmall"
            style={[styles.nextStepsTitle, { color: colors.text.primary }]}
          >
            {t(
              'business.onboarding.firstSale.success.nextSteps.title',
              'What’s next?'
            )}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginBottom: spacing.md, textAlign: 'center' }}
          >
            {t(
              'business.onboarding.firstSale.success.nextSteps.intro',
              'Open the product details page to keep improving this listing.'
            )}
          </Text>
          {nextSteps.map((step) => (
            <View
              key={step.title}
              style={[
                styles.nextStepRow,
                {
                  backgroundColor: colors.pageBackground,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <View
                style={[
                  styles.nextStepIcon,
                  { backgroundColor: accent + '18', borderRadius: borderRadius.sm },
                ]}
              >
                <MaterialCommunityIcons name={step.icon} size={22} color={accent} />
              </View>
              <View style={styles.nextStepCopy}>
                <Text
                  variant="titleSmall"
                  style={{ color: colors.text.primary, fontWeight: '600' }}
                >
                  {step.title}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: colors.text.secondary, marginTop: 2, lineHeight: 18 }}
                >
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        {onBackToDashboard ? (
          <Button
            mode="contained"
            icon="view-dashboard-outline"
            onPress={onBackToDashboard}
            style={styles.actionBtn}
            contentStyle={styles.actionContent}
          >
            {t('business.verification.backToDashboard', 'Back to dashboard')}
          </Button>
        ) : (
          <Button
            mode="contained"
            icon="package-variant-closed"
            onPress={onViewItem}
            style={styles.actionBtn}
            contentStyle={styles.actionContent}
          >
            {t(
              'business.onboarding.firstSale.success.openDetails',
              'Open product details'
            )}
          </Button>
        )}
        {onBackToDashboard ? (
          <Button
            mode="outlined"
            icon="package-variant-closed"
            onPress={onViewItem}
            style={styles.actionBtn}
            contentStyle={styles.actionContent}
          >
            {t(
              'business.onboarding.firstSale.success.openDetails',
              'Open product details'
            )}
          </Button>
        ) : null}
        <Button
          mode="outlined"
          icon="format-list-bulleted"
          onPress={onBackToItems}
          style={styles.actionBtn}
          contentStyle={styles.actionContent}
        >
          {t('business.onboarding.firstSale.success.backToItems', 'Back to items')}
        </Button>
        {onAddAnother ? (
          <Button
            mode="text"
            icon="plus"
            onPress={onAddAnother}
            style={styles.actionBtn}
            contentStyle={styles.actionContent}
          >
            {t('business.onboarding.firstSale.success.addAnother', 'Add another product')}
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  hero: { marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontWeight: '700', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  itemCard: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'center',
  },
  nextSteps: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextStepsTitle: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 6,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    marginBottom: 8,
  },
  nextStepIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepCopy: { flex: 1, minWidth: 0 },
  actions: { marginTop: 20, gap: 12, width: '100%', maxWidth: 400, alignSelf: 'center' },
  actionBtn: { borderRadius: 12 },
  actionContent: { minHeight: 48 },
});
