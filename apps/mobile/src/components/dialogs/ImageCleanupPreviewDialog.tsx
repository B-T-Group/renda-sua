import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageActiveVersionPicker } from '../business/images/ImageActiveVersionPicker';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { ImageActiveVersion } from '../../types/imageCleanup';

export type ImageCleanupDialogActions =
  | 'accept-reject'
  | 'version-toggle'
  | 'review-rembg'
  | 'review-ai';

export interface ImageCleanupPreviewDialogProps {
  visible: boolean;
  originalUrl: string;
  rembgUrl?: string | null;
  enhancedUrl?: string | null;
  /** @deprecated Prefer rembgUrl / enhancedUrl; kept for callers that pass cleaned URL. */
  cleanedUrl?: string | null;
  kind?: 'rembg' | 'ai' | null;
  loading?: boolean;
  busy?: boolean;
  changes?: string[] | null;
  confidenceTier?: 'high' | 'medium' | 'low' | string | null;
  actions?: ImageCleanupDialogActions;
  /** When true, start showing the original (e.g. after revert). */
  initiallyShowOriginal?: boolean;
  canUpgradeToAi?: boolean;
  onDismiss: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onUseOriginal?: () => void;
  onUseRembg?: () => void;
  onUseEnhanced?: () => void;
  onUpgradeToAi?: () => void;
}

export function ImageCleanupPreviewDialog({
  visible,
  originalUrl,
  rembgUrl = null,
  enhancedUrl = null,
  cleanedUrl = null,
  kind = null,
  loading = false,
  busy = false,
  changes = null,
  confidenceTier = null,
  actions = 'accept-reject',
  initiallyShowOriginal = false,
  canUpgradeToAi = false,
  onDismiss,
  onAccept,
  onReject,
  onUseOriginal,
  onUseRembg,
  onUseEnhanced,
  onUpgradeToAi,
}: ImageCleanupPreviewDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const resolvedRembg =
    rembgUrl || (kind === 'rembg' ? cleanedUrl : null) || null;
  const resolvedEnhanced =
    enhancedUrl || (kind === 'ai' ? cleanedUrl : null) || null;

  const initialVersion = useMemo((): ImageActiveVersion => {
    if (initiallyShowOriginal) return 'original';
    if (kind === 'rembg' && resolvedRembg) return 'rembg';
    if (resolvedEnhanced) return 'enhanced';
    if (resolvedRembg) return 'rembg';
    return 'original';
  }, [initiallyShowOriginal, kind, resolvedEnhanced, resolvedRembg]);

  const [activeVersion, setActiveVersion] =
    useState<ImageActiveVersion>(initialVersion);

  useEffect(() => {
    if (!visible) return;
    setActiveVersion(initialVersion);
  }, [visible, initialVersion]);

  const showUrl =
    activeVersion === 'rembg' && resolvedRembg
      ? resolvedRembg
      : activeVersion === 'enhanced' && resolvedEnhanced
        ? resolvedEnhanced
        : originalUrl;

  const hasAnyCleaned = !!(resolvedRembg || resolvedEnhanced);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={busy ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.88,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <DialogHeader
            confidenceTier={confidenceTier}
            kind={kind}
            colors={colors}
            t={t}
          />

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
              gap: spacing.md,
            }}
            showsVerticalScrollIndicator={false}
            bounces={Platform.OS === 'ios'}
          >
            {hasAnyCleaned ? (
              <ImageActiveVersionPicker
                value={activeVersion}
                hasRembg={!!resolvedRembg}
                hasEnhanced={!!resolvedEnhanced}
                disabled={loading || busy}
                onChange={setActiveVersion}
              />
            ) : null}
            <ComparePane
              showUrl={showUrl}
              activeVersion={activeVersion}
              loading={loading}
              colors={colors}
              borderRadius={borderRadius.md ?? 8}
              t={t}
            />
            <ChangesList changes={changes} colors={colors} t={t} />
          </ScrollView>

          <DialogActions
            actions={actions}
            loading={loading}
            busy={busy}
            hasRembg={!!resolvedRembg}
            hasEnhanced={!!resolvedEnhanced}
            canUpgradeToAi={canUpgradeToAi}
            colors={colors}
            spacing={spacing}
            onAccept={onAccept}
            onReject={onReject}
            onUseOriginal={onUseOriginal}
            onUseRembg={onUseRembg}
            onUseEnhanced={onUseEnhanced}
            onUpgradeToAi={onUpgradeToAi}
            onDismiss={onDismiss}
            t={t}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogHeader({
  confidenceTier,
  kind,
  colors,
  t,
}: {
  confidenceTier?: string | null;
  kind?: 'rembg' | 'ai' | null;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string, def: string) => string;
}) {
  return (
    <View style={styles.headerRow}>
      <Text
        variant="titleLarge"
        style={[styles.title, { color: colors.text.primary, flex: 1 }]}
      >
        {t('business.items.images.cleanup.previewTitle', 'Compare photos')}
      </Text>
      {kind === 'rembg' ? (
        <StatusPill
          compact
          label={t('business.images.cleanupKinds.removeBg', 'Remove bg')}
          backgroundColor={colors.pageBackground}
          textColor={colors.text.secondary}
          borderColor={colors.divider}
        />
      ) : null}
      {kind === 'ai' ? (
        <StatusPill
          compact
          label={t('business.images.cleanupKinds.aiShort', 'AI')}
          backgroundColor={colors.pageBackground}
          textColor={colors.text.secondary}
          borderColor={colors.divider}
        />
      ) : null}
      {confidenceTier ? (
        <StatusPill
          compact
          label={tierLabel(confidenceTier, t)}
          backgroundColor={colors.pageBackground}
          textColor={colors.text.secondary}
          borderColor={colors.divider}
        />
      ) : null}
    </View>
  );
}

