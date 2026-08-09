import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WhatsAppService } from './whatsapp.service';

jest.mock('axios', () => {
  const post = jest.fn();
  const isAxiosError = (error: unknown) =>
    !!(error as { isAxiosError?: boolean })?.isAxiosError;
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => ({ post })),
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

  beforeEach(() => {
    (axios.create as jest.Mock).mockClear();
    const configService = {
      get: jest.fn().mockReturnValue({
        webhookVerifyToken: 'verify',
        accessToken,
        phoneNumberId,
        apiVersion: 'v25.0',
      }),
    } as unknown as ConfigService;
    service = new WhatsAppService(configService);
    const created = (axios.create as jest.Mock).mock.results.at(-1)?.value;
    post = created.post as jest.Mock;
    post.mockReset();
  });

  it('isConfigured when token and phone number id are set', () => {
    expect(service.isConfigured()).toBe(true);
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
      languageCode: 'en_US',
    });

    expect(post).toHaveBeenCalledWith(
      `/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: '15551234567',
        type: 'template',
        template: {
          name: '3p_direct_integration_test_template',
          language: { code: 'en_US' },
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

  it('defaults template language to en_US and includes components', async () => {
    post.mockResolvedValue({
      data: {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.DEF' }],
      },
    });

    await service.sendTemplateMessage({
      to: ' 15559876543 ',
      templateName: 'otp_login',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: '123456' }],
        },
      ],
    });

    expect(post).toHaveBeenCalledWith(
      `/${phoneNumberId}/messages`,
      expect.objectContaining({
        to: '15559876543',
        template: {
          name: 'otp_login',
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: '123456' }],
            },
          ],
        },
      }),
      expect.any(Object)
    );
  });

  it('surfaces Graph API error messages from failed sends', async () => {
    const graphError = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        data: {
          error: { message: 'Template name does not exist in the translation' },
        },
      },
    };
    post.mockRejectedValue(graphError);

    await expect(
      service.sendTemplateMessage({
        to: '15551234567',
        templateName: 'missing_template',
        languageCode: 'en_US',
      })
    ).rejects.toThrow('Template name does not exist in the translation');
  });
});
