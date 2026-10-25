jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessTokenGiftsService } from './business-token-gifts.service';
import { BusinessTokensController } from './business-tokens.controller';

describe('BusinessTokenGiftsService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const businessReferrals = {
    normalizeReferralCode: jest.fn((code: string) => {
      const normalized = String(code ?? '').trim().toUpperCase();
      return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
    }),
    findUserByReferralCode: jest.fn(),
    findBusinessByCode: jest.fn(),
  };
  const agentReferrals = { findAgentByCode: jest.fn() };
  const notifications = { sendPaymentProgramNotice: jest.fn() };
  let service: BusinessTokenGiftsService;

  const businessRecipient = {
    businessId: 'biz-recipient',
    businessName: 'Secret Shop',
    userId: 'user-recipient',
    userEmail: 'owner@secret.example',
    userFirstName: 'Jane',
    userLastName: 'Doe-Smith',
    lifecycleStatus: 'active',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    businessReferrals.findUserByReferralCode.mockResolvedValue(null);
    agentReferrals.findAgentByCode.mockResolvedValue(null);
    businessReferrals.findBusinessByCode.mockResolvedValue(businessRecipient);
    notifications.sendPaymentProgramNotice.mockResolvedValue(undefined);
    hasura.executeMutation.mockResolvedValue({
      transfer_ai_tokens: [transferRow()],
    });
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('FindAiTokenGift')) {
        return Promise.resolve({ ai_token_transfers: [] });
      }
      if (query.includes('GiftTokenBalance')) {
        return Promise.resolve({
          businesses_by_pk: { ai_tokens: 50, ai_tokens_nongiftable: 20 },
        });
      }
      if (query.includes('GiftSenderName')) {
        return Promise.resolve({
          users_by_pk: { first_name: 'Sam', last_name: 'Besong' },
        });
      }
      if (query.includes('GiftRecipientLang')) {
        return Promise.resolve({
          users_by_pk: { preferred_language: 'en' },
        });
      }
      if (query.includes('BusinessForGiftRecipient')) {
        return Promise.resolve({
          businesses: [{ id: 'biz-recipient', lifecycle_status: 'active' }],
        });
      }
      return Promise.resolve({});
    });
    service = new BusinessTokenGiftsService(
      hasura as never,
      businessReferrals as never,
      agentReferrals as never,
      notifications as never
    );
  });

  it('keeps the signup allotment non-giftable when the column is missing', async () => {
    hasura.executeQuery.mockResolvedValue({ businesses_by_pk: null });

    await expect(service.getGiftableBalance('biz-1')).resolves.toEqual({
      ai_tokens: 0,
      ai_tokens_nongiftable: 20,
      giftable: 0,
    });
  });

  it('floors giftable at zero when free tokens exceed the balance', async () => {
    hasura.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens: 15, ai_tokens_nongiftable: 20 },
    });

    await expect(service.getGiftableBalance('biz-1')).resolves.toEqual({
      ai_tokens: 15,
      ai_tokens_nongiftable: 20,
      giftable: 0,
    });
  });

  it('treats a null free-token column as the signup grant', async () => {
    hasura.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens: 50, ai_tokens_nongiftable: null },
    });

    await expect(service.getGiftableBalance('biz-1')).resolves.toEqual({
      ai_tokens: 50,
      ai_tokens_nongiftable: 20,
      giftable: 30,
    });
  });

  it('returns a masked business recipient and hides the owner email', async () => {
    const result = await service.lookupRecipient(' ab12cd ', 'user-sender', 'biz-sender');

    expect(businessReferrals.findBusinessByCode).toHaveBeenCalledWith('AB12CD');
    expect(result).toEqual({
      maskedName: 'Jane D.',
      referralCode: 'AB12CD',
      recipientBusinessId: 'biz-recipient',
      recipientUserId: 'user-recipient',
    });
    expect(JSON.stringify(result)).not.toContain('Doe');
    expect(JSON.stringify(result)).not.toContain('owner@secret.example');
    expect(JSON.stringify(result)).not.toContain('Secret Shop');
  });

  it('rejects a malformed code before any lookup', async () => {
    const error = await giftError(
      service.lookupRecipient('nope', 'user-sender', 'biz-sender')
    );

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_INVALID_CODE' })
    );
    expect(businessReferrals.findUserByReferralCode).not.toHaveBeenCalled();
    expect(agentReferrals.findAgentByCode).not.toHaveBeenCalled();
    expect(businessReferrals.findBusinessByCode).not.toHaveBeenCalled();
  });

  it('rejects sending tokens to the sender business', async () => {
    const error = await giftError(
      service.lookupRecipient('AB12CD', 'user-sender', 'biz-recipient')
    );

    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_SELF' })
    );
  });

  it('rejects the sender own user code before reading a business', async () => {
    businessReferrals.findUserByReferralCode.mockResolvedValue({
      userId: 'user-sender',
      userFirstName: 'Sam',
      userLastName: 'Besong',
    });

    const error = await giftError(
      service.lookupRecipient('AB12CD', 'user-sender', 'biz-sender')
    );

    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_SELF' })
    );
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('does not confirm a suspended agent code that belongs to the sender', async () => {
    agentReferrals.findAgentByCode.mockResolvedValue({
      status: 'suspended',
      userId: 'user-sender',
      userFirstName: 'Sam',
      userLastName: 'Besong',
    });
    businessReferrals.findBusinessByCode.mockResolvedValue(null);

    const error = await giftError(
      service.lookupRecipient('AB12CD', 'user-sender', 'biz-sender')
    );

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_NOT_FOUND' })
    );
    expect(JSON.stringify(error.getResponse())).not.toContain('Besong');
  });

  it('falls through an inactive agent to the active business', async () => {
    agentReferrals.findAgentByCode.mockResolvedValue({
      status: 'paused',
      userId: 'user-other',
      userFirstName: 'Hidden',
      userLastName: 'Agent',
    });

    const result = await service.lookupRecipient('AB12CD', 'user-sender', 'biz-sender');

    expect(result.maskedName).toBe('Jane D.');
    expect(result.recipientUserId).toBe('user-recipient');
  });

  it('hides a suspended business instead of returning its name', async () => {
    businessReferrals.findBusinessByCode.mockResolvedValue({
      ...businessRecipient,
      lifecycleStatus: 'suspended',
    });

    const error = await giftError(
      service.lookupRecipient('AB12CD', 'user-sender', 'biz-sender')
    );

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(JSON.stringify(error.getResponse())).not.toContain('Secret Shop');
    expect(JSON.stringify(error.getResponse())).not.toContain('Doe');
  });

  it('refuses a user code whose business cannot receive tokens', async () => {
    businessReferrals.findUserByReferralCode.mockResolvedValue({
      userId: 'user-recipient',
      userFirstName: 'Jane',
      userLastName: 'Doe-Smith',
      userEmail: 'owner@secret.example',
    });
    hasura.executeQuery.mockResolvedValue({
      businesses: [{ id: 'biz-recipient', lifecycle_status: 'suspended' }],
    });

    const error = await giftError(
      service.lookupRecipient('AB12CD', 'user-sender', 'biz-sender')
    );

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_INELIGIBLE' })
    );
    expect(JSON.stringify(error.getResponse())).not.toContain('Doe');
    expect(JSON.stringify(error.getResponse())).not.toContain('owner@secret');
  });

  it('refuses a user code with no business', async () => {
    businessReferrals.findUserByReferralCode.mockResolvedValue({
      userId: 'user-recipient',
      userFirstName: 'Jane',
      userLastName: 'Doe-Smith',
    });
    hasura.executeQuery.mockResolvedValue({ businesses: [] });

    const error = await giftError(
      service.lookupRecipient('AB12CD', 'user-sender', 'biz-sender')
    );

    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_INELIGIBLE' })
    );
  });

  it('replays an idempotent gift without transferring or notifying again', async () => {
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('FindAiTokenGift')) {
        return Promise.resolve({
          ai_token_transfers: [{ ...transferRow(), amount: 100 }],
        });
      }
      if (query.includes('GiftTokenBalance')) {
        return Promise.resolve({
          businesses_by_pk: { ai_tokens: 50, ai_tokens_nongiftable: 20 },
        });
      }
      return Promise.resolve({});
    });

    const result = await service.sendGift({
      senderBusinessId: 'biz-sender',
      senderUserId: 'user-sender',
      code: 'AB12CD',
      amount: 500,
      idempotencyKey: '  gift-1  ',
    });

    expect(result.transfer.amount).toBe(100);
    expect(result.balance).toEqual({ ai_tokens: 50, giftable: 30 });
    expect(result.recipientMaskedName).toBe('Jane D.');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('FindAiTokenGift'),
      { businessId: 'biz-sender', key: 'gift-1' }
    );
  });

  it('transfers once and notifies in the recipient language', async () => {
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('FindAiTokenGift')) {
        return Promise.resolve({ ai_token_transfers: [] });
      }
      if (query.includes('GiftTokenBalance')) {
        return Promise.resolve({
          businesses_by_pk: { ai_tokens: 40, ai_tokens_nongiftable: 20 },
        });
      }
      if (query.includes('GiftSenderName')) {
        return Promise.resolve({
          users_by_pk: { first_name: 'Sam', last_name: 'Besong' },
        });
      }
      if (query.includes('GiftRecipientLang')) {
        return Promise.resolve({ users_by_pk: { preferred_language: 'FR' } });
      }
      return Promise.resolve({});
    });

    const result = await service.sendGift(giftParams());

    expect(result.recipientMaskedName).toBe('Jane D.');
    expect(result.balance).toEqual({ ai_tokens: 40, giftable: 20 });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('TransferAiTokens'),
      expect.objectContaining({
        senderBusinessId: 'biz-sender',
        recipientBusinessId: 'biz-recipient',
        recipientUserId: 'user-recipient',
        amount: 100,
        idempotencyKey: 'gift-1',
      })
    );
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-recipient',
        title: 'Vous avez reçu des jetons IA',
        messageType: 'AI_TOKEN_GIFT',
        entityId: 'transfer-1',
        path: '/business/ai-tokens',
      })
    );
    const notice = notifications.sendPaymentProgramNotice.mock.calls[0][0];
    expect(notice.body).toContain('Sam B.');
    expect(notice.body).not.toContain('Besong');
  });

  it('still returns the gift when the notification fails', async () => {
    notifications.sendPaymentProgramNotice.mockRejectedValue(new Error('push down'));

    await expect(service.sendGift(giftParams())).resolves.toEqual(
      expect.objectContaining({ recipientMaskedName: 'Jane D.' })
    );
  });

  it.each([
    ['ai_token_transfer_daily_limit', HttpStatus.TOO_MANY_REQUESTS, 'GIFT_DAILY_LIMIT'],
    ['ai_token_transfer_insufficient', HttpStatus.BAD_REQUEST, 'GIFT_INSUFFICIENT'],
    ['ai_token_transfer_self', HttpStatus.BAD_REQUEST, 'GIFT_SELF'],
    ['ai_token_transfer_invalid_amount', HttpStatus.BAD_REQUEST, 'GIFT_INVALID_AMOUNT'],
  ])('maps %s to %s', async (databaseError, status, code) => {
    hasura.executeMutation.mockRejectedValue(new Error(databaseError));

    const error = await giftError(service.sendGift(giftParams()));

    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code }));
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
  });

  it('hides an unexpected transfer failure and does not notify', async () => {
    hasura.executeMutation.mockRejectedValue(
      new Error('database connection reset')
    );

    const error = await giftError(service.sendGift(giftParams()));

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        code: 'GIFT_FAILED',
        error: 'Transfer failed. No tokens were deducted.',
      })
    );
    expect(JSON.stringify(error.getResponse())).not.toContain('database connection');
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
  });

  it('fails closed when the transfer returns no row', async () => {
    hasura.executeMutation.mockResolvedValue({ transfer_ai_tokens: [] });

    const error = await giftError(service.sendGift(giftParams()));

    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'GIFT_FAILED' })
    );
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
  });

  it('masks both sides of the gift history', async () => {
    hasura.executeQuery.mockResolvedValue({
      sent: [
        {
          id: 'sent-1',
          amount: 20,
          status: 'completed',
          created_at: '2026-10-24T00:00:00.000Z',
          recipient_user: { first_name: 'Jane', last_name: 'Doe-Smith' },
        },
      ],
      received: [
        {
          id: 'recv-1',
          amount: 15,
          status: 'completed',
          created_at: '2026-10-23T00:00:00.000Z',
          sender_user: null,
        },
      ],
    });

    const history = await service.listGifts('biz-1');

    expect(history.sent[0].maskedName).toBe('Jane D.');
    expect(history.received[0].maskedName).toBe('');
    expect(JSON.stringify(history)).not.toContain('Doe');
    expect(JSON.stringify(history)).not.toContain('Smith');
  });
});

