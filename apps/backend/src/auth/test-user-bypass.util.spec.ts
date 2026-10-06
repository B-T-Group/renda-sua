import {
  isProductionRuntime,
  isValidTestOtp,
  matchesTestEmail,
  matchesTestPhone,
  parseTestAllowlist,
  TEST_USER_OTP_CODE,
} from './test-user-bypass.util';

const config = {
  emailDomain: 'rendasua-test.com',
  emailAllowlist: ['qa.partner@example.com'],
  phoneAllowlist: ['+237699000000', '+1 514 555 0000'],
};

describe('test-user bypass rules', () => {
  describe('matchesTestEmail', () => {
    it('matches the exact test domain, case-insensitively', () => {
      expect(matchesTestEmail('qa460-agent@rendasua-test.com', config)).toBe(true);
      expect(matchesTestEmail(' QA@Rendasua-Test.COM ', config)).toBe(true);
    });

    it('rejects look-alike and sub/parent domains', () => {
      expect(matchesTestEmail('x@rendadua-test.com', config)).toBe(false);
      expect(matchesTestEmail('x@sub.rendasua-test.com', config)).toBe(false);
      expect(matchesTestEmail('x@rendasua-test.com.evil.io', config)).toBe(false);
      expect(matchesTestEmail('rendasua-test.com', config)).toBe(false);
      expect(matchesTestEmail('', config)).toBe(false);
      expect(matchesTestEmail(null, config)).toBe(false);
    });

    it('rejects real addresses unless explicitly allowlisted', () => {
      expect(matchesTestEmail('someone+mm@gmail.com', config)).toBe(false);
      expect(matchesTestEmail('QA.Partner@example.com', config)).toBe(true);
    });

    it('matches nothing by domain when the domain is blank', () => {
      expect(
        matchesTestEmail('x@rendasua-test.com', { ...config, emailDomain: '' })
      ).toBe(false);
    });
  });

  describe('matchesTestPhone', () => {
    it('matches only exact allowlisted numbers (format-insensitive)', () => {
      expect(matchesTestPhone('+237699000000', config)).toBe(true);
      expect(matchesTestPhone('237 699 00 00 00', config)).toBe(true);
      expect(matchesTestPhone('+15145550000', config)).toBe(true);
    });

    it('does NOT match other numbers that merely end in 0000', () => {
      expect(matchesTestPhone('+237654100000', config)).toBe(false);
      expect(matchesTestPhone('+237670000000', config)).toBe(false);
      expect(matchesTestPhone('99000000', config)).toBe(false);
    });

    it('matches nothing with an empty allowlist', () => {
      expect(
        matchesTestPhone('+237699000000', { ...config, phoneAllowlist: [] })
      ).toBe(false);
      expect(matchesTestPhone('', config)).toBe(false);
    });
  });

  describe('isValidTestOtp', () => {
    it('accepts only 0000', () => {
      expect(TEST_USER_OTP_CODE).toBe('0000');
      expect(isValidTestOtp('0000')).toBe(true);
      expect(isValidTestOtp(' 0000 ')).toBe(true);
      for (const code of ['', '1234', '000000', '00000', '000', 'abcd']) {
        expect(isValidTestOtp(code)).toBe(false);
      }
      expect(isValidTestOtp(undefined)).toBe(false);
      expect(isValidTestOtp(null)).toBe(false);
    });
  });

  describe('isProductionRuntime', () => {
    it('is true when either NODE_ENV or DEPLOYMENT_ENV is production', () => {
      expect(isProductionRuntime({ NODE_ENV: 'production' })).toBe(true);
      expect(
        isProductionRuntime({ NODE_ENV: 'development', DEPLOYMENT_ENV: 'production' })
      ).toBe(true);
      expect(isProductionRuntime({ NODE_ENV: ' Production ' })).toBe(true);
    });

    it('is false for development / test', () => {
      expect(
        isProductionRuntime({ NODE_ENV: 'development', DEPLOYMENT_ENV: 'development' })
      ).toBe(false);
      expect(isProductionRuntime({ NODE_ENV: 'test' })).toBe(false);
      expect(isProductionRuntime({})).toBe(false);
    });
  });

  describe('parseTestAllowlist', () => {
    it('splits on commas / whitespace and drops blanks', () => {
      expect(parseTestAllowlist(' a@x.com, +237699000000 ,,b@y.com ')).toEqual([
        'a@x.com',
        '+237699000000',
        'b@y.com',
      ]);
      expect(parseTestAllowlist('')).toEqual([]);
      expect(parseTestAllowlist(undefined)).toEqual([]);
    });
  });
});
