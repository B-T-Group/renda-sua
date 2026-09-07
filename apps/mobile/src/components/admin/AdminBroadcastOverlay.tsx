import React, { useCallback, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { rootNavigationRef } from '../../navigation/rootNavigationRef';
import { openAppStore } from '../../utils/openAppStore';
import type { BroadcastActionType } from '../../types/adminBroadcast';

function localizedCopy(
  payload: {
    title?: string;
    body?: string;
    titleEn?: string;
    bodyEn?: string;
    titleFr?: string;
    bodyFr?: string;
  },
  isFr: boolean
): { title: string; body: string } {
  if (isFr) {
    return {
      title: payload.titleFr || payload.title || payload.titleEn || 'Rendasua',
      body: payload.bodyFr || payload.body || payload.bodyEn || '',
    };
  }
  return {
    title: payload.titleEn || payload.title || payload.titleFr || 'Rendasua',
    body: payload.bodyEn || payload.body || payload.bodyFr || '',
  };
}

function explainForAction(
  action: BroadcastActionType,
  t: (key: string, fallback: string) => string
): string {
  if (action === 'app_upgrade') {
    return t(
      'admin.broadcasts.recipient.upgradeExplain',
      'Updating keeps you secure and unlocks the newest Rendasua features.'
    );
  }
  if (action === 'business_account_setup') {
    return t(
      'admin.broadcasts.recipient.setupExplain',
      'Finish Stripe payout setup so customers can pay you and you can start receiving orders.'
    );
  }
  return '';
}

function AdminBroadcastOverlayBase() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { adminBroadcast, persona } = useStore();

  const payload = adminBroadcast.payload;
  const isFr = i18n.language?.startsWith('fr') ?? false;
  const copy = useMemo(
    () => (payload ? localizedCopy(payload, isFr) : { title: '', body: '' }),
    [payload, isFr]
  );
  const explain = payload ? explainForAction(payload.actionType, t) : '';

  const onPrimary = useCallback(async () => {
    if (!payload) return;
    if (payload.actionType === 'app_upgrade') {
      await openAppStore();
      return;
    }
    if (payload.actionType === 'business_account_setup') {
      adminBroadcast.dismiss();
      if (!persona.personas.includes('business')) return;
      try {
        if (persona.activePersona !== 'business') {
          await persona.selectPersona('business');
        }
        if (rootNavigationRef.isReady()) {
          rootNavigationRef.dispatch(
            CommonActions.navigate({ name: 'BusinessConfigurePayments' })
          );
        }
      } catch {
        // Persona switch failed — overlay already dismissed.
      }
      return;
    }
    adminBroadcast.dismiss();
  }, [payload, adminBroadcast, persona]);

  if (!payload) return null;

  const showSetupCta =
    payload.actionType === 'business_account_setup' &&
    persona.personas.includes('business');
  const primaryLabel =
    payload.actionType === 'app_upgrade'
      ? t('admin.broadcasts.recipient.updateApp', 'Update app')
      : showSetupCta
        ? t('admin.broadcasts.recipient.finishSetup', 'Finish payment setup')
        : t('common.close', 'Close');

  return (
    <Modal
      visible={adminBroadcast.visible}
      transparent
      animationType="fade"
      onRequestClose={() => adminBroadcast.dismiss()}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={() => adminBroadcast.dismiss()}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: height * 0.8,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[typography.h6, { color: colors.text.primary, marginBottom: spacing.sm }]}
          >
            {copy.title}
          </Text>
          <ScrollView style={{ maxHeight: height * 0.45 }}>
            <Text style={[typography.body1, { color: colors.text.primary }]}>
              {copy.body}
            </Text>
            {explain ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.text.secondary, marginTop: spacing.md },
                ]}
              >
                {explain}
              </Text>
            ) : null}
          </ScrollView>
          <View style={[styles.actions, { marginTop: spacing.lg, gap: spacing.sm }]}>
            {payload.actionType !== 'generic' || showSetupCta ? (
              <Button mode="contained" onPress={() => void onPrimary()}>
                {primaryLabel}
              </Button>
            ) : null}
            <Button mode="text" onPress={() => adminBroadcast.dismiss()}>
              {t('common.close', 'Close')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    padding: 20,
  },
  actions: {
    flexDirection: 'column',
  },
});

export const AdminBroadcastOverlay = observer(AdminBroadcastOverlayBase);
