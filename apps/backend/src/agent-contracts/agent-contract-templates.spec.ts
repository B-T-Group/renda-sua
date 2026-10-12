import { resolveAgentContractTemplate } from './agent-contract-templates';

describe('resolveAgentContractTemplate', () => {
  it('uses Canada French for a Canadian agent who prefers French', () => {
    const template = resolveAgentContractTemplate({
      country: 'CA',
      preferredLanguage: 'fr',
    });
    expect(template.key).toBe('canada_fr');
    expect(template.boldsignTemplateId).toBe(
      'a6d79255-d0d4-4b02-b218-d55a8dcd367b'
    );
  });

  it('uses Central Africa English for Cameroon', () => {
    const template = resolveAgentContractTemplate({
      country: 'Cameroon',
      preferredLanguage: 'en',
    });
    expect(template.key).toBe('central_africa_en');
    expect(template.needsNationality).toBe(false);
  });

  it('uses West Africa French for Togo', () => {
    const template = resolveAgentContractTemplate({
      country: 'TG',
      preferredLanguage: 'fr-FR',
    });
    expect(template.key).toBe('west_africa_fr');
    expect(template.rendasuaAddress).toBeNull();
  });

  it('falls back to Canada English when the country has no template', () => {
    const template = resolveAgentContractTemplate({
      country: 'PH',
      preferredLanguage: 'fr',
    });
    expect(template.key).toBe('canada_en');
    expect(template.boldsignTemplateId).toBe(
      '0b3e56d6-72ba-40e9-aa31-4c114aa579a1'
    );
  });

  it('uses the address country when the user country is missing', () => {
    const template = resolveAgentContractTemplate({
      addressCountry: 'GA',
      preferredLanguage: 'fr',
    });
    expect(template.key).toBe('central_africa_fr');
  });
});
