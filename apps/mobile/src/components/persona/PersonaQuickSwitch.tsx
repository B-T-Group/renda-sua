import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { PERSONA_ACCENT } from '../../constants/personaTheme';
import type { PersonaSlug } from '../../types/persona';
import type { DelegationGrant } from '../../types/delegation';
import { missingPersonas, orderedSupportedAppPersonas } from '../../utils/personaFromMe';
import { useEnrollPersonaNav } from '../../hooks/useEnrollPersonaNav';
import { MissingPersonaCard } from '../enroll/MissingPersonaCard';

type Switchable = PersonaSlug;

const PERSONA_ICONS: Record<Switchable, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  client: 'account-circle-outline',
  agent: 'bike-fast',
  business: 'store-outline',
};

function switchCtaKey(p: Switchable): string {
  if (p === 'agent') return 'persona.switchToAgentCta';
  if (p === 'business') return 'persona.switchToBusinessCta';
  return 'persona.switchToClientCta';
}

function switchCtaDefault(p: Switchable): string {
  if (p === 'agent') return 'Switch to agent';
  if (p === 'business') return 'Switch to business';
  return 'Switch to client';
}

function PersonaQuickSwitchBase() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const { persona } = useStore();
  const { goToExplain } = useEnrollPersonaNav();
  const busy =
    persona.pickingPersona !== null ||
    persona.pickingDelegationId !== null ||
    persona.enrollingPersona !== null;

  const enrolled = orderedSupportedAppPersonas(persona.personas);
  const missing = missingPersonas(enrolled);
  const activeDelegationId =
    persona.activeContext?.kind === 'delegation'
      ? persona.activeContext.delegationId
      : null;
  const personaTargets = enrolled.filter((p) => {
    if (persona.isDelegationContext) return true;
    return p !== persona.activePersona;
  });
  const delegationTargets = persona.delegations.filter((d) => d.id !== activeDelegationId);
  const showPersonaSwitch = personaTargets.length > 0 && enrolled.length + persona.delegations.length > 1;
  const showDelegationSwitch = delegationTargets.length > 0;
  const showSwitch = showPersonaSwitch || showDelegationSwitch;

  if (!showSwitch && missing.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {showSwitch ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }, typography.overline]}>
            {t('menuTab.switchPersonaSection', { defaultValue: 'Switch mode' })}
          </Text>
          {showPersonaSwitch
            ? personaTargets.map((p) => {
                const accent = PERSONA_ACCENT[p];
                const selecting = persona.pickingPersona === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => void persona.selectPersona(p)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: colors.surface,
                        borderRadius: borderRadius.lg,
                        borderColor: colors.divider,
                        borderLeftWidth: 4,
                        borderLeftColor: accent,
                        opacity: pressed ? 0.92 : busy && !selecting ? 0.55 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name={PERSONA_ICONS[p]} size={22} color={accent} />
                    <View style={styles.textCol}>
                      <Text
                        style={[typography.subtitle2, { color: colors.text.primary }]}
                        numberOfLines={2}
                      >
                        {t(switchCtaKey(p), switchCtaDefault(p))}
                      </Text>
                    </View>
                    {selecting ? (
                      <ActivityIndicator size="small" color={colors.primary.main} />
                    ) : (
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={colors.text.disabled}
                      />
                    )}
                  </Pressable>
                );
              })
            : null}
          {delegationTargets.map((d) => (
            <DelegationSwitchRow
              key={d.id}
              grant={d}
              busy={busy}
              selecting={persona.pickingDelegationId === d.id}
              onSelect={() => void persona.selectDelegation(d.id)}
            />
          ))}
        </>
      ) : null}

      {missing.length > 0 && !persona.isDelegationContext ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text.secondary, marginTop: showSwitch ? 8 : 0 },
              typography.overline,
            ]}
          >
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
        </>
      ) : null}
    </View>
  );
}

function DelegationSwitchRow({
  grant,
  busy,
  selecting,
  onSelect,
}: {
  grant: DelegationGrant;
  busy: boolean;
  selecting: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const accent = PERSONA_ACCENT.business;

  return (
    <Pressable
      onPress={onSelect}
      disabled={busy}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderColor: colors.divider,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          opacity: pressed ? 0.92 : busy && !selecting ? 0.55 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name="map-marker-outline" size={22} color={accent} />
      <View style={styles.textCol}>
        <Text style={[typography.subtitle2, { color: colors.text.primary }]} numberOfLines={2}>
          {t('delegation.switchToLocation', 'Manage {{location}}', {
            location: grant.locationName,
          })}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary }]} numberOfLines={1}>
          {grant.businessName}
          {grant.role?.name ? ` · ${grant.role.name}` : ''}
        </Text>
      </View>
      {selecting ? (
        <ActivityIndicator size="small" color={colors.primary.main} />
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.disabled} />
      )}
    </Pressable>
  );
}

export const PersonaQuickSwitch = observer(PersonaQuickSwitchBase);

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  sectionTitle: {
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  textCol: { flex: 1, minWidth: 0 },
});
