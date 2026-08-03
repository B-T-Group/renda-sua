import type { ComponentType } from 'react';
import { ContactStep } from '../steps/ContactStep';
import { PersonasStep } from '../steps/PersonasStep';
import { CountryStep } from '../steps/CountryStep';
import { StoreLocationStep } from '../steps/StoreLocationStep';
import { ReviewStep } from '../steps/ReviewStep';
import { WIZARD_STEP_META, type WizardStepMeta } from './buildSteps';
import type { WizardStepId } from './types';

export type { WizardStepMeta };
export { buildSteps, WIZARD_STEP_META } from './buildSteps';

export interface WizardStepDefinition extends WizardStepMeta {
  Component: ComponentType;
}

const STEP_COMPONENTS: Record<WizardStepId, ComponentType> = {
  contact: ContactStep,
  personas: PersonasStep,
  country: CountryStep,
  storeLocation: StoreLocationStep,
  review: ReviewStep,
};

export const WIZARD_STEP_REGISTRY: WizardStepDefinition[] =
  WIZARD_STEP_META.map((meta) => ({
    ...meta,
    Component: STEP_COMPONENTS[meta.id],
  }));

export function buildWizardSteps(
  ctx: Parameters<typeof import('./buildSteps').buildSteps>[0]
): WizardStepDefinition[] {
  return WIZARD_STEP_REGISTRY.filter((step) => step.isEnabled(ctx));
}
