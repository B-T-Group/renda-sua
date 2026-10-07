import { AssistantService } from './assistant.service';

describe('AssistantService', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'assistant.enabled') return true;
      if (key === 'assistant.whatsappRepliesEnabled') return true;
      if (key === 'assistant') {
        return {
          enabled: true,
          whatsappRepliesEnabled: true,
          model: '',
          maxHistoryMessages: 10,
          maxToolIterations: 3,
          whatsappMaxReplyChars: 1200,
        };
      }
      if (key === 'assistant.whatsappMaxReplyChars') return 1200;
      return undefined;
    },
  };
  const bedrock = {
    converseWithTools: jest.fn(),
  };
  const tools = {
    buildToolConfig: jest.fn().mockResolvedValue({ tools: [] }),
    executeTool: jest.fn(),
    isMarketCatalogTool: jest.fn(
      (name: string) =>
        name === 'list_supported_country_states' ||
        name === 'list_supported_payment_systems'
    ),
  };
  const siteEvents = {
    emit: jest.fn(),
  };
  const service = new AssistantService(
    configService as any,
    bedrock as any,
    tools as any,
    siteEvents as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tools.buildToolConfig.mockResolvedValue({ tools: [] });
  });

  it('returns final text when Bedrock ends the turn', async () => {
    bedrock.converseWithTools.mockResolvedValue({
      stopReason: 'end_turn',
      text: 'Yes, we support pay at delivery in Cameroon.',
      toolUses: [],
      assistantContent: [{ text: 'Yes, we support pay at delivery in Cameroon.' }],
    });
    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [{ role: 'user', content: 'do you support payment at delivery?' }],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: null,
        market: { country_code: 'CM' },
        country: 'CM',
        phoneE164: '2376',
        accountType: null,
        clientId: null,
      },
    });
    expect(result.reply).toMatch(/pay at delivery/i);
    expect(result.handoff).toBe(false);
    expect(result.locale).toBe('en');
  });

  it('strips thinking metadata from model replies', async () => {
    bedrock.converseWithTools.mockResolvedValue({
      stopReason: 'end_turn',
      text: '<thinking>User may be in Gabon.</thinking>\nBonjour Samuel, oui pour le Gabon.',
      toolUses: [],
      assistantContent: [
        {
          text: '<thinking>User may be in Gabon.</thinking>\nBonjour Samuel, oui pour le Gabon.',
        },
      ],
    });
    const result = await service.runTurn({
      channel: 'app',
      messages: [{ role: 'user', content: 'paiement à la livraison ?' }],
      identity: {
        isVerified: true,
        userId: 'u1',
        firstName: 'Samuel',
        preferredLanguage: 'fr',
        market: { country_code: 'GA' },
        country: 'GA',
        phoneE164: null,
        accountType: 'client',
        clientId: 'c1',
      },
    });
    expect(result.reply).toBe('Bonjour Samuel, oui pour le Gabon.');
    expect(result.reply).not.toMatch(/thinking/i);
  });

  it('runs a tool loop then returns the final answer', async () => {
    bedrock.converseWithTools
      .mockResolvedValueOnce({
        stopReason: 'tool_use',
        text: '',
        toolUses: [
          {
            toolUseId: 't1',
            name: 'get_knowledge',
            input: { topic: 'payments' },
          },
        ],
        assistantContent: [
          {
            toolUse: {
              toolUseId: 't1',
              name: 'get_knowledge',
              input: { topic: 'payments' },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'Oui, le paiement à la livraison est disponible.',
        toolUses: [],
        assistantContent: [
          { text: 'Oui, le paiement à la livraison est disponible.' },
        ],
      });
    tools.executeTool.mockResolvedValue({ content: 'payments kb' });

    const result = await service.runTurn({
      channel: 'app',
      messages: [
        { role: 'user', content: 'Est-ce que vous acceptez le paiement à la livraison ?' },
      ],
      identity: {
        isVerified: true,
        userId: 'u1',
        firstName: 'Ada',
        preferredLanguage: 'fr',
        market: { country_code: 'CM' },
        market: { country_code: 'CM' },
        country: 'CM',
        phoneE164: null,
        accountType: 'client',
        clientId: 'c1',
      },
    });
    expect(tools.executeTool).toHaveBeenCalled();
    expect(result.locale).toBe('fr');
    expect(result.reply).toMatch(/livraison/i);
  });

  it('grounds market questions when the model skips get_knowledge', async () => {
    bedrock.converseWithTools
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'Rendasua is available in Brazil with Pix.',
        toolUses: [],
        assistantContent: [{ text: 'Rendasua is available in Brazil with Pix.' }],
      })
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'Rendasua is not yet available in Brazil.',
        toolUses: [],
        assistantContent: [{ text: 'Rendasua is not yet available in Brazil.' }],
      });
    tools.executeTool.mockResolvedValue({
      content: 'No supported country/state rows found for BR.',
    });

    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [{ role: 'user', content: 'and brazil?' }],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: 'en',
        market: null,
        country: null,
        phoneE164: '2376',
        accountType: null,
        clientId: null,
      },
    });

    expect(tools.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'list_supported_country_states',
        input: { country_code: 'BR' },
      })
    );
    expect(bedrock.converseWithTools).toHaveBeenCalledTimes(2);
    expect(result.reply).toMatch(/not yet available in Brazil/i);
  });

  it('still grounds with live catalog when the model only called get_knowledge', async () => {
    bedrock.converseWithTools
      .mockResolvedValueOnce({
        stopReason: 'tool_use',
        text: '',
        toolUses: [
          {
            toolUseId: 't1',
            name: 'get_knowledge',
            input: { topic: 'markets' },
          },
        ],
        assistantContent: [
          {
            toolUse: {
              toolUseId: 't1',
              name: 'get_knowledge',
              input: { topic: 'markets' },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'Rendasua is live in Brazil.',
        toolUses: [],
        assistantContent: [{ text: 'Rendasua is live in Brazil.' }],
      })
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'Rendasua is not yet available in Brazil.',
        toolUses: [],
        assistantContent: [{ text: 'Rendasua is not yet available in Brazil.' }],
      });
    tools.executeTool
      .mockResolvedValueOnce({ content: 'Static markets KB mentioning Brazil.' })
      .mockResolvedValueOnce({
        content: 'No supported country/state rows found for BR.',
      });

    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [{ role: 'user', content: 'and brazil?' }],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: 'en',
        market: { country_code: 'GA' },
        country: 'GA',
        phoneE164: '2376',
        accountType: null,
        clientId: null,
      },
    });

    expect(tools.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'list_supported_country_states',
        input: { country_code: 'BR' },
      })
    );
    expect(result.reply).toMatch(/not yet available in Brazil/i);
  });

  it('grounds broad market questions without identity country scope', async () => {
    bedrock.converseWithTools
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'We serve a few markets.',
        toolUses: [],
        assistantContent: [{ text: 'We serve a few markets.' }],
      })
      .mockResolvedValueOnce({
        stopReason: 'end_turn',
        text: 'Rendasua is available in Cameroon, Gabon, Canada, and more.',
        toolUses: [],
        assistantContent: [
          { text: 'Rendasua is available in Cameroon, Gabon, Canada, and more.' },
        ],
      });
    tools.executeTool.mockResolvedValue({
      content: 'Configured countries: CM, GA, CA, US, BR.',
    });

    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [{ role: 'user', content: 'Which markets do you serve?' }],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: 'en',
        market: { country_code: 'GA' },
        country: 'GA',
        phoneE164: '2416',
        accountType: null,
        clientId: null,
      },
    });

    expect(tools.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'list_supported_country_states',
        input: {},
      })
    );
    expect(result.reply).toMatch(/Cameroon/i);
  });

  it('detects French locale from message text', () => {
    expect(service.detectLocaleFromText('Bonjour, où êtes-vous ?', 'en')).toBe(
      'fr'
    );
  });

  it('stays silent on WhatsApp when the model returns [[NO_REPLY]]', async () => {
    bedrock.converseWithTools.mockResolvedValue({
      stopReason: 'end_turn',
      text: '[[NO_REPLY]]',
      toolUses: [],
      assistantContent: [{ text: '[[NO_REPLY]]' }],
    });
    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [
        {
          role: 'user',
          content: 'Thank you for contacting us. This is an automated message.',
        },
      ],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: 'en',
        market: null,
        country: null,
        phoneE164: '2376',
        accountType: null,
        clientId: null,
      },
    });
    expect(result.silent).toBe(true);
    expect(result.reply).toBe('');
  });

  it('stays silent on WhatsApp empty model output', async () => {
    bedrock.converseWithTools.mockResolvedValue({
      stopReason: 'end_turn',
      text: '',
      toolUses: [],
      assistantContent: [],
    });
    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [{ role: 'user', content: 'hello there' }],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: 'en',
        market: null,
        country: null,
        phoneE164: '2376',
        accountType: null,
        clientId: null,
      },
    });
    expect(result.silent).toBe(true);
    expect(result.reply).toBe('');
  });

  it('returns GET_BACK_SHORTLY for in-app empty fallback', async () => {
    bedrock.converseWithTools.mockResolvedValue({
      stopReason: 'end_turn',
      text: '',
      toolUses: [],
      assistantContent: [],
    });
    const result = await service.runTurn({
      channel: 'app',
      messages: [{ role: 'user', content: 'something obscure' }],
      identity: {
        isVerified: true,
        userId: 'u1',
        firstName: 'Ada',
        preferredLanguage: 'en',
        market: { country_code: 'CM' },
        market: { country_code: 'CM' },
        country: 'CM',
        phoneE164: null,
        accountType: 'client',
        clientId: 'c1',
      },
    });
    expect(result.silent).toBe(false);
    expect(result.reply).toMatch(/get back to you shortly/i);
    expect(result.handoff).toBe(true);
  });

  it('marks successful WhatsApp answers as not silent', async () => {
    bedrock.converseWithTools.mockResolvedValue({
      stopReason: 'end_turn',
      text: 'Yes, we support pay at delivery in Cameroon.',
      toolUses: [],
      assistantContent: [{ text: 'Yes, we support pay at delivery in Cameroon.' }],
    });
    const result = await service.runTurn({
      channel: 'whatsapp',
      messages: [{ role: 'user', content: 'do you support payment at delivery?' }],
      identity: {
        isVerified: false,
        userId: null,
        firstName: null,
        preferredLanguage: null,
        market: { country_code: 'CM' },
        country: 'CM',
        phoneE164: '2376',
        accountType: null,
        clientId: null,
      },
    });
    expect(result.silent).toBe(false);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  describe('market prompt injection', () => {
    it('injects market context into system prompt when market is known', async () => {
      bedrock.converseWithTools.mockResolvedValue({
        stopReason: 'end_turn',
        text: 'We have phones available.',
        toolUses: [],
        assistantContent: [{ text: 'We have phones available.' }],
      });

      await service.runTurn({
        channel: 'app',
        messages: [{ role: 'user', content: 'I want to buy a phone' }],
        identity: {
          isVerified: true,
          userId: 'u1',
          firstName: 'Samuel',
          preferredLanguage: 'en',
          market: { country_code: 'CM' },
          country: 'CM',
          phoneE164: null,
          accountType: 'client',
          clientId: 'c1',
        },
      });

      const systemPromptCall = bedrock.converseWithTools.mock.calls[0][0].system;
      expect(systemPromptCall).toContain('The customer is in CM');
      expect(systemPromptCall).toContain('Never ask which country they are in');
    });

    it('includes no-country-quiz rule in prompt when market is known', async () => {
      bedrock.converseWithTools.mockResolvedValue({
        stopReason: 'end_turn',
        text: 'Here are some bottles.',
        toolUses: [],
        assistantContent: [{ text: 'Here are some bottles.' }],
      });

      await service.runTurn({
        channel: 'app',
        messages: [{ role: 'user', content: 'I want to buy a bottle' }],
        identity: {
          isVerified: true,
          userId: 'u1',
          firstName: 'Samuel',
          preferredLanguage: 'en',
          market: { country_code: 'CM' },
          country: 'CM',
          phoneE164: null,
          accountType: 'client',
          clientId: 'c1',
        },
      });

      const systemPromptCall = bedrock.converseWithTools.mock.calls[0][0].system;
      expect(systemPromptCall).toContain('Never ask which country they are in');
      expect(systemPromptCall).toContain('customer is in CM');
    });

    it('allows country questions when market is unknown', async () => {
      bedrock.converseWithTools.mockResolvedValue({
        stopReason: 'end_turn',
        text: 'Which country are you in?',
        toolUses: [],
        assistantContent: [{ text: 'Which country are you in?' }],
      });

      await service.runTurn({
        channel: 'app',
        messages: [{ role: 'user', content: 'I want to buy a phone' }],
        identity: {
          isVerified: false,
          userId: null,
          firstName: null,
          preferredLanguage: null,
          market: null,
          country: null,
          phoneE164: null,
          accountType: null,
          clientId: null,
        },
      });

      const systemPromptCall = bedrock.converseWithTools.mock.calls[0][0].system;
      expect(systemPromptCall).toContain('The customer market is unknown');
      expect(systemPromptCall).not.toContain('NEVER ask the customer which country');
    });
  });

  describe('classifyIntent', () => {
    it('classifies search_catalog with availability keywords as availability', () => {
      const messages = [{ role: 'user' as const, content: 'Is milk available?' }];
      const toolsUsed = new Set(['search_catalog']);
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('availability');
    });

    it('classifies search_catalog without availability keywords as buy', () => {
      const messages = [{ role: 'user' as const, content: 'I want to buy milk' }];
      const toolsUsed = new Set(['search_catalog']);
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('buy');
    });

    it('classifies get_reorder_options as reorder', () => {
      const messages = [{ role: 'user' as const, content: 'reorder my last order' }];
      const toolsUsed = new Set(['get_reorder_options']);
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('reorder');
    });

    it('classifies get_order_status as track', () => {
      const messages = [{ role: 'user' as const, content: 'where is my order?' }];
      const toolsUsed = new Set(['get_order_status']);
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('track');
    });

    it('classifies request_human_support as support', () => {
      const messages = [{ role: 'user' as const, content: 'I need help' }];
      const toolsUsed = new Set(['request_human_support']);
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('support');
    });

    it('classifies buy keywords without tools as buy', () => {
      const messages = [{ role: 'user' as const, content: 'I want to purchase a phone' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('buy');
    });

    it('classifies availability keywords without tools as availability', () => {
      const messages = [{ role: 'user' as const, content: 'do you have milk in stock?' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('availability');
    });

    it('classifies reorder keywords without tools as reorder', () => {
      const messages = [{ role: 'user' as const, content: 'order the same thing again' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('reorder');
    });

    it('classifies tracking keywords without tools as track', () => {
      const messages = [{ role: 'user' as const, content: 'where is my delivery?' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('track');
    });

    it('classifies support keywords without tools as support', () => {
      const messages = [{ role: 'user' as const, content: 'I have a problem with my account' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('support');
    });

    it('classifies ambiguous messages as other', () => {
      const messages = [{ role: 'user' as const, content: 'hello there' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('other');
    });

    it('handles French availability keywords with search_catalog', () => {
      const messages = [{ role: 'user' as const, content: 'Le lait est disponible?' }];
      const toolsUsed = new Set(['search_catalog']);
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('availability');
    });

    it('handles French buy keywords without tools', () => {
      const messages = [{ role: 'user' as const, content: 'Je veux acheter du pain' }];
      const toolsUsed = new Set<string>();
      const result = (service as any).classifyIntent(messages, toolsUsed);
      expect(result).toBe('buy');
    });
  });
});
