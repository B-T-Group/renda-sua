import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CommonActions } from '@react-navigation/native';
import { Appbar, Button, RadioButton, Switch, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiUrlForEnv } from '../../config/auth0';
import { persistRuntimeEnv, type EnvName } from '../../config/envSwitch';
import {
  hydrateFirstOrderDebug,
  isFirstOrderGuidanceForced,
  persistFirstOrderGuidanceForced,
  registerFirstOrderDebugListener,
} from '../../config/firstOrderDebug';
import { useTheme } from '../../contexts/ThemeContext';
import { useRuntimeEnv } from '../../hooks/useRuntimeEnv';
import type { AuthStackParamList } from '../../navigation/types';
import { useStore } from '../../stores/RootStore';
import { resetAllFirstOrderPins } from '../../utils/firstOrderJourneyStorage';

type Props = NativeStackScreenProps<AuthStackParamList, 'DeveloperOptions'>;

const ENV_OPTIONS: EnvName[] = ['prod', 'dev', 'local'];

function envLabelKey(env: EnvName): string {
  if (env === 'prod') return 'about.developer.envProd';
  if (env === 'dev') return 'about.developer.envDev';
  return 'about.developer.envLocal';
}

function envLabelDefault(env: EnvName): string {
  if (env === 'prod') return 'Production';
  if (env === 'dev') return 'Development';
  return 'Local API';
}

export default function DeveloperOptionsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const activeEnv = useRuntimeEnv();
  const { savedAccounts, ftue } = useStore();
  const [selected, setSelected] = useState<EnvName>(activeEnv);
  const [saving, setSaving] = useState(false);
  const [ftueResetMsg, setFtueResetMsg] = useState<string | null>(null);
  const [forceFirstOrder, setForceFirstOrder] = useState(
    isFirstOrderGuidanceForced()
  );
  const [firstOrderResetMsg, setFirstOrderResetMsg] = useState<string | null>(
    null
  );

  useEffect(() => {
    setSelected(activeEnv);
  }, [activeEnv]);

  useEffect(() => {
    void hydrateFirstOrderDebug().then(() => {
      setForceFirstOrder(isFirstOrderGuidanceForced());
    });
    return registerFirstOrderDebugListener(() => {
      setForceFirstOrder(isFirstOrderGuidanceForced());
    });
  }, []);

  const apiUrl = useMemo(() => getApiUrlForEnv(selected), [selected]);
  const dirty = selected !== activeEnv;

  const onSwitch = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await persistRuntimeEnv(selected);
      await savedAccounts.hydrate();
      const routeName = savedAccounts.shouldShowContinueAs ? 'SavedAccounts' : 'Login';
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: routeName, params: routeName === 'SavedAccounts' ? { mode: 'continue' } : undefined }],
        })
      );
    } finally {
      setSaving(false);
    }
  }, [dirty, navigation, savedAccounts, selected]);

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
      <Appbar.Header
        style={{ backgroundColor: colors.surface }}
        statusBarHeight={0}
      >
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('about.developer.title', 'Developer Options')} />
      </Appbar.Header>

      <View style={[styles.body, { padding: spacing.lg }]}>
        <Text variant="titleSmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
          {t('about.developer.environment', 'Environment')}
        </Text>
        <RadioButton.Group
          value={selected}
          onValueChange={(value) => setSelected(value as EnvName)}
        >
          {ENV_OPTIONS.map((env) => (
            <RadioButton.Item
              key={env}
              label={t(envLabelKey(env), envLabelDefault(env))}
              value={env}
              position="leading"
              labelStyle={{ color: colors.text.primary }}
            />
          ))}
        </RadioButton.Group>

        <Text
          variant="titleSmall"
          style={{ color: colors.text.secondary, marginTop: spacing.lg, marginBottom: spacing.xs }}
        >
          {t('about.developer.api', 'API')}
        </Text>
        <Text variant="bodyMedium" selectable style={{ color: colors.text.primary }}>
          {apiUrl}
        </Text>

        <Button
          mode="contained"
          style={styles.switchButton}
          loading={saving}
          disabled={!dirty || saving}
          onPress={() => void onSwitch()}
        >
          {t('about.developer.switch', 'Switch Environment')}
        </Button>

        <Text
          variant="titleSmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xl, marginBottom: spacing.xs }}
        >
          {t('about.developer.ftue', 'First-time experience')}
        </Text>
        <Button
          mode="outlined"
          onPress={() => {
            void ftue.reset().then(() => {
              setFtueResetMsg(
                t(
                  'ftue.dev.resetFtueDone',
                  'FTUE reset. Restart the app to see onboarding.'
                )
              );
            });
          }}
        >
          {t('ftue.dev.resetFtue', 'Reset FTUE / onboarding')}
        </Button>
        {ftueResetMsg ? (
          <Text variant="bodySmall" style={{ color: colors.success.main, marginTop: spacing.sm }}>
            {ftueResetMsg}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyLarge" style={{ color: colors.text.primary }}>
              {t(
                'about.developer.forceFirstOrder',
                'Always show first-order guidance'
              )}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
              {t(
                'about.developer.forceFirstOrderHint',
                'Shows the first-order journey card on any business or client order on this device only.'
              )}
            </Text>
          </View>
          <Switch
            value={forceFirstOrder}
            onValueChange={(value) => {
              setForceFirstOrder(value);
              void persistFirstOrderGuidanceForced(value);
            }}
          />
        </View>

        <Button
          mode="outlined"
          style={{ marginTop: spacing.md }}
          onPress={() => {
            void resetAllFirstOrderPins().then(() => {
              setFirstOrderResetMsg(
                t(
                  'about.developer.resetFirstOrderDone',
                  'First-order pin cleared. The next eligible order will teach again.'
                )
              );
            });
          }}
        >
          {t('about.developer.resetFirstOrder', 'Reset first-order guidance')}
        </Button>
        {firstOrderResetMsg ? (
          <Text variant="bodySmall" style={{ color: colors.success.main, marginTop: spacing.sm }}>
            {firstOrderResetMsg}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  switchButton: { marginTop: 28 },
});
