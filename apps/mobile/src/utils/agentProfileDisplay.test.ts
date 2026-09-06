import { describe, expect, it } from 'vitest';
import { agentDisplayName, agentInitial, maskEmail, maskPhoneE164 } from './agentProfileDisplay';

describe('maskEmail', () => {
  it('masks local part and keeps domain', () => {
    expect(maskEmail('joanna@example.com')).toBe('jo••••@example.com');
  });

  it('returns short or invalid input mostly unchanged', () => {
    expect(maskEmail('a@b.co')).toBe('a@b.co');
  });
});

describe('maskPhoneE164', () => {
  it('returns short input unchanged', () => {
    expect(maskPhoneE164('+33')).toBe('+33');
  });

  it('masks a typical E.164 number', () => {
    const m = maskPhoneE164('+33612345678');
    expect(m).toContain('••••');
    expect(m.endsWith('78')).toBe(true);
  });
});

describe('agentDisplayName', () => {
  it('prefers full name', () => {
    expect(agentDisplayName({ firstName: 'A', lastName: 'B', email: 'x@y.com', phoneNumber: '+1' })).toBe('A B');
  });

  it('falls back to email then phone', () => {
    expect(agentDisplayName({ firstName: '', lastName: '', email: 'a@b.co', phoneNumber: '+100' })).toBe('a@b.co');
    expect(agentDisplayName({ firstName: '', lastName: '', email: '', phoneNumber: '+15551234567' })).toBe(
      '+15551234567'
    );
  });
});

describe('agentInitial', () => {
  it('uses first digit of national number for phone-only', () => {
    expect(agentInitial({ firstName: '', lastName: '', email: '', phoneNumber: '+15551230000' })).toBe('1');
  });
});
