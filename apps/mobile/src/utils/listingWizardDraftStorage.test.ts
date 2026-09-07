import { describe, expect, it } from 'vitest';
import { migrateListingWizardDraftStep } from './listingWizardDraftStorage';

describe('migrateListingWizardDraftStep', () => {
  it('bumps legacy publish (4) onto current publish (5)', () => {
    expect(migrateListingWizardDraftStep(4)).toBe(5);
  });

  it('bumps legacy done (5) onto current done (6)', () => {
    expect(migrateListingWizardDraftStep(5)).toBe(6);
  });

  it('leaves pre-publish steps unchanged', () => {
    expect(migrateListingWizardDraftStep(3)).toBe(3);
  });

  it('does not bump already-migrated drafts', () => {
    expect(migrateListingWizardDraftStep(4, 2)).toBe(4);
    expect(migrateListingWizardDraftStep(5, 2)).toBe(5);
  });
});
