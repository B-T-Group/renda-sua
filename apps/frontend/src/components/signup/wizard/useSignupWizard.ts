import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildSignupSchema } from '../schemas/signupSchema';
import { buildWizardSteps, type WizardStepDefinition } from './stepRegistry';
import {
  DEFAULT_SIGNUP_VALUES,
  mainInterestFromIntent,
  parseSignupIntent,
  personasFromIntent,
  type CountryOnboardingUi,
  type SignupFormValues,
  type SignupIntent,
  type WizardStepId,
} from './types';
import { loadSignupDraft, useSignupDraft } from './useSignupDraft';

function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export interface UseSignupWizardOptions {
  intentParam: string | null;
  countries: CountryOnboardingUi[];
}

export interface UseSignupWizardResult {
  form: UseFormReturn<SignupFormValues>;
  steps: WizardStepDefinition[];
  activeStepId: WizardStepId;
  activeStep: WizardStepDefinition;
  activeIndex: number;
  isFirst: boolean;
  isLast: boolean;
  signupIntent: SignupIntent | null;
  postalCodeRequired: boolean;
  goNext: () => Promise<boolean>;
  goBack: () => void;
  setActiveStepId: (id: WizardStepId) => void;
  selectedCountryConfig: CountryOnboardingUi | null;
}

export function useSignupWizard({
  intentParam,
  countries,
}: UseSignupWizardOptions): UseSignupWizardResult {
  const signupIntent = useMemo(
    () => parseSignupIntent(intentParam),
    [intentParam]
  );

  const draft = useMemo(() => loadSignupDraft(), []);

  const defaultValues = useMemo((): SignupFormValues => {
    if (draft?.values) return draft.values;
    return {
      ...DEFAULT_SIGNUP_VALUES,
      personas: personasFromIntent(signupIntent),
      business: {
        ...DEFAULT_SIGNUP_VALUES.business,
        mainInterest: mainInterestFromIntent(signupIntent),
      },
    };
  }, [draft, signupIntent]);

  const [activeStepId, setActiveStepId] = useState<WizardStepId>(
    draft?.activeStepId ?? 'contact'
  );

  const [postalCodeRequired, setPostalCodeRequired] = useState(false);

  const resolver = useMemo(
    () =>
      zodResolver(
        buildSignupSchema({ postalCodeRequired })
      ) as ReturnType<typeof zodResolver>,
    [postalCodeRequired]
  );

  const form = useForm<SignupFormValues>({
    mode: 'onTouched',
    defaultValues,
    shouldUnregister: false,
    resolver,
  });

  const personas =
    useWatch({ control: form.control, name: 'personas' }) ??
    defaultValues.personas;
  const country =
    useWatch({ control: form.control, name: 'country' }) ??
    defaultValues.country;

  const countryConfig = useMemo(() => {
    const code = (country || '').toUpperCase();
    return countries.find((c) => c.code.toUpperCase() === code) ?? null;
  }, [countries, country]);

  useEffect(() => {
    setPostalCodeRequired(Boolean(countryConfig?.postalCodeRequired));
  }, [countryConfig?.postalCodeRequired]);

  const steps = useMemo(
    () =>
      buildWizardSteps({
        personas,
        country,
        countryConfig,
      }),
    [personas, country, countryConfig]
  );

  useEffect(() => {
    if (!steps.some((s) => s.id === activeStepId)) {
      const idx = Math.max(0, steps.length - 2);
      setActiveStepId(steps[idx]?.id ?? 'contact');
    }
  }, [steps, activeStepId]);

  useSignupDraft(form, activeStepId, true);

  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === activeStepId)
  );
  const activeStep = steps[activeIndex] ?? steps[0];

  const goNext = useCallback(async (): Promise<boolean> => {
    const step = steps[activeIndex];
    if (!step) return false;

    if (step.id === 'personas' && personas.includes('business')) {
      const ok = await form.trigger([
        'personas',
        'business.name',
        'business.mainInterest',
      ]);
      if (!ok) return false;
    } else if (step.id === 'storeLocation') {
      const fields: Array<
        | 'storeLocation.street'
        | 'storeLocation.city'
        | 'storeLocation.region'
        | 'storeLocation.postalCode'
      > = [
        'storeLocation.street',
        'storeLocation.city',
        'storeLocation.region',
      ];
      if (postalCodeRequired) fields.push('storeLocation.postalCode');
      const ok = await form.trigger(fields);
      if (!ok) return false;
      if (
        postalCodeRequired &&
        !form.getValues('storeLocation.postalCode').trim()
      ) {
        form.setError('storeLocation.postalCode', { message: 'Required' });
        return false;
      }
    } else if (step.fields.length) {
      const ok = await form.trigger(step.fields);
      if (!ok) return false;
    }

    if (step.id === 'contact') {
      const email = form.getValues('contact.email');
      if (!isValidEmailFormat(email)) {
        form.setError('contact.email', { message: 'Invalid email' });
        return false;
      }
    }

    const next = steps[activeIndex + 1];
    if (next) setActiveStepId(next.id);
    return true;
  }, [activeIndex, form, personas, postalCodeRequired, steps]);

  const goBack = useCallback(() => {
    const prev = steps[activeIndex - 1];
    if (prev) setActiveStepId(prev.id);
  }, [activeIndex, steps]);

  return {
    form,
    steps,
    activeStepId,
    activeStep,
    activeIndex,
    isFirst: activeIndex <= 0,
    isLast: activeIndex >= steps.length - 1,
    signupIntent,
    postalCodeRequired,
    goNext,
    goBack,
    setActiveStepId,
    selectedCountryConfig: countryConfig,
  };
}
