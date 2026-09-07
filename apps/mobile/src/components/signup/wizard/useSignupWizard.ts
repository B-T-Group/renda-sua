import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSteps } from './buildSteps';
import type {
  SignupWizardValues,
  WizardStepId,
  WizardStepMeta,
} from './types';

export function useSignupWizard(values: SignupWizardValues) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => buildSteps({ personas: values.personas }),
    [values.personas]
  );

  useEffect(() => {
    setStepIndex((s) => Math.min(s, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const currentStep: WizardStepMeta = steps[stepIndex] ?? steps[steps.length - 1];
  const activeStepId: WizardStepId = currentStep?.id ?? 'review';
  const totalSteps = steps.length;
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= totalSteps - 1;

  const goNext = useCallback(() => {
    setStepIndex((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setStepIndex((s) => Math.max(s - 1, 0));
  }, []);

  const goToStepId = useCallback(
    (id: WizardStepId) => {
      const idx = steps.findIndex((s) => s.id === id);
      if (idx >= 0) setStepIndex(idx);
    },
    [steps]
  );

  return {
    steps,
    stepIndex,
    setStepIndex,
    activeStepId,
    currentStep,
    totalSteps,
    isFirst,
    isLast,
    goNext,
    goBack,
    goToStepId,
  };
}