function ComparePane({
  showUrl,
  activeVersion,
  loading,
  colors,
  borderRadius,
  t,
}: {
  showUrl: string;
  activeVersion: ImageActiveVersion;
  loading: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  borderRadius: number;
  t: (key: string, def: string) => string;
}) {
  if (loading) {
    return (
      <View
        style={[
          styles.preview,
          styles.placeholder,
          { borderRadius, backgroundColor: colors.pageBackground },
        ]}
      >
        <ActivityIndicator color={colors.primary.main} />
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 8 }}
        >
          {t('business.items.images.cleanup.loading', 'Cleaning photo…')}
        </Text>
      </View>
    );
  }

  if (!showUrl) {
    return (
      <View
        style={[
          styles.preview,
          styles.placeholder,
          { borderRadius, backgroundColor: colors.pageBackground },
        ]}
      >
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('business.items.images.cleanup.error', 'Cleanup failed')}
        </Text>
      </View>
    );
  }

  const label =
    activeVersion === 'rembg'
      ? t('business.images.versions.noBg', 'No bg')
      : activeVersion === 'enhanced'
        ? t('business.images.versions.ai', 'AI')
        : t('business.items.images.cleanup.original', 'Original');

  return (
    <View>
      <Text
        variant="labelLarge"
        style={[styles.sectionLabel, { color: colors.text.secondary }]}
      >
        {label}
      </Text>
      <Image
        source={{ uri: showUrl }}
        style={[
          styles.preview,
          { borderRadius, backgroundColor: colors.pageBackground },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

function ChangesList({
  changes,
  colors,
  t,
}: {
  changes?: string[] | null;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string, def: string) => string;
}) {
  if (!changes?.length) return null;
  return (
    <View>
      <Text
        variant="labelLarge"
        style={{ color: colors.text.secondary, marginBottom: 6 }}
      >
        {t('business.images.enhancement.changes', 'What changed')}
      </Text>
      {changes.map((change) => (
        <Text
          key={change}
          variant="bodySmall"
          style={{ color: colors.text.primary, marginBottom: 4 }}
        >
          • {change}
        </Text>
      ))}
    </View>
  );
}

function DialogActions({
  actions,
  loading,
  busy,
  hasRembg,
  hasEnhanced,
  canUpgradeToAi,
  colors,
  spacing,
  onAccept,
  onReject,
  onUseOriginal,
  onUseRembg,
  onUseEnhanced,
  onUpgradeToAi,
  onDismiss,
  t,
}: {
  actions: ImageCleanupDialogActions;
  loading: boolean;
  busy: boolean;
  hasRembg: boolean;
  hasEnhanced: boolean;
  canUpgradeToAi: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  onAccept?: () => void;
  onReject?: () => void;
  onUseOriginal?: () => void;
  onUseRembg?: () => void;
  onUseEnhanced?: () => void;
  onUpgradeToAi?: () => void;
  onDismiss: () => void;
  t: (key: string, def: string) => string;
}) {
  return (
    <View
      style={[
        styles.actions,
        { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
      ]}
    >
      {actions === 'review-rembg' ? (
        <>
          {onAccept ? (
            <Button
              mode="contained"
              onPress={onAccept}
              disabled={loading || !hasRembg || busy}
              loading={busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.images.cleanupKinds.useThis', 'Use this')}
            </Button>
          ) : null}
          {canUpgradeToAi && onUpgradeToAi ? (
            <Button
              mode="outlined"
              onPress={onUpgradeToAi}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t(
                'business.images.cleanupKinds.enhanceWithAi',
                'Enhance with AI (1 token)'
              )}
            </Button>
          ) : null}
          {onReject ? (
            <Button
              mode="outlined"
              onPress={onReject}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t(
                'business.images.enhancement.useOriginal',
                'Keep original'
              )}
            </Button>
          ) : null}
        </>
      ) : null}

      {actions === 'review-ai' ? (
        <>
          {onAccept || onUseEnhanced ? (
            <Button
              mode="contained"
              onPress={onAccept ?? onUseEnhanced}
              disabled={loading || !hasEnhanced || busy}
              loading={busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.images.cleanupKinds.useAi', 'Use AI')}
            </Button>
          ) : null}
          {hasRembg && onUseRembg ? (
            <Button
              mode="outlined"
              onPress={onUseRembg}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.images.cleanupKinds.useNoBg', 'Use no-bg')}
            </Button>
          ) : null}
          {onReject || onUseOriginal ? (
            <Button
              mode="outlined"
              onPress={onReject ?? onUseOriginal}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t(
                'business.images.enhancement.useOriginal',
                'Keep original'
              )}
            </Button>
          ) : null}
        </>
      ) : null}

      {actions === 'version-toggle' ? (
        <>
          {onUseEnhanced ? (
            <Button
              mode="contained"
              onPress={onUseEnhanced}
              disabled={loading || !hasEnhanced || busy}
              loading={busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.images.enhancement.useEnhanced', 'Use enhanced')}
            </Button>
          ) : null}
          {hasRembg && onUseRembg ? (
            <Button
              mode="outlined"
              onPress={onUseRembg}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.images.cleanupKinds.useNoBg', 'Use no-bg')}
            </Button>
          ) : null}
          {onUseOriginal ? (
            <Button
              mode="outlined"
              onPress={onUseOriginal}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t(
                'business.images.enhancement.useOriginal',
                'Use original'
              )}
            </Button>
          ) : null}
        </>
      ) : null}

      {actions === 'accept-reject' ? (
        <>
          {onAccept ? (
            <Button
              mode="contained"
              onPress={onAccept}
              disabled={loading || (!hasRembg && !hasEnhanced) || busy}
              loading={busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.items.images.cleanup.accept', 'Accept')}
            </Button>
          ) : null}
          {onReject ? (
            <Button
              mode="outlined"
              onPress={onReject}
              disabled={loading || busy}
              style={styles.actionBtn}
              contentStyle={styles.actionContent}
            >
              {t('business.items.images.cleanup.reject', 'Reject')}
            </Button>
          ) : null}
        </>
      ) : null}

      <Button
        mode="text"
        onPress={onDismiss}
        disabled={busy}
        textColor={colors.text.secondary}
        style={styles.actionBtn}
        contentStyle={styles.actionContent}
      >
        {t('common.close', 'Close')}
      </Button>
    </View>
  );
}

function tierLabel(
  tier: string,
  t: (key: string, def: string) => string
): string {
  if (tier === 'high') {
    return t('business.images.enhancement.tierHigh', 'High confidence');
  }
  if (tier === 'medium') {
    return t('business.images.enhancement.tierMedium', 'Medium confidence');
  }
  return t('business.images.enhancement.tierLow', 'Needs review');
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontWeight: '700',
  },
  sectionLabel: {
    marginBottom: 8,
    marginLeft: 4,
  },
  preview: {
    width: '100%',
    height: 260,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 4,
  },
  actionBtn: {
    width: '100%',
    borderRadius: 12,
  },
  actionContent: {
    minHeight: 48,
  },
});
