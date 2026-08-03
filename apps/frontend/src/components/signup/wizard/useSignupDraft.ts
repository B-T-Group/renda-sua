import { useCallback, useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { SignupFormValues, WizardStepId } from './types';

const DRAFT_KEY = 'signupDraft.v1';

export interface SignupDraft {
  values: SignupFormValues;
  activeStepId: WizardStepId;
  savedAt: number;
}

export function loadSignupDraft(): SignupDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SignupDraft;
  } catch {
    return null;
  }
}

export function clearSignupDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function useSignupDraft(
  form: UseFormReturn<SignupFormValues>,
  activeStepId: WizardStepId,
  enabled = true
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(() => {
    if (!enabled) return;
    try {
      const draft: SignupDraft = {
        values: form.getValues(),
        activeStepId,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore quota / private mode
    }
  }, [activeStepId, enabled, form]);

  useEffect(() => {
    if (!enabled) return;
    const sub = form.watch(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(persist, 400);
    });
    return () => {
      sub.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, form, persist]);

  useEffect(() => {
    if (!enabled) return;
    persist();
  }, [activeStepId, enabled, persist]);
}
