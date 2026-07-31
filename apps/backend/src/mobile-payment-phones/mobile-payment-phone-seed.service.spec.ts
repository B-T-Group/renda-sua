import { MobilePaymentPhoneSeedService } from './mobile-payment-phone-seed.service';

describe('MobilePaymentPhoneSeedService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const mobilePaymentsService = {
    getProvider: jest.fn(),
  };
  const paymentRoutingService = {
    resolveRailForCountry: jest.fn(),
  };

  let service: MobilePaymentPhoneSeedService;

  const phoneRow = {
    id: 'phone-1',
    user_id: 'user-1',
    phone_e164: '+237600000001',
    is_verified: false,
    verified_at: null,
    last_verification_transaction_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MobilePaymentPhoneSeedService(
      hasuraSystemService as never,
      mobilePaymentsService as never,
      paymentRoutingService as never
    );
    paymentRoutingService.resolveRailForCountry.mockResolvedValue('mobile_money');
    mobilePaymentsService.getProvider.mockReturnValue({});
  });

  it('inserts unverified phone for supported CM contact number', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      user_mobile_payment_phones: [],
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_user_mobile_payment_phones_one: phoneRow,
    });

    const created = await service.ensureFromContactPhone(
      'user-1',
      'CM',
      '+237600000001'
    );

    expect(created).toEqual(phoneRow);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertPhone'),
      expect.objectContaining({
        row: expect.objectContaining({
          user_id: 'user-1',
          phone_e164: '+237600000001',
          is_verified: false,
        }),
      })
    );
  });

  it('returns existing phone without inserting again', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      user_mobile_payment_phones: [phoneRow],
    });

    const existing = await service.ensureFromContactPhone(
      'user-1',
      '237',
      '600000001'
    );

    expect(existing).toEqual(phoneRow);
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('soft-fails for unsupported phone numbers', async () => {
    const result = await service.ensureFromContactPhone(
      'user-1',
      'US',
      '+15551234567'
    );

    expect(result).toBeNull();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('skips when payment rail is stripe', async () => {
    paymentRoutingService.resolveRailForCountry.mockResolvedValue('stripe');

    const result = await service.ensureFromContactPhone(
      'user-1',
      'CA',
      '+15145550100'
    );

    expect(result).toBeNull();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('sets phone and mobile_payment_phone_id on the location', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({});

    await service.linkPhoneToLocation('loc-1', phoneRow);

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('LinkLocPhone'),
      {
        id: 'loc-1',
        phone: '+237600000001',
        phoneId: 'phone-1',
      }
    );
  });
});
