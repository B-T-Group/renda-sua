import { SignupController } from './signup.controller';

function mockRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

describe('SignupController OTP channel and session cookie gates', () => {
  let signupService: {
    isEmailTaken: jest.Mock;
    isPhoneTaken: jest.Mock;
    resendSignupOtp: jest.Mock;
    verifySignupOtp: jest.Mock;
  };
  let controller: SignupController;

  beforeEach(() => {
    signupService = {
      isEmailTaken: jest.fn().mockResolvedValue(false),
      isPhoneTaken: jest.fn().mockResolvedValue(false),
      resendSignupOtp: jest.fn().mockResolvedValue({
        attemptId: 'attempt-123',
        channel: 'email',
        availableChannels: ['email', 'sms'],
      }),
      verifySignupOtp: jest.fn(),
    };
    controller = new SignupController(signupService as never);
  });

  it('returns taken false for blank availability queries without hitting Hasura', async () => {
    await expect(controller.emailAvailability('   ')).resolves.toEqual({
      taken: false,
    });
    await expect(controller.phoneAvailability('')).resolves.toEqual({
      taken: false,
    });
    expect(signupService.isEmailTaken).not.toHaveBeenCalled();
    expect(signupService.isPhoneTaken).not.toHaveBeenCalled();
  });

  it('forwards resend-otp attemptId and optional channel', async () => {
    signupService.resendSignupOtp.mockResolvedValue({
      attemptId: 'attempt-123',
      channel: 'sms',
      availableChannels: ['email', 'sms'],
    });
    const body = await controller.signupResendOtp(
      {
        attemptId: 'attempt-123',
        channel: 'sms',
      },
      { ip: '9.9.9.9' }
    );
    expect(signupService.resendSignupOtp).toHaveBeenCalledWith(
      'attempt-123',
      'sms',
      '9.9.9.9'
    );
    expect(body).toEqual({
      success: true,
      attemptId: 'attempt-123',
      channel: 'sms',
      availableChannels: ['email', 'sms'],
    });
  });

  it('sets an HttpOnly session cookie for web signup verify', async () => {
    signupService.verifySignupOtp.mockResolvedValue({
      sessionId: 'sid-1',
      response: { success: true, verified: true, access_token: 'a' },
    });
    const res = mockRes();

    const body = await controller.verifyOtp(
      { attemptId: 'attempt-123', otp: '1234' },
      'web',
      { ip: '9.9.9.9', headers: { 'user-agent': 'jest' } } as never,
      res as never
    );

    expect(signupService.verifySignupOtp).toHaveBeenCalledWith(
      { attemptId: 'attempt-123', otp: '1234' },
      'web',
      '9.9.9.9',
      'jest'
    );
    expect(body).toEqual({
      success: true,
      verified: true,
      access_token: 'a',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'rs_session',
      'sid-1',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
    );
  });

  it('sets SameSite=None on HTTPS for web signup verify', async () => {
    signupService.verifySignupOtp.mockResolvedValue({
      sessionId: 'sid-1',
      response: { success: true, verified: true, access_token: 'a' },
    });
    const res = mockRes();
    await controller.verifyOtp(
      { attemptId: 'attempt-123', otp: '1234' },
      'web',
      {
        ip: '9.9.9.9',
        secure: true,
        headers: { 'user-agent': 'jest', 'x-forwarded-proto': 'https' },
      } as never,
      res as never
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'rs_session',
      'sid-1',
      expect.objectContaining({ sameSite: 'none', secure: true })
    );
  });

  it('does not set a cookie for mobile signup verify', async () => {
    signupService.verifySignupOtp.mockResolvedValue({
      response: {
        success: true,
        refresh_token: 'refresh',
        access_token: 'a',
      },
    });
    const res = mockRes();
    await controller.verifyOtp(
      { attemptId: 'attempt-123', otp: '1234' },
      'mobile',
      { ip: '1.1.1.1', headers: {} } as never,
      res as never
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
