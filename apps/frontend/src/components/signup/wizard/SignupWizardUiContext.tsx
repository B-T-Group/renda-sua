import React, { createContext, useContext } from 'react';
import type { CountryOnboardingUi } from './types';

export interface SignupWizardUiContextValue {
  countries: CountryOnboardingUi[];
  countriesLoading: boolean;
  postalCodeRequired: boolean;
  signupCountryCodes: string[];
}

const SignupWizardUiContext = createContext<SignupWizardUiContextValue>({
  countries: [],
  countriesLoading: false,
  postalCodeRequired: false,
  signupCountryCodes: [],
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
