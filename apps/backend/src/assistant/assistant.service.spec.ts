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

  it('detects French locale from message text', () => {
    expect(service.detectLocaleFromText('Bonjour, où êtes-vous ?', 'en')).toBe(
      'fr'
    );
  });
});
