import { resolveSignupOtpChannel } from './signup-channel.util';

describe('resolveSignupOtpChannel', () => {
  it('prefers SMS for African markets when phone is present', () => {
    expect(
      resolveSignupOtpChannel({
        email: 'a@example.com',
        phoneNumber: '+237600000001',
        country: 'CM',
      })
    ).toBe('sms');
  });

  it('prefers email for Stripe markets even when phone is present', () => {
    expect(
      resolveSignupOtpChannel({
        email: 'a@example.com',
        phoneNumber: '+14155550123',
        country: 'CA',
      })
    ).toBe('email');
  });

  it('honors an explicit preferred channel when contact exists', () => {
    expect(
      resolveSignupOtpChannel({
        email: 'a@example.com',
        phoneNumber: '+237600000001',
        country: 'CM',
        preferred: 'email',
      })
    ).toBe('email');
  });
});
