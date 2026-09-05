import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WhatsAppService } from './whatsapp.service';

jest.mock('axios', () => {
  const post = jest.fn();
  const get = jest.fn();
  const isAxiosError = (error: unknown) =>
    !!(error as { isAxiosError?: boolean })?.isAxiosError;
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => ({ post, get })),
      isAxiosError,
    },
    isAxiosError,
  };
});

describe('WhatsAppService', () => {
  const accessToken = 'wa-token';
  const phoneNumberId = '1234567890';
  let service: WhatsAppService;
  let post: jest.Mock;
  let get: jest.Mock;

  beforeEach(() => {
    (axios.create as jest.Mock).mockClear();
    const configService = {
      get: jest.fn().mockReturnValue({
        webhookVerifyToken: 'verify',
        accessToken,
        phoneNumberId,
        apiVersion: 'v25.0',
        appSecret: 'app-secret',
        notificationsEnabled: true,
      }),
    } as unknown as ConfigService;
    service = new WhatsAppService(configService);
    const created = (axios.create as jest.Mock).mock.results.at(-1)?.value;
    post = created.post as jest.Mock;
    get = created.get as jest.Mock;
    post.mockReset();
    get.mockReset();
  });

  it('isConfigured when token, phone number id, and app secret are set', () => {
    expect(service.isConfigured()).toBe(true);
  });

  it('is not configured when app secret is missing', () => {
    const configService = {
      get: jest.fn().mockReturnValue({
        webhookVerifyToken: 'verify',
        accessToken,
        phoneNumberId,
        apiVersion: 'v25.0',
        appSecret: '',
        notificationsEnabled: true,
      }),
    } as unknown as ConfigService;
    expect(new WhatsAppService(configService).isConfigured()).toBe(false);
  });

  it('sends a template message via Graph API', async () => {
    post.mockResolvedValue({
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.ABC', message_status: 'accepted' }],
      },
    });

    const result = await service.sendTemplateMessage({
      to: '+15551234567',
      templateName: '3p_direct_integration_test_template',
      languageCode: 'en',
    });

    expect(post).toHaveBeenCalledWith(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '15551234567',
        type: 'template',
        template: {
          name: '3p_direct_integration_test_template',
          language: { code: 'en' },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    expect(result.messages[0]?.id).toBe('wamid.ABC');
  });

  it('defaults to the en translation, which is the one Meta approved', async () => {
    post.mockResolvedValue({ data: { messages: [{ id: 'wamid.ABC' }] } });

    await service.sendTemplateMessage({
      to: '15551234567',
      templateName: 'rs_admin_order_risk',
    });

    expect(post.mock.calls[0][1]).toMatchObject({
      template: { language: { code: 'en' } },
    });
  });

  describe('marketing templates', () => {
    const sendMarketing = async (marketingMessagesApiEnabled: boolean) => {
      const configService = {
        get: jest.fn().mockReturnValue({
          webhookVerifyToken: 'verify',
          accessToken,
          phoneNumberId,
          apiVersion: 'v25.0',
          appSecret: 'app-secret',
          notificationsEnabled: true,
          marketingMessagesApiEnabled,
        }),
      } as unknown as ConfigService;
      const marketingService = new WhatsAppService(configService);
      const created = (axios.create as jest.Mock).mock.results.at(-1)?.value;
      const marketingPost = created.post as jest.Mock;
      marketingPost.mockReset();
      marketingPost.mockResolvedValue({
        data: { messages: [{ id: 'wamid.MKT' }] },
      });

      await marketingService.sendTemplateMessage({
        to: '15551234567',
        templateName: 'rs_delivery_offer',
        languageCode: 'fr',
        category: 'MARKETING',
      });
      return marketingPost;
    };

    it('routes through the Marketing Messages API once onboarded', async () => {
      const marketingPost = await sendMarketing(true);
      expect(marketingPost.mock.calls[0][0]).toBe(
        `/${phoneNumberId}/marketing_messages`
      );
    });

    it('falls back to Cloud API before onboarding', async () => {
      const marketingPost = await sendMarketing(false);
      expect(marketingPost.mock.calls[0][0]).toBe(`/${phoneNumberId}/messages`);
    });
  });

  it('throws when WhatsApp is not configured', async () => {
    const configService = {
      get: jest.fn().mockReturnValue({
        webhookVerifyToken: '',
        accessToken: '',
        phoneNumberId: '',
        apiVersion: 'v25.0',
      }),
    } as unknown as ConfigService;
    const unconfigured = new WhatsAppService(configService);

    await expect(
      unconfigured.sendTemplateMessage({
        to: '15551234567',
        templateName: 'hello',
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sends free-form session text via Cloud API', async () => {
    post.mockResolvedValue({
      data: { messages: [{ id: 'wamid.TEXT' }] },
    });
    const result = await service.sendSessionText({
      to: '+15557654321',
      body: 'Thanks for writing in!',
    });
    expect(post).toHaveBeenCalledWith(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '15557654321',
        type: 'text',
        text: { preview_url: false, body: 'Thanks for writing in!' },
      },
      expect.any(Object)
    );
    expect(result.messages[0]?.id).toBe('wamid.TEXT');
  });

  it('downloads media via Graph meta then the temporary file URL', async () => {
    const fileUrl = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1';
    get
      .mockResolvedValueOnce({
        data: { url: fileUrl, mime_type: 'image/jpeg', id: 'media-1' },
      })
      .mockResolvedValueOnce({
        data: Buffer.from('jpeg-bytes'),
      });

    const result = await service.downloadMedia('media-1');

    expect(get).toHaveBeenNthCalledWith(
      1,
      '/media-1',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      fileUrl,
      expect.objectContaining({
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.buffer.toString()).toBe('jpeg-bytes');
  });

  it('maps missing Graph media to NotFoundException', async () => {
    get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: { message: 'gone' } } },
      message: 'Request failed',
    });
    await expect(service.downloadMedia('expired')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
