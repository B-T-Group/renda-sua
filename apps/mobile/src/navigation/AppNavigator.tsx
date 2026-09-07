import React, { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { View, StyleSheet } from 'react-native';
import { useStore } from '../stores/RootStore';

import PersonaSessionGate from '../screens/shared/PersonaSessionGate';
import SignupSuccessScreen from '../screens/shared/SignupSuccessScreen';
import FirstRunOnboardingScreen from '../screens/shared/onboarding/FirstRunOnboardingScreen';
import type { OnboardingFinishResult } from '../screens/shared/onboarding/useFirstRunOnboarding';
import { NonProdEnvBanner } from '../components/common/NonProdEnvBanner';
import { EnableBiometricSheet } from '../components/auth/EnableBiometricSheet';
import { GuestRootNavigator } from './GuestRootNavigator';
import { AgentRootNavigator, type AgentAppNavScreen } from './AgentRootNavigator';
import { ClientRootNavigator, type ClientAppNavScreen } from './ClientRootNavigator';
import { BusinessRootNavigator, type BusinessAppNavScreen } from './BusinessRootNavigator';
import { DelegateRootNavigator, type DelegateAppNavScreen } from './DelegateRootNavigator';
import SessionService from '../services/session/SessionService';
import type { AuthStackParamList } from './types';

export type AppNavScreen =
  | AgentAppNavScreen
  | ClientAppNavScreen
  | BusinessAppNavScreen
  | DelegateAppNavScreen;

type GuestLaunch = {
  preferBrowse: boolean;
  initialAuthRoute?: keyof AuthStackParamList;
  initialSignupParams?: AuthStackParamList['Signup'];
};

function AppNavigatorContent() {
  const { auth, persona, savedAccounts, ftue } = useStore();
  const [enablingBio, setEnablingBio] = useState(false);
  const [guestLaunch, setGuestLaunch] = useState<GuestLaunch | null>(null);

  useEffect(() => {
    if (auth.isAuthenticated) {
      setGuestLaunch(null);
      void persona.ensureSession();
      void ftue.markCompletedIfNeeded();
    }
  }, [auth.isAuthenticated, auth.user?.id, persona, ftue]);

  const handleEnableBiometric = useCallback(async () => {
    setEnablingBio(true);
    await SessionService.enableBiometricsForActiveAccount();
    setEnablingBio(false);
  }, []);

  const handleDismissBiometric = useCallback(() => {
    SessionService.dismissBiometricPrompt();
  }, []);

  const handleOnboardingFinished = useCallback((result: OnboardingFinishResult) => {
    if (result.intent === 'sell') {
      setGuestLaunch({
        preferBrowse: false,
        initialAuthRoute: 'Signup',
        initialSignupParams: {
          preselectedPersona: 'business',
          source: 'onboarding',
        },
      });
      return;
    }
    if (result.intent === 'deliver') {
      setGuestLaunch({
        preferBrowse: false,
        initialAuthRoute: 'Signup',
        initialSignupParams: {
          preselectedPersona: 'agent',
          source: 'onboarding',
        },
      });
      return;
    }
    setGuestLaunch({ preferBrowse: true });
  }, []);

  if (!auth.isAuthenticated) {
    // FTUE first (including upgrades), even when Continue-as accounts exist.
    if (!guestLaunch && ftue.shouldShowOnboarding) {
      return <FirstRunOnboardingScreen onFinished={handleOnboardingFinished} />;
    }

    if (guestLaunch) {
      return (
        <GuestRootNavigator
          preferBrowse={guestLaunch.preferBrowse}
          initialAuthRoute={guestLaunch.initialAuthRoute}
          initialSignupParams={guestLaunch.initialSignupParams}
        />
      );
    }

    // Returning guests / post-FTUE: Continue-as when available, else browse-first.
    if (!savedAccounts.shouldShowContinueAs) {
      return <GuestRootNavigator preferBrowse />;
    }

    const initialAuthRoute = 'SavedAccounts' as const;
    return <GuestRootNavigator initialAuthRoute={initialAuthRoute} />;
  }

  const mainContent = (() => {
    if (auth.signupWelcomePending) {
      return <SignupSuccessScreen />;
    }
    if (!persona.showMainApp) {
      return <PersonaSessionGate />;
    }
    const personaKey = persona.activePersona;
    if (persona.isDelegationContext) {
      const delId =
        persona.activeContext?.kind === 'delegation'
          ? persona.activeContext.delegationId
          : 'delegation';
      return <DelegateRootNavigator key={`delegation-${delId}`} />;
    }
    if (persona.activePersona === 'client') {
      return <ClientRootNavigator key={personaKey} />;
    }
    if (persona.activePersona === 'business') {
      return <BusinessRootNavigator key={personaKey} />;
    }
    return <AgentRootNavigator key={personaKey} />;
  })();

  return (
    <>
      {mainContent}
      <EnableBiometricSheet
        visible={auth.biometricPromptPending && auth.isAuthenticated}
        onEnable={() => void handleEnableBiometric()}
        onDismiss={handleDismissBiometric}
        loading={enablingBio}
      />
    </>
  );
}

const Observed = observer(AppNavigatorContent);

export default function AppNavigator() {
  return (
    <View style={styles.wrapper}>
      <NonProdEnvBanner />
      <Observed />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
