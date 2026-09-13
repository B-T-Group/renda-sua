import {
  buildAvailableOtpChannels,
  maskEmailForOtp,
  maskPhoneForOtp,
} from './otp-channel.util';

describe('otp-channel.util', () => {
  it('masks email and phone for OTP responses', () => {
    expect(maskEmailForOtp('shop@example.com')).toBe('sh***@example.com');
    expect(maskPhoneForOtp('+237670000000')).toBe('••••••0000');
    expect(maskEmailForOtp('')).toBeUndefined();
    expect(maskPhoneForOtp('')).toBeUndefined();
  });

  it('builds available channels from contacts', () => {
    expect(
      buildAvailableOtpChannels({
        email: 'a@b.com',
        phoneNumber: '+237670000000',
      })
    ).toEqual(['email', 'sms']);
    expect(buildAvailableOtpChannels({ email: 'a@b.com' })).toEqual(['email']);
    expect(
      buildAvailableOtpChannels({ phoneNumber: '+237670000000' })
    ).toEqual(['sms']);
  });
});
