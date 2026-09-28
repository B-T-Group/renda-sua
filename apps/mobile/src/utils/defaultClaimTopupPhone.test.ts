import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/mobilePaymentPhonesApi', () => ({
  mobilePaymentPhonesApi: { list: vi.fn() },
}));

vi.mock('../services/agentApi', () => ({
  agentApi: { users: { getMe: vi.fn() } },
}));

import { agentApi } from '../services/agentApi';
import { mobilePaymentPhonesApi } from '../services/mobilePaymentPhonesApi';
import {
  pickClaimTopupPhone,
  resolveDefaultClaimTopupPhone,
} from './defaultClaimTopupPhone';

describe('pickClaimTopupPhone', () => {
  it('uses the default linked Mobile Money number', () => {
    const actual = pickClaimTopupPhone({
      linkedPhones: [
        { phone_e164: '+237611111111', is_default: false },
        { phone_e164: '+237622222222', is_default: true },
      ],
      profilePhone: '+237600000000',
      authPhone: '+237633333333',
    });
    expect(actual).toBe('+237622222222');
  });

  it('falls back to the users-table phone, then the session phone', () => {
    expect(
      pickClaimTopupPhone({
        linkedPhones: [],
        profilePhone: '+237600000000',
        authPhone: '+237633333333',
      })
    ).toBe('+237600000000');
    expect(
      pickClaimTopupPhone({
        linkedPhones: [],
        profilePhone: '',
        authPhone: '+237633333333',
      })
    ).toBe('+237633333333');
  });
});

describe('resolveDefaultClaimTopupPhone', () => {
  beforeEach(() => {
    vi.mocked(mobilePaymentPhonesApi.list).mockReset();
    vi.mocked(agentApi.users.getMe).mockReset();
  });

  it('uses the linked Mobile Money number ahead of the session phone', async () => {
    vi.mocked(mobilePaymentPhonesApi.list).mockResolvedValue({
      success: true,
      data: { phones: [{ phone_e164: '+237622222222', is_default: true }] },
    });
    vi.mocked(agentApi.users.getMe).mockResolvedValue({
      user: { phone_number: '+237600000000' },
    } as Awaited<ReturnType<typeof agentApi.users.getMe>>);

    await expect(
      resolveDefaultClaimTopupPhone({ phoneNumber: '+237633333333' } as never)
    ).resolves.toBe('+237622222222');
  });

  it('keeps the profile phone when the phones API fails', async () => {
    vi.mocked(mobilePaymentPhonesApi.list).mockRejectedValue(new Error('down'));
    vi.mocked(agentApi.users.getMe).mockResolvedValue({
      user: { phone_number: '  +237600000000  ' },
    } as Awaited<ReturnType<typeof agentApi.users.getMe>>);

    await expect(resolveDefaultClaimTopupPhone(null)).resolves.toBe(
      '+237600000000'
    );
  });

  it('keeps the session phone when both lookups fail', async () => {
    vi.mocked(mobilePaymentPhonesApi.list).mockRejectedValue(new Error('down'));
    vi.mocked(agentApi.users.getMe).mockRejectedValue(new Error('down'));

    await expect(
      resolveDefaultClaimTopupPhone({ phoneNumber: ' +237633333333 ' } as never)
    ).resolves.toBe('+237633333333');
  });
});
