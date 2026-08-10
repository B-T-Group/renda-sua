import { WhatsAppChannel } from './whatsapp.channel';

describe('WhatsAppChannel', () => {
  const whatsAppService = {
    isConfigured: jest.fn(),
    sendTemplateMessage: jest.fn(),
  };
  const templateService = {
    resolveMetaName: jest.fn(),
    languageCode: jest.fn().mockReturnValue('en_US'),
    buildComponents: jest.fn().mockReturnValue([]),
  };
  const configService = {
    get: jest.fn(),
  };
  let channel: WhatsAppChannel;

  beforeEach(() => {
    jest.clearAllMocks();
    whatsAppService.isConfigured.mockReturnValue(true);
    configService.get.mockReturnValue({ notificationsEnabled: true });
    templateService.resolveMetaName.mockReturnValue('rs_order_new');
    whatsAppService.sendTemplateMessage.mockResolvedValue({
      messages: [{ id: 'wamid.1' }],
    });
    channel = new WhatsAppChannel(
      whatsAppService as never,
      templateService as never,
      configService as never
    );
  });

  it('featureEnabled requires both flag and Graph credentials', () => {
    expect(channel.featureEnabled()).toBe(true);

    configService.get.mockReturnValue({ notificationsEnabled: false });
    expect(channel.featureEnabled()).toBe(false);

    configService.get.mockReturnValue({ notificationsEnabled: true });
    whatsAppService.isConfigured.mockReturnValue(false);
    expect(channel.featureEnabled()).toBe(false);
  });

  it('skips send when WhatsApp notifications are disabled', async () => {
    configService.get.mockReturnValue({ notificationsEnabled: false });

    await expect(
      channel.send({
        to: '+237600000001',
        payload: {
          templateKey: 'order_created_business',
          variables: { orderNumber: '1' },
        },
      })
    ).resolves.toEqual({
      channel: 'whatsapp',
      status: 'skipped',
      skippedReason: 'whatsapp_disabled_or_not_configured',
    });
    expect(whatsAppService.sendTemplateMessage).not.toHaveBeenCalled();
  });

  it('fails when template key is unknown', async () => {
    templateService.resolveMetaName.mockReturnValue(null);

    await expect(
      channel.send({
        to: '+237600000001',
        payload: {
          templateKey: 'not_a_real_template',
          variables: {},
        },
      })
    ).resolves.toEqual({
      channel: 'whatsapp',
      status: 'failed',
      error: 'Unknown template key: not_a_real_template',
    });
  });

  it('sends template message when enabled and configured', async () => {
    await expect(
      channel.send({
        to: '+237600000001',
        locale: 'en',
        payload: {
          templateKey: 'order_created_business',
          variables: { orderNumber: '42', customerName: 'Ada', pickupWindow: '2pm' },
        },
      })
    ).resolves.toEqual({
      channel: 'whatsapp',
      status: 'sent',
      providerMessageId: 'wamid.1',
    });

    expect(whatsAppService.sendTemplateMessage).toHaveBeenCalledWith({
      to: '+237600000001',
      templateName: 'rs_order_new',
      languageCode: 'en_US',
      components: [],
    });
  });

  it('returns failed status when Graph send throws', async () => {
    whatsAppService.sendTemplateMessage.mockRejectedValue(
      new Error('Graph timeout')
    );

    await expect(
      channel.send({
        to: '+237600000001',
        payload: {
          templateKey: 'order_created_business',
          variables: { orderNumber: '1' },
        },
      })
    ).resolves.toEqual({
      channel: 'whatsapp',
      status: 'failed',
      error: 'Graph timeout',
    });
  });
});
