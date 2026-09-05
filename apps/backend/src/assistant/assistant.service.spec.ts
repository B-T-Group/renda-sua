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
    buildToolConfig: jest.fn().mockReturnValue({ tools: [] }),
    executeTool: jest.fn(),
    isMarketCatalogTool: jest.fn(
      (name: string) =>
        name === 'list_supported_country_states' ||
        name === 'list_supported_payment_systems'
    ),
  };
  const service = new AssistantService(
    configService as any,
    bedrock as any,
    tools as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tools.buildToolConfig.mockReturnValue({ tools: [] });
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
});
