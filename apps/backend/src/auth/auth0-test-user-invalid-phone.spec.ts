jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockUsersCreate = jest.fn();

jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    users: { create: (...args: unknown[]) => mockUsersCreate(...args) },
    jobs: { verifyEmail: jest.fn() },
  })),
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { Auth0Service } from './auth0.service';

describe('Auth0Service.ensureTestUser invalid phone', () => {
  const auth0Config = {
    domain: 'example.auth0.com',
    managementClientId: 'mgmt-id',
    managementClientSecret: 'mgmt-secret',
    audience: 'https://example.auth0.com/api/v2/',
    testUsers: {
      enabled: true,
      emailDomain: 'test.rendasua.com',
      phoneSuffix: '5555',
      password: 'TestPassword1!',
      emailConnection: 'email',
      phoneConnection: 'sms',
    },
  };

  function createService() {
    return new Auth0Service({
      get: jest.fn((key: string) => (key === 'auth0' ? auth0Config : undefined)),
    } as any);
  }

  beforeEach(() => {
    mockUsersCreate.mockReset();
  });

  it('maps Auth0 400 invalid phone to HttpException BAD_REQUEST', async () => {
    mockUsersCreate.mockRejectedValue({
      statusCode: 400,
      message: 'Invalid phone number',
    });
    const service = createService();

    await expect(
      service.verifyTestUserPhone('+10000000000')
    ).rejects.toBeInstanceOf(HttpException);
    await expect(service.verifyTestUserPhone('+10000000000')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('treats Auth0 409 as an existing test user and continues login', async () => {
    const axios = require('axios').default as { post: jest.Mock };
    mockUsersCreate.mockRejectedValue({ statusCode: 409 });
    axios.post.mockResolvedValue({
      data: { access_token: 'tok', token_type: 'Bearer', expires_in: 60 },
    });
    const service = createService();

    await expect(service.verifyTestUserPhone('+15555555555')).resolves.toEqual(
      expect.objectContaining({ access_token: 'tok' })
    );
  });
});
