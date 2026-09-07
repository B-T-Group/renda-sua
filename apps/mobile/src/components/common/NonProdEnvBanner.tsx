import React from 'react';
import { StyleSheet, View } from 'react-native';
import { observer } from 'mobx-react-lite';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { isNonProdEnv } from '../../config/envSwitch';
import { useRuntimeEnv } from '../../hooks/useRuntimeEnv';
import { useStore } from '../../stores/RootStore';

/** Space below safe area so the pill clears the agent online status bar. */
const AGENT_STATUS_BAR_CLEARANCE = 52;

/** Compact translucent pill when pointed at Development or Local API. */
export const NonProdEnvBanner = observer(function NonProdEnvBanner() {
  const env = useRuntimeEnv();
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth, persona } = useStore();

  if (!isNonProdEnv(env)) return null;

  const label =
    env === 'local'
      ? t('about.developer.bannerLocal', 'LOCAL API')
      : t('about.developer.bannerDev', 'DEVELOPMENT');

  const agentChromeVisible =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'agent';
  const top =
    insets.top + 8 + (agentChromeVisible ? AGENT_STATUS_BAR_CLEARANCE : 0);

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top, right: Math.max(insets.right, 16) }]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: 'rgba(245, 158, 11, 0.72)',
            borderColor: 'rgba(217, 119, 6, 0.45)',
            borderRadius: borderRadius.full ?? 999,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 100,
    alignItems: 'flex-end',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
