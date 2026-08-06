import type { FieldPath } from 'react-hook-form';
import type { SignupFormValues, StepContext, WizardStepId } from './types';

export interface WizardStepMeta {
  id: WizardStepId;
  labelKey: string;
  labelDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  fields: FieldPath<SignupFormValues>[];
  isEnabled: (ctx: StepContext) => boolean;
}

/** Ordered registry metadata — add future steps via new entries + isEnabled. */
export const WIZARD_STEP_META: WizardStepMeta[] = [
  {
    id: 'country',
    labelKey: 'signupPage.steps.country',
    labelDefault: 'Country',
    subtitleKey: 'signupPage.countrySubtitle',
    subtitleDefault:
      'Your country determines payments, verification, and local options.',
    fields: ['country'],
    isEnabled: () => true,
  },
  {
    id: 'contact',
    labelKey: 'signupPage.steps.contact',
    labelDefault: 'Contact',
    subtitleKey: 'signupPage.contactSubtitle',
    subtitleDefault: 'Enter your name and how we can reach you.',
    fields: [
      'contact.firstName',
      'contact.lastName',
      'contact.email',
      'contact.phone',
    ],
    isEnabled: () => true,
  },
  {
    id: 'personas',
    labelKey: 'signupPage.steps.personas',
    labelDefault: 'Personas',
    subtitleKey: 'signupPage.personasSubtitle',
    subtitleDefault:
      'Choose how you want to start. You can add other modes later.',
    fields: [
      'personas',
      'business.name',
      'business.mainInterest',
      'business.referralAgentCode',
    ],
    isEnabled: () => true,
  },
  {
    id: 'storeLocation',
    labelKey: 'signupPage.steps.storeLocation',
    labelDefault: 'Store location',
    subtitleKey: 'signupPage.storeLocationSubtitle',
    subtitleDefault:
      'This becomes your first business location. You can add more locations later.',
    fields: [
      'storeLocation.street',
      'storeLocation.city',
      'storeLocation.region',
      'storeLocation.postalCode',
    ],
    isEnabled: (ctx) => ctx.personas.includes('business'),
  },
  {
    id: 'review',
    labelKey: 'signupPage.steps.review',
    labelDefault: 'Review',
    subtitleKey: 'signupPage.reviewSubtitle',
    subtitleDefault: 'Check everything looks correct, then create your account.',
    fields: [],
    isEnabled: () => true,
  },
];

export function buildSteps(ctx: StepContext): WizardStepMeta[] {
  return WIZARD_STEP_META.filter((step) => step.isEnabled(ctx));
}
