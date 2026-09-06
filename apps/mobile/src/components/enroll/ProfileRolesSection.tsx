import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { PERSONA_ACCENT } from '@/constants/personaTheme';
import type { PersonaSlug } from '@/types/persona';
import { missingPersonas, orderedSupportedAppPersonas } from '@/utils/personaFromMe';
import { useEnrollPersonaNav } from '@/hooks/useEnrollPersonaNav';
import { MissingPersonaCard } from './MissingPersonaCard';
import {
  ENROLL_PERSONA_ICONS,
  personaLabelDefault,
  personaLabelKey,
} from './personaEnrollUi';

function switchCtaKey(p: PersonaSlug): string {
  if (p === 'agent') return 'persona.switchToAgentCta';
  if (p === 'business') return 'persona.switchToBusinessCta';
  return 'persona.switchToClientCta';
}

function switchCtaDefault(p: PersonaSlug): string {
  if (p === 'agent') return 'Switch to agent';
  if (p === 'business') return 'Switch to business';
  return 'Switch to client';
}

function ProfileRolesSectionBase() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, shadows } = useTheme();
  const { persona } = useStore();
  const { goToExplain } = useEnrollPersonaNav();

  const enrolled = orderedSupportedAppPersonas(persona.personas);
  const missing = missingPersonas(enrolled);
  const switchTargets = enrolled.filter((p) => p !== persona.activePersona);
  const busy = persona.pickingPersona !== null || persona.enrollingPersona !== null;

  if (enrolled.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }, shadows.sm]}>
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '600', marginBottom: 4 }}>
        {t('profile.rolesTitle', 'Account roles')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 16 }}>
        {t('profile.rolesHint', 'One login — add roles anytime and switch between them.')}
      </Text>

      <Text variant="labelMedium" style={{ color: colors.text.secondary, marginBottom: 8 }}>
        {t('profile.enrolledAs', 'Enrolled as')}
      </Text>
      <View style={styles.badgeRow}>
        {enrolled.map((p) => {
          const active = p === persona.activePersona;
          const accent = PERSONA_ACCENT[p];
          return (
            <View
              key={p}
              style={[
                styles.badge,
                {
                  borderColor: active ? accent : colors.divider,
                  backgroundColor: active ? accent + '18' : colors.pageBackground,
                },
              ]}
            >
              <MaterialCommunityIcons name={ENROLL_PERSONA_ICONS[p]} size={16} color={accent} />
              <Text variant="labelMedium" style={{ color: colors.text.primary }}>
                {t(personaLabelKey(p), personaLabelDefault(p))}
              </Text>
              {active ? (
                <Text variant="labelSmall" style={{ color: accent }}>
                  {t('profile.rolesActive', 'Active')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {switchTargets.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text variant="labelMedium" style={{ color: colors.text.secondary, marginBottom: 8 }}>
            {t('profile.rolesSwitch', 'Switch role')}
          </Text>
          {switchTargets.map((p) => {
            const accent = PERSONA_ACCENT[p];
            const selecting = persona.pickingPersona === p;
            return (
              <Pressable
                key={p}
                onPress={() => void persona.selectPersona(p)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.switchRow,
                  {
                    borderColor: colors.divider,
                    borderLeftColor: accent,
                    opacity: pressed ? 0.92 : busy && !selecting ? 0.55 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons name={ENROLL_PERSONA_ICONS[p]} size={20} color={accent} />
                <Text style={[typography.body2, { flex: 1, color: colors.text.primary }]} numberOfLines={2}>
                  {t(switchCtaKey(p), switchCtaDefault(p))}
                </Text>
                {selecting ? (
                  <ActivityIndicator size="small" color={colors.primary.main} />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.disabled} />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {missing.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text variant="labelMedium" style={{ color: colors.text.secondary, marginBottom: 8 }}>
            {t('enrollPersona.addRoleSection', 'Add a role')}
          </Text>
          {missing.map((p) => (
            <MissingPersonaCard
              key={p}
              persona={p}
              loading={persona.enrollingPersona === p}
              disabled={busy}
              onPress={() => goToExplain(p)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const ProfileRolesSection = observer(ProfileRolesSectionBase);

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
});
