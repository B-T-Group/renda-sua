import {
  buildDedicatedPostingAgentMessage,
  buildDedicatedPostingApplicationMessage,
} from './dedicated-posting-push.messages';

describe('dedicated posting notices (copy)', () => {
  const base = { storeName: 'Chez Mama', slotKeys: ['morning', 'evening'] };
  it.each([
    ['accepted', 'en', 'Chez Mama accepted you as its dedicated agent (Morning, Evening)'],
    ['accepted', 'fr', 'Chez Mama vous a accepté comme livreur dédié (Matin, Soir)'],
    ['filled', 'en', 'This spot was filled: Chez Mama (Morning, Evening)'],
    ['filled', 'fr', 'Ce poste a été pourvu : Chez Mama (Matin, Soir)'],
    ['closed', 'en', 'Chez Mama is no longer looking for a dedicated agent (Morning, Evening)'],
    ['closed', 'fr', 'Chez Mama ne recherche plus de livreur dédié (Matin, Soir)'],
    ['terms_updated', 'en', 'Chez Mama updated its terms'],
    ['terms_updated', 'fr', 'Chez Mama a mis à jour ses conditions'],
  ] as const)('%s (%s)', (event, lang, body) => {
    expect(buildDedicatedPostingAgentMessage({ ...base, event, preferredLanguage: lang })).toEqual({
      title: lang === 'fr' ? 'Livreur dédié' : 'Dedicated agent',
      body,
    });
  });

  it('defaults to French', () => {
    expect(buildDedicatedPostingAgentMessage({ ...base, event: 'filled', preferredLanguage: null }).body).toBe(
      'Ce poste a été pourvu : Chez Mama (Matin, Soir)'
    );
  });

  it('new application to the business', () => {
    expect(buildDedicatedPostingApplicationMessage({ agentFirstName: 'Awa', slotKeys: ['afternoon'], preferredLanguage: 'en' })).toEqual({
      title: 'New applicant',
      body: 'Awa applied to be your dedicated agent (Afternoon)',
    });
    expect(buildDedicatedPostingApplicationMessage({ agentFirstName: 'Awa', slotKeys: ['afternoon'], preferredLanguage: 'fr' })).toEqual({
      title: 'Nouvelle candidature',
      body: 'Awa a postulé comme livreur dédié (Après-midi)',
    });
  });
});
