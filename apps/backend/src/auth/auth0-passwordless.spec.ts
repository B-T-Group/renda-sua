jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    users: { create: jest.fn() },
    jobs: { verifyEmail: jest.fn() },
  })),
}));

import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { Auth0Service } from './auth0.service';

const axiosPost = axios.post as jest.Mock;

function axiosError(status: number, data?: Record<string, unknown>) {
  const error = new Error(`Request failed with status code ${status}`) as any;
  error.response = { status, data };
  return error;
}

describe('Auth0Service passwordless error mapping', () => {
  const auth0Config = {
    domain: 'example.auth0.com',
    clientId: 'app-id',
    clientSecret: 'app-secret',
    audience: 'https://example.auth0.com/api/v2/',
  };

  function createService() {
    return new Auth0Service({
      get: jest.fn((key: string) => (key === 'auth0' ? auth0Config : undefined)),
    } as any);
  }

  beforeEach(() => {
    axiosPost.mockReset();
  });

  it('maps Auth0 passwordless start 400 to HttpException BAD_REQUEST', async () => {
    axiosPost.mockRejectedValue(
      axiosError(400, { error_description: 'The phone_number provided is not valid.' })
    );

    await expect(createService().startSmsOtp('+15555550100')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { success: false, error: 'Unable to send login code' },
    });
    expect(axiosPost).toHaveBeenCalledWith(
      'https://example.auth0.com/passwordless/start',
      expect.objectContaining({
        connection: 'sms',
        phone_number: '+15555550100',
        send: 'code',
      })
    );
  });

  it('maps Auth0 passwordless start 429 to TOO_MANY_REQUESTS', async () => {
    axiosPost.mockRejectedValue(axiosError(429));

    await expect(createService().startEmailOtp('user@example.com')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('maps Auth0 passwordless start 500 to BAD_GATEWAY', async () => {
    axiosPost.mockRejectedValue(axiosError(500));

    await expect(createService().startSmsOtp('+15555550100')).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it('maps Auth0 OTP verify 403 to HttpException BAD_REQUEST', async () => {
    axiosPost.mockRejectedValue(
      axiosError(403, { error: 'invalid_grant', error_description: 'Invalid otp.' })
    );

    await expect(
      createService().verifySmsOtp('+15555550100', '000000')
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { success: false, error: 'Invalid or expired code' },
    });
  });

  it('returns tokens when passwordless verify succeeds', async () => {
    axiosPost.mockResolvedValue({
      data: { access_token: 'tok', token_type: 'Bearer', expires_in: 60 },
    });

    await expect(
      createService().verifyEmailOtp('user@example.com', '123456')
    ).resolves.toEqual(
      expect.objectContaining({ access_token: 'tok' })
    );
  });
});
