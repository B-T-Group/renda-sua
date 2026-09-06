import { HttpStatus } from '@nestjs/common';
import { LoginController } from './login.controller';

function mockRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

describe('LoginController session cookie and CSRF gates', () => {
  let loginService: {
    startLoginOtp: jest.Mock;
    verifyLoginOtp: jest.Mock;
    refreshSession: jest.Mock;
    destroySession: jest.Mock;
  };
  let controller: LoginController;

  beforeEach(() => {
    loginService = {
      startLoginOtp: jest.fn().mockResolvedValue(undefined),
      verifyLoginOtp: jest.fn(),
      refreshSession: jest.fn(),
      destroySession: jest.fn().mockResolvedValue(undefined),
    };
    controller = new LoginController(loginService as never);
  });

  it('sets an HttpOnly session cookie for web OTP verify', async () => {
    loginService.verifyLoginOtp.mockResolvedValue({
      sessionId: 'sid-1',
      response: { success: true, verified: true, access_token: 'a' },
    });
    const res = mockRes();
    const req = { ip: '9.9.9.9', headers: { 'user-agent': 'jest' } };

    const body = await controller.verifyOtp(
      { email: 'a@b.com', otp: '1234' },
      'web',
      req as never,
      res as never
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

  it('does not set a cookie for mobile OTP verify', async () => {
    loginService.verifyLoginOtp.mockResolvedValue({
      response: {
        success: true,
        refresh_token: 'refresh',
        access_token: 'a',
      },
    });
    const res = mockRes();
    await controller.verifyOtp(
      { email: 'a@b.com', otp: '1234' },
      'mobile',
      { ip: '1.1.1.1', headers: {} } as never,
      res as never
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects refresh and logout without the CSRF header', async () => {
    const res = mockRes();
    const req = { cookies: { rs_session: 'sid-1' }, headers: {} };
    await expect(
      controller.refreshSession(req as never, res as never)
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    await expect(
      controller.logout(req as never, res as never)
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(loginService.refreshSession).not.toHaveBeenCalled();
    expect(loginService.destroySession).not.toHaveBeenCalled();
  });

  it('rejects refresh when the session cookie is missing', async () => {
    await expect(
      controller.refreshSession(
        { cookies: {}, headers: {}, ip: '1.1.1.1' } as never,
        mockRes() as never,
        'XMLHttpRequest'
      )
    ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
  });

  it('rotates the cookie after a successful refresh', async () => {
    loginService.refreshSession.mockResolvedValue({
      newSessionId: 'sid-2',
      response: { success: true, access_token: 'new' },
    });
    const res = mockRes();
    const body = await controller.refreshSession(
      {
        cookies: { rs_session: 'sid-1' },
        headers: { 'user-agent': 'jest' },
        ip: '1.1.1.1',
      } as never,
      res as never,
      'XMLHttpRequest'
    );
    expect(body).toEqual({ success: true, access_token: 'new' });
    expect(res.cookie).toHaveBeenCalledWith(
      'rs_session',
      'sid-2',
      expect.objectContaining({ httpOnly: true })
    );
  });

  it('destroys the session and always clears the cookie on logout', async () => {
    const res = mockRes();
    const body = await controller.logout(
      { cookies: { rs_session: 'sid-1' }, headers: {} } as never,
      res as never,
      'XMLHttpRequest'
    );
    expect(body).toEqual({ success: true });
    expect(loginService.destroySession).toHaveBeenCalledWith('sid-1');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'rs_session',
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });
});
