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

import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import configuration from '../config/configuration';
import { Auth0Service } from './auth0.service';

const mockedPost = (axios as unknown as { post: jest.Mock }).post;

describe('Auth0Service test-user OTP bypass hardening', () => {
  const originalEnv = { ...process.env };

  const auth0Config = (enabled = true) => ({
    domain: 'example.auth0.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    managementClientId: 'mgmt-id',
    managementClientSecret: 'mgmt-secret',
    audience: 'https://example.auth0.com/api/v2/',
    testUsers: {
      enabled,
      emailDomain: 'rendasua-test.com',
      emailAllowlist: [],
      phoneAllowlist: ['+237699000000'],
      phoneSuffix: '0000',
      password: 'TestPassword1!',
      emailConnection: 'Email-Test-Users',
      phoneConnection: 'Phone-Test-Users',
    },
  });

  function createService(enabled = true) {
    const cfg = auth0Config(enabled);
    return new Auth0Service({
      get: jest.fn((key: string) => (key === 'auth0' ? cfg : undefined)),
    } as unknown as ConstructorParameters<typeof Auth0Service>[0]);
  }

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.DEPLOYMENT_ENV;
    mockUsersCreate.mockReset().mockResolvedValue({});
    mockedPost.mockReset().mockResolvedValue({
      data: { access_token: 'tok', token_type: 'Bearer', expires_in: 60 },
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('logs in a test-domain email with code 0000', async () => {
    await expect(
      createService().verifyTestUserEmail('qa460@rendasua-test.com', '0000')
    ).resolves.toEqual(expect.objectContaining({ access_token: 'tok' }));
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it('logs in an allowlisted phone with code 0000', async () => {
    await expect(
      createService().verifyTestUserPhone('+237699000000', '0000')
    ).resolves.toEqual(expect.objectContaining({ access_token: 'tok' }));
  });

  it.each(['1234', '000000', '', '0001'])(
    'rejects any code other than 0000 (%p) without touching Auth0',
    async (code) => {
      const service = createService();
      await expect(
        service.verifyTestUserEmail('qa460@rendasua-test.com', code)
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      await expect(
        service.verifyTestUserPhone('+237699000000', code)
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(mockUsersCreate).not.toHaveBeenCalled();
      expect(mockedPost).not.toHaveBeenCalled();
    }
  );

  it('logs in a phone ending in 0000 with code 0000', async () => {
    const service = createService();
    expect(service.isTestPhone('+237654100000')).toBe(true);
    await expect(
      service.verifyTestUserPhone('+237654100000', '0000')
    ).resolves.toEqual(expect.objectContaining({ access_token: 'tok' }));
  });

  it('rejects non-test emails even with 0000', async () => {
    await expect(
      createService().verifyTestUserEmail('someone+mm@gmail.com', '0000')
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('refuses when the feature flag is off', async () => {
    const service = createService(false);
    expect(service.isTestUsersEnabled()).toBe(false);
    await expect(
      service.verifyTestUserEmail('qa460@rendasua-test.com', '0000')
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
  });

  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: 'development', DEPLOYMENT_ENV: 'production' },
  ])('is hard-disabled in production (%p) even if config says enabled', async (env) => {
    Object.assign(process.env, env);
    const service = createService(true);
    expect(service.isTestUsersEnabled()).toBe(false);
    await expect(
      service.verifyTestUserEmail('qa460@rendasua-test.com', '0000')
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  describe('configuration()', () => {
    it('never enables test users when DEPLOYMENT_ENV is production', () => {
      process.env.AUTH0_TEST_USERS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';
      process.env.DEPLOYMENT_ENV = 'production';
      expect(configuration().auth0.testUsers.enabled).toBe(false);
    });

    it('never enables test users when NODE_ENV is production', () => {
      process.env.AUTH0_TEST_USERS_ENABLED = 'true';
      process.env.NODE_ENV = 'production';
      expect(configuration().auth0.testUsers.enabled).toBe(false);
    });

    it('parses the allowlists and defaults the phone suffix to 0000', () => {
      process.env.AUTH0_TEST_USERS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';
      process.env.DEPLOYMENT_ENV = 'development';
      process.env.AUTH0_TEST_PHONE_ALLOWLIST = '+237699000000, +15145550000';
      process.env.AUTH0_TEST_EMAIL_ALLOWLIST = '';
      delete process.env.AUTH0_TEST_PHONE_SUFFIX;
      const testUsers = configuration().auth0.testUsers;
      expect(testUsers.enabled).toBe(true);
      expect(testUsers.phoneAllowlist).toEqual(['+237699000000', '+15145550000']);
      expect(testUsers.emailAllowlist).toEqual([]);
      expect(testUsers.phoneSuffix).toBe('0000');
    });
  });
});
