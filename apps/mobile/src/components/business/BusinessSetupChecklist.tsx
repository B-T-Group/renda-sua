import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme';
import type { BusinessVerificationStatus } from '../../services/businessVerificationApi';

type SetupStepId = 'agreement' | 'logo' | 'catalog';

type SetupStep = {
  id: SetupStepId;
  label: string;
  description: string;
  done: boolean;
  current: boolean;
  error?: boolean;
  cta?: string;
  onPress?: () => void;
  pendingNote?: string;
};

type Props = {
  status: BusinessVerificationStatus;
  mainInterest: 'sell_items' | 'rent_items';
  /** Soft catalog progress when the MM rail omits steps.catalog. */
  hasAnyItem?: boolean;
  onSignAgreement: () => void;
  onSetupPayouts: () => void;
  onUploadId: () => void;
  onAddProduct: () => void;
  onManageLocations: () => void;
  onViewItems?: () => void;
  onRefresh?: () => Promise<void> | void;
};

export function BusinessSetupChecklist({
  status,
  mainInterest,
  hasAnyItem = false,
  onSignAgreement,
  onSetupPayouts: _onSetupPayouts,
  onUploadId: _onUploadId,
  onAddProduct,
  onManageLocations,
  onViewItems,
  onRefresh,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const catalog = status.steps.catalog;
  const agreementSigned = status.steps.agreement?.complete === true;
  const hasItems =
    hasAnyItem ||
    Boolean(
      catalog?.hasPendingItem ||
        catalog?.hasApprovedItem ||
        catalog?.hasPendingRental ||
        catalog?.hasApprovedRental
    );
  const showCatalogActions = agreementSigned;
  const showViewItems = Boolean(onViewItems) && (showCatalogActions || hasItems);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  const steps = useMemo(
    () =>
      buildSteps({
        status,
        mainInterest,
        hasAnyItem,
        t,
        onSignAgreement,
        onAddProduct,
        onManageLocations,
      }),
    [status, mainInterest, hasAnyItem, t, onSignAgreement, onAddProduct, onManageLocations]
  );
  const current =
    steps.find((s) => s.current && !s.done) ?? steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  const addItemsCta =
    mainInterest === 'rent_items'
      ? t('business.setup.ctaAddRental', 'Add rental')
      : t('business.setup.ctaAddProduct', 'Add items');
  const viewItemsCta =
    mainInterest === 'rent_items'
      ? t('business.setup.ctaViewRentals', 'View rentals')
      : t('business.setup.ctaViewItems', 'View items');

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.primary.light,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <Text variant="titleLarge" style={{ color: colors.text.primary, marginBottom: 4 }}>
        {t('business.setup.title', 'Set up your store')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {current
          ? t(
              'business.setup.focusSubtitle',
              'Finish this step to keep moving toward going live.'
            )
          : t(
              'business.setup.subtitle',
              'Complete these steps to go live and accept orders.'
            )}
      </Text>

      {doneCount > 0 ? (
        <View style={[styles.doneList, { marginBottom: spacing.sm, gap: 6 }]}>
          {steps
            .filter((s) => s.done)
            .map((step) => (
              <View key={step.id} style={styles.doneRow}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color={colors.success.main}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: colors.text.secondary, flex: 1 }}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {current ? (
        <SetupStepFocus
          step={current}
          accent={colors.primary.main}
          muted={colors.text.secondary}
          highlightBg={colors.primaryTint}
          radius={borderRadius.md}
          errorColor={colors.error.main}
          errorBg={colors.errorTint}
        />
      ) : null}

      {steps
        .filter((s) => !s.done && s.id !== current?.id)
        .map((step) => (
          <View
            key={step.id}
            style={[
              styles.upcomingRow,
              {
                borderColor: colors.divider,
                borderRadius: borderRadius.md,
                marginTop: spacing.sm,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="checkbox-blank-circle-outline"
              size={18}
              color={colors.text.disabled}
            />
            <Text
              variant="bodySmall"
              style={{ color: colors.text.disabled, flex: 1 }}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        ))}

      {current?.onPress && current.cta ? (
        <Button
          mode="contained"
          onPress={current.onPress}
          style={{ marginTop: spacing.md }}
          buttonColor={current.error ? colors.error.main : undefined}
          contentStyle={styles.primaryCta}
        >
          {current.cta}
        </Button>
      ) : null}
      {showCatalogActions ? (
        <Button
          mode="outlined"
          onPress={onAddProduct}
          style={{ marginTop: spacing.sm }}
        >
          {addItemsCta}
        </Button>
      ) : null}
      {showViewItems ? (
        <Button
          mode="outlined"
          onPress={onViewItems}
          style={{ marginTop: spacing.sm }}
        >
          {viewItemsCta}
        </Button>
      ) : null}
      {onRefresh ? (
        <Button
          mode="text"
          loading={refreshing}
          onPress={() => void handleRefresh()}
          style={{ marginTop: spacing.xs }}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      ) : null}
    </View>
  );
}

function SetupStepFocus({
  step,
  accent,
  muted,
  highlightBg,
  radius,
  errorColor,
  errorBg,
}: {
  step: SetupStep;
  accent: string;
  muted: string;
  highlightBg: string;
  radius: number;
  errorColor: string;
  errorBg: string;
}) {
  const errored = step.error === true;
  return (
    <View
      style={[
        styles.focusCard,
        {
          borderColor: errored ? errorColor : accent,
          backgroundColor: errored ? errorBg : highlightBg,
          borderRadius: radius,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={errored ? 'alert-circle' : 'arrow-right-circle'}
        size={22}
        color={errored ? errorColor : accent}
      />
      <View style={styles.stepBody}>
        <Text
          variant="titleMedium"
          style={{
            color: errored ? errorColor : accent,
            fontWeight: '700',
          }}
        >
          {step.label}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted, marginTop: 4 }}>
          {step.description}
        </Text>
        {step.pendingNote ? (
          <Text
            variant="bodySmall"
            style={{
              color: errored ? errorColor : muted,
              marginTop: 6,
            }}
          >
            {step.pendingNote}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type BuildArgs = {
  status: BusinessVerificationStatus;
  mainInterest: 'sell_items' | 'rent_items';
  hasAnyItem: boolean;
  t: (key: string, defaultValue: string) => string;
  onSignAgreement: () => void;
  onAddProduct: () => void;
  onManageLocations: () => void;
};

function buildAgreementStep(args: BuildArgs): SetupStep {
  const { status, t, onSignAgreement } = args;
  return {
    id: 'agreement',
    label: t('business.setup.stepAgreement', 'Sign merchant agreement'),
    description: t(
      'business.setup.stepAgreementDesc',
      'Accept the partnership terms to sell on Rendasua.'
    ),
    done: status.steps.agreement?.complete === true,
    current: status.nextAction === 'sign_agreement',
    cta: status.contract?.boldSignEnabled
      ? t('business.contract.viewStatus', 'View signing status')
      : t('business.setup.ctaAgreement', 'Sign agreement'),
    onPress: onSignAgreement,
  };
}

function buildCatalogStep(args: BuildArgs): SetupStep {
  const { status, mainInterest, hasAnyItem, t, onAddProduct } = args;
  const catalog = status.steps.catalog;
  const hasItems =
    hasAnyItem ||
    Boolean(
      catalog?.hasPendingItem ||
        catalog?.hasApprovedItem ||
        catalog?.hasPendingRental ||
        catalog?.hasApprovedRental
    );
  const agreementDone = status.steps.agreement?.complete === true;
  return {
    id: 'catalog',
    label: t('ftue.checklist.merchantFirstProduct', 'Publish your first product'),
    description: t(
      'business.setup.stepCatalogDesc',
      'Add at least one item so customers can discover your store.'
    ),
    done: hasItems || catalog?.complete === true,
    current: agreementDone && !hasItems,
    cta:
      mainInterest === 'rent_items'
        ? t('business.setup.ctaAddRental', 'Add rental')
        : t('business.setup.ctaAddProduct', 'Add items'),
    onPress: onAddProduct,
  };
}

function buildLogoStep(args: BuildArgs): SetupStep {
  const { status, t, onManageLocations } = args;
  const agreementDone = status.steps.agreement?.complete === true;
  const hasLocation = status.steps.catalog?.hasLocation === true;
  return {
    id: 'logo',
    label: t('ftue.checklist.merchantLogo', 'Add a store logo'),
    description: t(
      'business.setup.stepLogoDesc',
      'A logo helps customers recognize your storefront.'
    ),
    done: hasLocation,
    current: agreementDone && !hasLocation,
    cta: t('business.setup.ctaLocations', 'Manage locations'),
    onPress: onManageLocations,
  };
}

function buildSteps(args: BuildArgs): SetupStep[] {
  // Agreement is required. Logo/catalog are soft tips while still in setup.
  // ID and Stripe Connect are optional verified-badge tips after go-live.
  return [buildAgreementStep(args), buildLogoStep(args), buildCatalogStep(args)];
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  doneList: {},
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  primaryCta: {
    minHeight: 48,
  },
});
