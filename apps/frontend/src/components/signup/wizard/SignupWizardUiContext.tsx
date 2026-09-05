import React, { createContext, useContext } from 'react';
import type { CountryOnboardingUi } from './types';

export interface SignupWizardUiContextValue {
  countries: CountryOnboardingUi[];
  countriesLoading: boolean;
  postalCodeRequired: boolean;
  signupCountryCodes: string[];
  onLoginInstead: () => void;
  emailTaken: boolean;
  setEmailTaken: (taken: boolean) => void;
  ownSignupEmail: string | null;
}

const SignupWizardUiContext = createContext<SignupWizardUiContextValue>({
  countries: [],
  countriesLoading: false,
  postalCodeRequired: false,
  signupCountryCodes: [],
  onLoginInstead: () => undefined,
  emailTaken: false,
  setEmailTaken: () => undefined,
  ownSignupEmail: null,
});

export const SignupWizardUiProvider: React.FC<{
  value: SignupWizardUiContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <SignupWizardUiContext.Provider value={value}>
    {children}
  </SignupWizardUiContext.Provider>
);

export function useSignupWizardUi(): SignupWizardUiContextValue {
  return useContext(SignupWizardUiContext);
}
