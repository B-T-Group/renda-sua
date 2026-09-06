import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import type {
  ProcessingStageKey,
  ProcessingStageState,
} from '../../../utils/productCreateProcessing';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';

const LOADING_LOTTIE = require('../../../../assets/animations/loading.json') as AnimationObject;
const CONFIRM_LOTTIE = require('../../../../assets/animations/confirm.json') as AnimationObject;
const ANIMATION_SIZE = 132;

export interface AddItemProcessingStepProps {
  stages: ProcessingStageState[];
  complete: boolean;
  failed: boolean;
  timedOut: boolean;
  error?: string | null;
  onContinue: () => void;
  onRetry: () => void;
}

const STAGE_ICONS: Record<ProcessingStageKey, string> = {
  upload: 'cloud-upload-outline',
  thumbnails: 'image-multiple-outline',
  draft: 'file-document-outline',
  optimize: 'image-filter-center-focus',
  cleanup: 'auto-fix',
  analyze: 'brain',
  details: 'tag-text-outline',
};

function stageLabel(
  key: ProcessingStageKey,
  t: (k: string, d: string) => string
): string {
  switch (key) {
    case 'upload':
      return t(
        'business.onboarding.firstSale.processing.upload',
        'Uploading photos'
      );
    case 'thumbnails':
      return t(
        'business.onboarding.firstSale.processing.thumbnails',
        'Creating thumbnails'
      );
    case 'draft':
      return t(
        'business.onboarding.firstSale.processing.draft',
        'Creating product draft'
      );
    case 'optimize':
      return t(
        'business.onboarding.firstSale.processing.optimize',
        'Optimizing images for catalog'
      );
    case 'cleanup':
      return t(
        'business.onboarding.firstSale.processing.cleanup',
        'Sending photos for AI cleanup'
      );
    case 'analyze':
      return t(
        'business.onboarding.firstSale.processing.analyze',
        'Analyzing photos with AI'
      );
    case 'details':
      return t(
        'business.onboarding.firstSale.processing.details',
        'Extracting title, category & price'
      );
    default:
      return key;
  }
}

function StatusIcon({
  status,
  stageKey,
  colors,
}: {
  status: ProcessingStageState['status'];
  stageKey: ProcessingStageKey;
  colors: {
    success: { main: string };
    primary: { main: string };
    error: { main: string };
    text: { secondary: string };
  };
}) {
  if (status === 'done') {
    return <Icon source="check-circle" size={20} color={colors.success.main} />;
  }
  if (status === 'active') {
    return <ActivityIndicator size={18} color={colors.primary.main} />;
  }
  if (status === 'error') {
    return <Icon source="alert-circle" size={20} color={colors.error.main} />;
  }
  if (status === 'skipped') {
    return <Icon source="minus-circle" size={20} color={colors.text.secondary} />;
  }
  return (
    <Icon
      source={STAGE_ICONS[stageKey]}
      size={20}
      color={colors.text.secondary}
    />
  );
}

