import type { StepContext, WizardStepMeta } from './types';

/** Ordered registry — add future steps via new entries + isEnabled. */
export const WIZARD_STEP_META: WizardStepMeta[] = [
  {
    id: 'country',
    labelKey: 'auth.signupFlow.stepCountry',
    labelDefault: 'Country',
    subtitleKey: 'auth.signupFlow.subCountry',
    subtitleDefault:
      'Your country determines payments, verification, and local options.',
    isEnabled: () => true,
  },
  {
    id: 'contact',
    labelKey: 'auth.signupFlow.stepContact',
    labelDefault: 'Contact',
    subtitleKey: 'auth.signupFlow.subContact',
    subtitleDefault: 'Enter your name and how we can reach you.',
    isEnabled: () => true,
  },
  {
    id: 'personas',
    labelKey: 'auth.signupFlow.stepPersonas',
    labelDefault: 'Personas',
    subtitleKey: 'auth.signupFlow.subPersonas',
    subtitleDefault: 'Choose how you want to start. You can add other modes later.',
    isEnabled: () => true,
  },
  {
    id: 'agentFocus',
    labelKey: 'auth.signupFlow.stepAgentFocus',
    labelDefault: 'Agent focus',
    subtitleKey: 'auth.signupFlow.subAgentFocus',
    subtitleDefault: 'Do you want to deliver, recruit businesses, or both?',
    isEnabled: (ctx) => ctx.personas.includes('agent'),
  },
  {
    id: 'storeLocation',
    labelKey: 'auth.signupFlow.stepStoreLocation',
    labelDefault: 'Store location',
    subtitleKey: 'auth.signupFlow.subStoreLocation',
    subtitleDefault:
      'This becomes your first business location. You can add more locations later.',
    isEnabled: (ctx) => ctx.personas.includes('business'),
  },
  {
    id: 'review',
    labelKey: 'auth.signupFlow.stepReview',
    labelDefault: 'Review',
    subtitleKey: 'auth.signupFlow.subReview',
    subtitleDefault: 'Check everything looks correct, then create your account.',
    isEnabled: () => true,
  },
];

export function buildSteps(ctx: StepContext): WizardStepMeta[] {
  return WIZARD_STEP_META.filter((step) => step.isEnabled(ctx));
}
