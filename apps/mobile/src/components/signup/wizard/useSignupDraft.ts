import { useCallback, useEffect, useRef } from 'react';
import StorageService from '../../../services/storage/StorageService';
import type { SignupWizardValues, WizardStepId } from './types';

const DRAFT_KEY = 'signupDraft.v1';

export interface SignupDraft {
  values: SignupWizardValues;
  activeStepId: WizardStepId;
  savedAt: number;
}

export async function loadSignupDraft(): Promise<SignupDraft | null> {
  try {
    return await StorageService.getObject<SignupDraft>(DRAFT_KEY);
  } catch {
    return null;
  }
}

export async function clearSignupDraft(): Promise<void> {
  try {
    await StorageService.remove(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function useSignupDraft(
  values: SignupWizardValues,
  activeStepId: WizardStepId,
  enabled = true
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(() => {
    if (!enabled) return;
    const draft: SignupDraft = {
      values,
      activeStepId,
      savedAt: Date.now(),
    };
    void StorageService.setObject(DRAFT_KEY, draft).catch(() => {
      // ignore quota
    });
  }, [activeStepId, enabled, values]);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, persist, values, activeStepId]);
}
