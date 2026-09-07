import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { PERSONA_ACCENT } from '../../constants/personaTheme';
import type { PersonaSlug } from '../../types/persona';
import { orderedSupportedAppPersonas } from '../../utils/personaFromMe';
import { PersonaBenefitBullets } from '../../components/signup/PersonaBenefitBullets';
import { benefitPersonaFromSignupPersona } from '../../constants/signupBenefits';

type PickerPersona = 'client' | 'agent' | 'business';

const PERSONA_ICONS: Record<
  PickerPersona,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  client: 'account-circle-outline',
  agent: 'bike-fast',
  business: 'store-outline',
};

function PersonaLoadingView() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.centered,
        { backgroundColor: colors.pageBackground, paddingTop: insets.top + 24 },
      ]}
    >
      <ActivityIndicator size="large" color={colors.primary.main} />
      <Text
        style={[
          typography.h6,
          { color: colors.text.primary, marginTop: 24, textAlign: 'center' },
        ]}
      >
        {t('persona.selectLoading', 'Loading your account')}
      </Text>
      <Text
        style={[
          typography.body2,
          { color: colors.text.secondary, marginTop: 8, textAlign: 'center' },
        ]}
      >
        {t('persona.selectLoadingSubtitle', 'Please wait')}
      </Text>
    </View>
  );
}

function PersonaErrorView({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const { auth, persona } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.centered,
        { backgroundColor: colors.pageBackground, paddingTop: insets.top + 24 },
      ]}
    >
      <Text
        style={[
          typography.h5,
          { color: colors.text.primary, textAlign: 'center', marginBottom: 12 },
        ]}
      >
        {t('persona.loadErrorTitle', 'Couldn’t load your account')}
      </Text>
      <Text
        style={[
          typography.body2,
          { color: colors.text.secondary, textAlign: 'center', marginBottom: 8 },
        ]}
      >
        {t('persona.loadErrorBody', 'Check your connection and try again.')}
      </Text>
      {!!persona.loadError && (
        <Text
          style={[
            typography.caption,
            { color: '#c62828', textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
          ]}
          selectable
        >
          {persona.loadError}
        </Text>
      )}
      {!persona.loadError && <View style={{ marginBottom: 20 }} />}
      <Pressable
        onPress={onRetry}
        style={[
          styles.primaryBtn,
          { backgroundColor: colors.primary.main, borderRadius: borderRadius.md },
        ]}
      >
        <Text style={[typography.button, { color: colors.primary.contrast }]}>
          {t('common.retry', 'Retry')}
        </Text>
      </Pressable>
      <Pressable onPress={() => void auth.logout()} style={styles.secondaryPress}>
        <Text style={[typography.body2, { color: colors.text.secondary }]}>
          {t('persona.logout', 'Log out')}
        </Text>
      </Pressable>
    </View>
  );
}

function PersonaNoAgentView() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const { auth } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.centered,
        { backgroundColor: colors.pageBackground, paddingTop: insets.top + 24 },
      ]}
    >
      <MaterialCommunityIcons
        name="account-alert-outline"
        size={56}
        color={colors.warning.main}
      />
      <Text
        style={[
          typography.h5,
          { color: colors.text.primary, textAlign: 'center', marginTop: 20 },
        ]}
      >
        {t('persona.noAgentTitle', 'This account can’t use the mobile app')}
      </Text>
      <Text
        style={[
          typography.body2,
          {
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: 12,
            paddingHorizontal: 24,
          },
        ]}
      >
        {t(
          'persona.noSupportedPersonaBody',
          'This account has no roles enabled for the mobile app. Contact support or sign in with a different account.'
        )}
      </Text>
      <Pressable
        onPress={() => void auth.logout()}
        style={[
          styles.primaryBtn,
          {
            backgroundColor: colors.primary.main,
            borderRadius: borderRadius.md,
            marginTop: 28,
          },
        ]}
      >
        <Text style={[typography.button, { color: colors.primary.contrast }]}>
          {t('persona.logout', 'Log out')}
        </Text>
      </Pressable>
    </View>
  );
}

function personaTitleKey(p: PickerPersona): string {
  if (p === 'client') return 'persona.clientTitle';
  if (p === 'agent') return 'persona.agentTitle';
  return 'persona.businessTitle';
}

