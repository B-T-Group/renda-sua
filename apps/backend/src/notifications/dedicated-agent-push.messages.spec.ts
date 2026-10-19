import {
  buildDedicatedAgentMessage,
  buildDedicatedAssignedBusinessMessage,
  dedicatedSlotLabel,
} from './dedicated-agent-push.messages';

describe('dedicated agent notice copy (AC v5)', () => {
  it('business: "RendaSua assigned {{agent}} to {{slot}}" in EN and FR', () => {
    expect(buildDedicatedAssignedBusinessMessage({ agentName: 'Awa', slotKeys: ['morning'], preferredLanguage: 'en' })).toEqual({
      title: 'Dedicated agent',
      body: 'RendaSua assigned Awa to Morning',
    });
    expect(buildDedicatedAssignedBusinessMessage({ agentName: 'Awa', slotKeys: ['afternoon'], preferredLanguage: 'fr-CM' })).toEqual({
      title: 'Livreur dédié',
      body: 'RendaSua a affecté Awa au créneau Après-midi',
    });
  });

  it('defaults to French when the language is unknown (same as other notices)', () => {
    expect(buildDedicatedAssignedBusinessMessage({ agentName: 'Awa', slotKeys: ['evening'] }).body).toBe(
      'RendaSua a affecté Awa au créneau Soir'
    );
  });

  it('agent: assigned / paused / resumed / removed in EN and FR', () => {
    const msg = (event: 'assigned' | 'paused' | 'resumed' | 'removed', lang: string) =>
      buildDedicatedAgentMessage({ event, storeName: 'Chez Mama', slotKeys: ['evening'], preferredLanguage: lang }).body;
    expect(msg('assigned', 'en')).toBe("You're now dedicated to Chez Mama (Evening)");
    expect(msg('assigned', 'fr')).toBe('Vous êtes désormais livreur dédié de Chez Mama (Soir)');
    expect(msg('paused', 'en')).toBe('Chez Mama paused your dedicated slot (Evening)');
    expect(msg('paused', 'fr')).toBe('Chez Mama a mis en pause votre créneau dédié (Soir)');
    expect(msg('resumed', 'en')).toBe('Chez Mama resumed your dedicated slot (Evening)');
    expect(msg('resumed', 'fr')).toBe('Chez Mama a réactivé votre créneau dédié (Soir)');
    expect(msg('removed', 'en')).toBe('Chez Mama removed you as a dedicated agent (Evening)');
    expect(msg('removed', 'fr')).toBe('Chez Mama vous a retiré comme livreur dédié (Soir)');
  });

  it('slot labels', () => {
    expect(['morning', 'afternoon', 'evening'].map((k) => dedicatedSlotLabel(k, 'en'))).toEqual(['Morning', 'Afternoon', 'Evening']);
    expect(['morning', 'afternoon', 'evening'].map((k) => dedicatedSlotLabel(k, 'fr'))).toEqual(['Matin', 'Après-midi', 'Soir']);
  });
});