describe('BusinessTokensController gift lookup', () => {
  it('returns the masked name and drops recipient ids', async () => {
    const gifts = {
      lookupRecipient: jest.fn().mockResolvedValue({
        maskedName: 'Jane D.',
        referralCode: 'AB12CD',
        recipientBusinessId: 'biz-secret',
        recipientUserId: 'user-secret',
      }),
    };
    const hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-sender',
        business: { id: 'biz-sender' },
      }),
    };
    const controller = new BusinessTokensController(
      {} as never,
      gifts as never,
      hasuraUser as never
    );

    const response = await controller.giftLookup({} as never, ' ab12cd ');

    expect(gifts.lookupRecipient).toHaveBeenCalledWith(
      ' ab12cd ',
      'user-sender',
      'biz-sender'
    );
    expect(response).toEqual({
      success: true,
      data: { maskedName: 'Jane D.', referralCode: 'AB12CD' },
    });
    expect(JSON.stringify(response)).not.toContain('biz-secret');
    expect(JSON.stringify(response)).not.toContain('user-secret');
  });
});

function transferRow() {
  return {
    id: 'transfer-1',
    amount: 100,
    status: 'completed',
    created_at: '2026-10-24T00:00:00.000Z',
    sender_business_id: 'biz-sender',
    recipient_business_id: 'biz-recipient',
    recipient_user_id: 'user-recipient',
  };
}

function giftParams() {
  return {
    senderBusinessId: 'biz-sender',
    senderUserId: 'user-sender',
    code: 'AB12CD',
    amount: 100,
    idempotencyKey: ' gift-1 ',
  };
}

async function giftError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: any) {
    expect(error).toBeInstanceOf(HttpException);
    return error;
  }
  throw new Error('expected a gift error');
}
