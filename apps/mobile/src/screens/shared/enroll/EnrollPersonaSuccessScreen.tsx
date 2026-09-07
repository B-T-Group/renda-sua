import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Banner, Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { PERSONA_ACCENT } from '@/constants/personaTheme';
import type { EnrollStackParamList } from '@/navigation/types';
import type { PersonaSlug } from '@/types/persona';
import { dismissEnrollFlow } from '@/utils/dismissEnrollFlow';
import { resetToPersonaDashboardWhenReady } from '@/navigation/rootNavigationRef';
import {
  ENROLL_PERSONA_ICONS,
  personaLabelDefault,
  personaLabelKey,
} from '@/components/enroll/personaEnrollUi';

type Props = NativeStackScreenProps<EnrollStackParamList, 'EnrollPersonaSuccess'>;

function successTipKey(p: PersonaSlug): string {
  if (p === 'agent') return 'enrollPersona.success.tips.agent';
  if (p === 'business') return 'enrollPersona.success.tips.business';
  return 'enrollPersona.success.tips.client';
}

function successTipDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Upload your ID in Documents, then start claiming deliveries.';
  if (p === 'business') return 'Add your first products and complete verification to go live.';
  return 'Browse nearby stores and place your first order.';
}

function EnrollPersonaSuccessScreenBase({ navigation, route }: Props) {
  const { targetPersona } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const { persona } = useStore();
  const accent = PERSONA_ACCENT[targetPersona];
  const switching = persona.pickingPersona === targetPersona;
  const currentLabel = t(personaLabelKey(persona.activePersona), personaLabelDefault(persona.activePersona));
  const newLabel = t(personaLabelKey(targetPersona), personaLabelDefault(targetPersona));

  const dismissStack = useCallback(() => {
    dismissEnrollFlow(navigation);
  }, [navigation]);

  const handleSwitch = useCallback(async () => {
    await persona.selectPersona(targetPersona);
    resetToPersonaDashboardWhenReady(targetPersona);
  }, [persona, targetPersona]);

  const handleStay = useCallback(() => {
    // enrollPersona already refreshed personas[]; dismiss without blocking on a redundant getMe.
    dismissStack();
  }, [dismissStack]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View style={[styles.hero, { backgroundColor: accent + '18', borderRadius: borderRadius.xl }]}>
        <MaterialCommunityIcons name="check-circle" size={64} color={accent} />
      </View>

      <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
        {t('enrollPersona.success.title', 'Role added!')}
      </Text>
      <Text variant="bodyLarge" style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: 20 }}>
        {t('enrollPersona.success.body', 'You can now use Rendasua as {{role}}.', { role: newLabel })}
      </Text>

      <View style={[styles.personaRow, { borderColor: colors.divider }]}>
        <MaterialCommunityIcons name={ENROLL_PERSONA_ICONS[targetPersona]} size={28} color={accent} />
        <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '600' }}>
          {newLabel}
        </Text>
      </View>

      <Banner visible icon="lightbulb-on-outline" style={{ marginTop: 20 }}>
        {t(successTipKey(targetPersona), successTipDefault(targetPersona))}
      </Banner>

      <View style={styles.actions}>
        <Button mode="contained" onPress={() => void handleSwitch()} loading={switching} disabled={switching}>
          {t('enrollPersona.success.switchCta', 'Switch to {{role}}', { role: newLabel })}
        </Button>
        <Button mode="outlined" onPress={handleStay} disabled={switching} style={{ marginTop: 10 }}>
          {t('enrollPersona.success.stayCta', 'Stay in {{role}}', { role: currentLabel })}
        </Button>
      </View>
    </View>
  );
}

export const EnrollPersonaSuccessScreen = observer(EnrollPersonaSuccessScreenBase);

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 24, marginBottom: 24 },
  title: { fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  actions: { width: '100%', marginTop: 32 },
});