type PersonaPickerCardProps = {
  persona: PickerPersona;
  title: string;
  selecting: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function PersonaPickerCard({
  persona,
  title,
  selecting,
  disabled,
  onSelect,
}: PersonaPickerCardProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, shadows } = useTheme();
  const accent = PERSONA_ACCENT[persona];
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selecting ? 0.98 : 1,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: disabled && !selecting ? 0.42 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selecting, disabled, scale, dim]);

  const animatePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const animatePressOut = () => {
    if (selecting) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale }], opacity: dim, marginBottom: 16 },
        selecting ? shadows.md : shadows.sm,
      ]}
    >
      <Pressable
        onPress={onSelect}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ busy: selecting, disabled }}
        accessibilityLabel={t('persona.selectCardCta', 'Continue as {{label}}', {
          label: title,
        })}
        style={[
          styles.card,
          {
            borderColor: selecting ? accent : colors.border,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderLeftWidth: 4,
            borderLeftColor: accent,
          },
        ]}
      >
        <View style={styles.cardRow}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: accent + '14', borderRadius: borderRadius.full },
            ]}
          >
            {selecting ? (
              <ActivityIndicator color={accent} size="small" />
            ) : (
              <MaterialCommunityIcons
                name={PERSONA_ICONS[persona]}
                size={28}
                color={accent}
              />
            )}
          </View>
          <View style={styles.cardTextCol}>
            <Text style={[typography.subtitle1, { color: colors.text.primary }]}>{title}</Text>
            <View style={{ marginTop: 8 }}>
              <PersonaBenefitBullets
                persona={benefitPersonaFromSignupPersona(persona)}
                compact
              />
            </View>
          </View>
        </View>

        <View style={[styles.ctaRow, { marginTop: 16 }]}>
          {selecting ? (
            <Text style={[typography.button, { color: accent }]}>
              {t('persona.selectOpening', 'Opening {{label}}…', { label: title })}
            </Text>
          ) : (
            <Text style={[typography.button, { color: colors.primary.main }]}>
              {t('persona.selectCardCta', 'Continue as {{label}}', { label: title })}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function PersonaPickerView() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, shadows } = useTheme();
  const { persona } = useStore();
  const insets = useSafeAreaInsets();
  const list = orderedSupportedAppPersonas(persona.personas) as PickerPersona[];
  const busy = persona.pickingPersona !== null || persona.pickingDelegationId !== null;
  const titleDefaults: Record<PickerPersona, string> = {
    client: 'Client',
    agent: 'Agent',
    business: 'Business',
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
        maxWidth: 440,
        width: '100%',
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!busy}
    >
      <Text
        style={[
          typography.overline,
          { color: colors.text.secondary, textAlign: 'center', letterSpacing: 1.2 },
        ]}
      >
        {t('persona.selectKicker', 'Welcome back')}
      </Text>
      <Text
        style={[typography.h4, { color: colors.text.primary, textAlign: 'center', marginTop: 8 }]}
      >
        {t('persona.selectTitle', 'How do you want to use Rendasua?')}
      </Text>
      <Text
        style={[
          typography.body2,
          {
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: 12,
            marginBottom: 28,
          },
        ]}
      >
        {t(
          'persona.selectSubtitle',
          'Choose what you want to do today. You can switch anytime from your profile or the header on the website.'
        )}
      </Text>

      {list.map((p) => {
        const title = t(personaTitleKey(p), titleDefaults[p]);
        const selecting = persona.pickingPersona === p;
        return (
          <PersonaPickerCard
            key={p}
            persona={p}
            title={title}
            selecting={selecting}
            disabled={busy}
            onSelect={() => void persona.selectPersona(p as PersonaSlug)}
          />
        );
      })}

      {persona.delegations.length > 0 ? (
        <>
          <Text
            style={[
              typography.overline,
              {
                color: colors.text.secondary,
                marginTop: list.length > 0 ? 8 : 0,
                marginBottom: 12,
                letterSpacing: 0.8,
              },
            ]}
          >
            {t('delegation.locationsSection', 'Locations you manage')}
          </Text>
          {persona.delegations.map((d) => {
            const selecting = persona.pickingDelegationId === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => void persona.selectDelegation(d.id)}
                disabled={busy}
                accessibilityRole="button"
                style={[
                  styles.card,
                  shadows.sm,
                  {
                    borderColor: selecting ? PERSONA_ACCENT.business : colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    borderLeftWidth: 4,
                    borderLeftColor: PERSONA_ACCENT.business,
                    marginBottom: 16,
                    opacity: busy && !selecting ? 0.42 : 1,
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: PERSONA_ACCENT.business + '14',
                        borderRadius: borderRadius.full,
                      },
                    ]}
                  >
                    {selecting ? (
                      <ActivityIndicator color={PERSONA_ACCENT.business} size="small" />
                    ) : (
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={28}
                        color={PERSONA_ACCENT.business}
                      />
                    )}
                  </View>
                  <View style={styles.cardTextCol}>
                    <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
                      {d.locationName}
                    </Text>
                    <Text
                      style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}
                      numberOfLines={2}
                    >
                      {d.businessName}
                      {d.role?.name ? ` · ${d.role.name}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={[styles.ctaRow, { marginTop: 16 }]}>
                  <Text style={[typography.button, { color: colors.primary.main }]}>
                    {selecting
                      ? t('delegation.openingLocation', 'Opening {{location}}…', {
                          location: d.locationName,
                        })
                      : t('delegation.continueAsLocation', 'Continue at {{location}}', {
                          location: d.locationName,
                        })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

function PersonaSessionRouter() {
  const { persona } = useStore();
  if (persona.showPersonaLoading) return <PersonaLoadingView />;
  if (persona.showPersonaError) {
    return <PersonaErrorView onRetry={() => void persona.retryAfterError()} />;
  }
  if (persona.showNoAgent) return <PersonaNoAgentView />;
  if (persona.showPersonaPicker) return <PersonaPickerView />;
  return <PersonaLoadingView />;
}

export default observer(PersonaSessionRouter);

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  primaryBtn: {
    minWidth: 200,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryPress: {
    marginTop: 20,
    padding: 12,
  },
  card: {
    padding: 18,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },
  ctaRow: {
    alignItems: 'flex-end',
    minHeight: 28,
    justifyContent: 'center',
  },
});