export function AddItemProcessingStep({
  stages,
  complete,
  failed,
  timedOut,
  error,
  onContinue,
  onRetry,
}: AddItemProcessingStepProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  const activeStage = useMemo(
    () => stages.find((s) => s.status === 'active') ?? null,
    [stages]
  );
  const doneCount = stages.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const progressLabel = t(
    'business.onboarding.firstSale.processing.progressCount',
    '{{done}} of {{total}} steps',
    { done: doneCount, total: stages.length }
  );

  useEffect(() => {
    lottieRef.current?.reset();
    lottieRef.current?.play();
  }, [complete, failed, activeStage?.key]);

  const heroTitle = complete
    ? timedOut
      ? t(
          'business.onboarding.firstSale.processing.timeoutTitle',
          'Almost ready'
        )
      : t(
          'business.onboarding.firstSale.processing.doneTitle',
          'Listing prepared'
        )
    : failed
      ? t(
          'business.onboarding.firstSale.processing.failedTitle',
          'Something went wrong'
        )
      : t(
          'business.onboarding.firstSale.processing.title',
          'Preparing your listing'
        );

  const heroBody = complete
    ? timedOut
      ? t(
          'business.onboarding.firstSale.processing.timeoutBody',
          'Some steps took too long. You can continue and finish details on the next screen.'
        )
      : t(
          'business.onboarding.firstSale.processing.doneBody',
          'Ready — review the details we filled in.'
        )
    : failed
      ? t(
          'business.onboarding.firstSale.processing.failedBody',
          'You can retry — we keep any photos that already uploaded.'
        )
      : activeStage
        ? t(
            'business.onboarding.firstSale.processing.activeHint',
            'Working on: {{step}}',
            { step: stageLabel(activeStage.key, t) }
          )
        : t(
            'business.onboarding.firstSale.processing.body',
            'We handle uploads, thumbnails, and AI details for you — keep this screen open.'
          );

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.lg) + 24 },
      ]}
    >
      <View style={styles.hero}>
        <LottieView
          ref={lottieRef}
          source={complete && !failed ? CONFIRM_LOTTIE : LOADING_LOTTIE}
          autoPlay
          loop={!complete && !failed}
          style={{ width: ANIMATION_SIZE, height: ANIMATION_SIZE }}
        />
        <Text
          variant="titleLarge"
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: spacing.xs,
          }}
        >
          {heroTitle}
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          {heroBody}
        </Text>
        {!complete && !failed ? (
          <Text variant="labelMedium" style={{ color: colors.primary.main }}>
            {progressLabel}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
          },
        ]}
      >
        <Text
          variant="titleSmall"
          style={{
            color: colors.text.primary,
            fontWeight: '600',
            marginBottom: spacing.xs,
          }}
        >
          {t(
            'business.onboarding.firstSale.processing.checklistTitle',
            'What we’re doing for you'
          )}
        </Text>
        {stages.map((stage) => (
          <View key={stage.key} style={[styles.row, { marginTop: spacing.sm }]}>
            <StatusIcon
              status={stage.status}
              stageKey={stage.key}
              colors={colors}
            />
            <View style={{ flex: 1, marginLeft: spacing.sm, minWidth: 0 }}>
              <Text
                variant="bodyMedium"
                style={{
                  color:
                    stage.status === 'pending'
                      ? colors.text.secondary
                      : colors.text.primary,
                  fontWeight: stage.status === 'active' ? '600' : '400',
                }}
                numberOfLines={2}
              >
                {stageLabel(stage.key, t)}
                {stage.status === 'skipped'
                  ? ` · ${t('common.skipped', 'Skipped')}`
                  : ''}
                {stage.status === 'done' && stage.key === 'cleanup'
                  ? ` · ${t(
                      'business.onboarding.firstSale.processing.cleanupQueued',
                      'Queued'
                    )}`
                  : ''}
              </Text>
              {stage.detail ? (
                <Text
                  variant="bodySmall"
                  style={{ color: colors.error.main, marginTop: 2 }}
                  numberOfLines={2}
                >
                  {stage.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {error && failed ? (
        <Text
          variant="bodyMedium"
          style={{ color: colors.error.main, marginTop: spacing.md }}
        >
          {error}
        </Text>
      ) : null}

      <View style={[styles.actions, { marginTop: spacing.lg, gap: spacing.sm }]}>
        {failed ? (
          <Button mode="outlined" onPress={onRetry} contentStyle={styles.btn}>
            {t('common.retry', 'Retry')}
          </Button>
        ) : null}
        <Button
          mode="contained"
          disabled={!complete && !timedOut}
          onPress={onContinue}
          contentStyle={styles.btn}
        >
          {timedOut
            ? t(
                'business.onboarding.firstSale.processing.timeoutContinue',
                'Continue anyway'
              )
            : t(
                'business.onboarding.firstSale.processing.continue',
                'Continue to review'
              )}
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  hero: { alignItems: 'center', marginBottom: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  actions: {},
  btn: { minHeight: 48 },
});
