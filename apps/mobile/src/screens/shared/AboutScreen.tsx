import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Appbar, Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../../components/Logo';
import { useTheme } from '../../contexts/ThemeContext';
import { useDeveloperUnlock } from '../../hooks/useDeveloperUnlock';
import type { AuthStackParamList } from '../../navigation/types';
import { getAppVersion, getOtaReleaseInfo } from '../../utils/appVersion';

type Props = NativeStackScreenProps<AuthStackParamList, 'About'>;

function formatOtaDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function AboutScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { unlocked, registerVersionTap } = useDeveloperUnlock();
  const version = getAppVersion();
  const ota = useMemo(() => getOtaReleaseInfo(), []);
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const otaDate = formatOtaDate(ota.createdAtIso, locale);

  const onVersionPress = useCallback(() => {
    if (unlocked) return;
    if (registerVersionTap()) {
      navigation.navigate('DeveloperOptions');
    }
  }, [navigation, registerVersionTap, unlocked]);

  const releaseLabel = !ota.isEnabled
    ? t('about.ota.disabled', 'OTA updates disabled')
    : ota.isEmbeddedLaunch
      ? t('about.ota.embedded', 'Embedded build (no OTA applied)')
      : t('about.ota.applied', 'OTA update applied');

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.pageBackground, paddingTop: insets.top },
      ]}
    >
      <Appbar.Header
        style={{ backgroundColor: colors.surface }}
        statusBarHeight={0}
      >
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('about.title', 'About')} />
      </Appbar.Header>

      <View style={[styles.body, { padding: spacing.lg }]}>
        <Logo variant="compact" />
        <Text
          variant="headlineSmall"
          style={[styles.brand, { color: colors.text.primary }]}
        >
          Rendasua
        </Text>
        <Pressable
          onPress={onVersionPress}
          accessibilityRole="button"
          accessibilityLabel={t('about.versionA11y', 'App version {{version}}', {
            version,
          })}
          hitSlop={12}
        >
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t('about.version', 'Version {{version}}', { version })}
          </Text>
        </Pressable>

        <View
          style={[
            styles.otaCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              borderRadius: borderRadius.md ?? 12,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text
            variant="labelLarge"
            style={[styles.otaTitle, { color: colors.text.primary }]}
          >
            {t('about.ota.title', 'OTA release')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {releaseLabel}
          </Text>
          {ota.channel ? (
            <OtaRow
              label={t('about.ota.channel', 'Channel')}
              value={ota.channel}
              muted={colors.text.secondary}
              strong={colors.text.primary}
            />
          ) : null}
          {ota.runtimeVersion ? (
            <OtaRow
              label={t('about.ota.runtime', 'Runtime')}
              value={ota.runtimeVersion}
              muted={colors.text.secondary}
              strong={colors.text.primary}
            />
          ) : null}
          {ota.updateIdShort ? (
            <OtaRow
              label={t('about.ota.updateId', 'Update ID')}
              value={ota.updateIdShort}
              muted={colors.text.secondary}
              strong={colors.text.primary}
              fullValue={ota.updateId ?? undefined}
            />
          ) : null}
          {otaDate ? (
            <OtaRow
              label={t('about.ota.published', 'Published')}
              value={otaDate}
              muted={colors.text.secondary}
              strong={colors.text.primary}
            />
          ) : null}
        </View>

        {unlocked ? (
          <Button
            mode="outlined"
            icon="code-braces"
            style={styles.devButton}
            contentStyle={styles.devButtonContent}
            onPress={() => navigation.navigate('DeveloperOptions')}
          >
            {t('about.developer.title', 'Developer Options')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function OtaRow({
  label,
  value,
  muted,
  strong,
  fullValue,
}: {
  label: string;
  value: string;
  muted: string;
  strong: string;
  fullValue?: string;
}) {
  return (
    <View style={styles.otaRow} accessibilityLabel={`${label}: ${fullValue ?? value}`}>
      <Text variant="labelSmall" style={{ color: muted }}>
        {label}
      </Text>
      <Text
        variant="bodySmall"
        numberOfLines={1}
        selectable
        style={[styles.otaValue, { color: strong }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  brand: {
    fontWeight: '700',
    marginTop: 8,
  },
  otaCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  otaTitle: {
    fontWeight: '700',
  },
  otaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  otaValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  devButton: {
    marginTop: 24,
    alignSelf: 'center',
  },
  devButtonContent: {
    justifyContent: 'center',
  },
});
