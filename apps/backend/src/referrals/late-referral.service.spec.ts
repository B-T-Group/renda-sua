jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { LateReferralService } from './late-referral.service';

const NOW = new Date('2026-10-25T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('LateReferralService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const businessReferrals = { resolveBusinessReferralCode: jest.fn() };
  const notifications = { sendPaymentProgramNotice: jest.fn() };
  let service: LateReferralService;

  const agentResolved = {
    kind: 'agent' as const,
    agentId: 'ref-agent',
    userId: 'ref-user',
    normalizedCode: 'AB12CD',
    userEmail: 'ada@secret.example',
    userFirstName: 'Ada',
    preferredLanguage: 'en',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    notifications.sendPaymentProgramNotice.mockResolvedValue(undefined);
    businessReferrals.resolveBusinessReferralCode.mockResolvedValue(agentResolved);
    hasura.executeMutation.mockResolvedValue({
      update_agents: { affected_rows: 1 },
      update_businesses: { affected_rows: 1 },
    });
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: {
        agents: [openAgent()],
        businesses: [],
      },
      LateReferralCircular: { agents: [], businesses: [] },
      LateReferralLastName: { users_by_pk: { last_name: 'Lovelace' } },
      LateReferredName: {
        users_by_pk: {
          first_name: 'Grace',
          last_name: 'Hopper',
          preferred_language: 'en',
        },
      },
    });
    service = new LateReferralService(
      hasura as never,
      businessReferrals as never,
      notifications as never
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lets an agent enter a code inside the 30-day window', async () => {
    const status = await service.getStatus('user-1');

    expect(status).toEqual({
      canEnter: true,
      locked: false,
      expired: false,
      maskedReferrerName: null,
      accountCreatedAt: daysAgo(1),
      windowEndsAt: new Date(new Date(daysAgo(1)).getTime() + 30 * DAY_MS).toISOString(),
    });
  });

  it('keeps the window open at exactly 30 days', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(30) } },
      LateReferralPersonas: { agents: [openAgent()], businesses: [] },
    });

    const status = await service.getStatus('user-1');

    expect(status.canEnter).toBe(true);
    expect(status.expired).toBe(false);
  });

  it('closes the window one millisecond after 30 days', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(30, 1) } },
      LateReferralPersonas: { agents: [openAgent()], businesses: [] },
    });

    const status = await service.getStatus('user-1');

    expect(status.canEnter).toBe(false);
    expect(status.expired).toBe(true);
    expect(status.locked).toBe(false);
  });

  it('does not offer the form to a client with no agent or business', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: { agents: [], businesses: [] },
    });

    const status = await service.getStatus('user-1');

    expect(status).toEqual(
      expect.objectContaining({
        canEnter: false,
        locked: false,
        expired: false,
        maskedReferrerName: null,
      })
    );
  });

  it('locks a persona that already has a referrer and masks the name', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(40) } },
      LateReferralPersonas: {
        agents: [
          {
            id: 'agent-1',
            referred_by_agent_id: null,
            referred_by_business_id: 'biz-ref',
            referral_code_used: 'OLD123',
          },
        ],
        businesses: [
          {
            id: 'biz-1',
            referred_by_agent_id: null,
            referred_by_business_id: null,
          },
        ],
      },
      LateReferrerBusiness: {
        businesses_by_pk: {
          user: { first_name: 'Ada', last_name: 'Lovelace' },
        },
      },
    });

    const status = await service.getStatus('user-1');

    expect(status.locked).toBe(true);
    expect(status.expired).toBe(false);
    expect(status.canEnter).toBe(false);
    expect(status.maskedReferrerName).toBe('Ada L.');
    expect(JSON.stringify(status)).not.toContain('Lovelace');
    expect(hasura.executeQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('LateReferrerAgent'),
      expect.anything()
    );
  });

  it('says the referrer is unavailable when the linked user is missing', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: {
        agents: [
          {
            id: 'agent-1',
            referred_by_agent_id: 'ref-agent',
            referred_by_business_id: null,
          },
        ],
        businesses: [],
      },
      LateReferrerAgent: { agents_by_pk: { user: null } },
    });

    const status = await service.getStatus('user-1');

    expect(status.maskedReferrerName).toBe('Referrer unavailable');
  });

  it('returns 404 when the account row is missing', async () => {
    installQueries(hasura, { LateReferralUser: { users_by_pk: null } });

    const error = await lateError(service.getStatus('missing'));

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ error: 'User not found' })
    );
  });

  it('rejects a client lookup with the expired-window error', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: { agents: [], businesses: [] },
    });

    const error = await lateError(service.lookup('user-1', 'AB12CD'));

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'EXPIRED' }));
    expect(businessReferrals.resolveBusinessReferralCode).not.toHaveBeenCalled();
  });

  it('rejects a locked account before resolving the code', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: {
        agents: [
          {
            id: 'agent-1',
            referred_by_agent_id: 'ref-agent',
            referred_by_business_id: null,
          },
        ],
        businesses: [],
      },
      LateReferrerAgent: {
        agents_by_pk: { user: { first_name: 'Ada', last_name: 'Lovelace' } },
      },
    });

    const error = await lateError(service.apply('user-1', 'AB12CD'));

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'ALREADY_SET' })
    );
    expect(businessReferrals.resolveBusinessReferralCode).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('does not accept a personal user code', async () => {
    businessReferrals.resolveBusinessReferralCode.mockResolvedValue({
      kind: 'user',
      userId: 'other-user',
      normalizedCode: 'AB12CD',
      userEmail: 'hidden@secret.example',
      userFirstName: 'Hidden',
      preferredLanguage: 'en',
    });

    const error = await lateError(service.lookup('user-1', 'AB12CD'));

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(JSON.stringify(error.getResponse())).not.toContain('hidden@secret');
    expect(JSON.stringify(error.getResponse())).not.toContain('Hidden');
  });

  it('returns only the masked referrer name on lookup', async () => {
    const result = await service.lookup('user-1', 'ab12cd');

    expect(businessReferrals.resolveBusinessReferralCode).toHaveBeenCalledWith(
      'ab12cd',
      'user-1'
    );
    expect(result).toEqual({ maskedName: 'Ada L.' });
    expect(JSON.stringify(result)).not.toContain('Lovelace');
    expect(JSON.stringify(result)).not.toContain('ada@secret');
  });

  it('rejects a circular referrer and does not write', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: { agents: [openAgent()], businesses: [] },
      LateReferralCircular: { agents: [{ id: 'loop' }], businesses: [] },
    });

    const error = await lateError(service.apply('user-1', 'AB12CD'));

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'CIRCULAR' }));
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('LateReferralCircular'),
      { referrerUserId: 'ref-user', userId: 'user-1' }
    );
  });

  it('writes the agent referrer and notifies with a masked name', async () => {
    const result = await service.apply('user-1', 'AB12CD');

    expect(result).toEqual({ maskedName: 'Ada L.' });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('LateApplyAgentReferral'),
      {
        id: 'agent-1',
        agentId: 'ref-agent',
        businessId: null,
        code: 'AB12CD',
        appliedAt: NOW.toISOString(),
      }
    );
    const mutation = hasura.executeMutation.mock.calls[0][0] as string;
    expect(mutation).toContain('referred_by_agent_id: { _is_null: true }');
    expect(mutation).toContain('referred_by_business_id: { _is_null: true }');
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'ref-user',
        title: 'New referral',
        messageType: 'LATE_REFERRAL_APPLIED',
        entityId: 'user-1',
      })
    );
    const body = notifications.sendPaymentProgramNotice.mock.calls[0][0].body;
    expect(body).toContain('Grace H.');
    expect(body).not.toContain('Hopper');
  });

  it('writes a business referrer onto the business persona only', async () => {
    businessReferrals.resolveBusinessReferralCode.mockResolvedValue({
      kind: 'business',
      businessId: 'ref-biz',
      businessName: 'Referrer Shop',
      normalizedCode: 'BIZ123',
      userId: 'ref-user',
      userEmail: 'shop@secret.example',
      userFirstName: 'Pat',
      preferredLanguage: 'fr',
    });
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(2) } },
      LateReferralPersonas: { agents: [], businesses: [openBusiness()] },
      LateReferralCircular: { agents: [], businesses: [] },
      LateReferralLastName: { users_by_pk: { last_name: 'Kim' } },
      LateReferredName: {
        users_by_pk: {
          first_name: 'Grace',
          last_name: 'Hopper',
          preferred_language: 'en',
        },
      },
    });

    const result = await service.apply('user-1', 'BIZ123');

    expect(result.maskedName).toBe('Pat K.');
    expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('LateApplyBusinessReferral'),
      {
        id: 'biz-1',
        agentId: null,
        businessId: 'ref-biz',
        code: 'BIZ123',
        appliedAt: NOW.toISOString(),
      }
    );
    expect(notifications.sendPaymentProgramNotice.mock.calls[0][0].title).toBe(
      'Nouveau filleul'
    );
  });

  it('treats a lost conditional update as already applied', async () => {
    hasura.executeMutation.mockResolvedValue({
      update_agents: { affected_rows: 0 },
    });

    const error = await lateError(service.apply('user-1', 'AB12CD'));

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'ALREADY_SET' })
    );
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
  });

  it('notifies once when one persona update lands and the other loses the race', async () => {
    installQueries(hasura, {
      LateReferralUser: { users_by_pk: { created_at: daysAgo(1) } },
      LateReferralPersonas: {
        agents: [openAgent()],
        businesses: [openBusiness()],
      },
      LateReferralCircular: { agents: [], businesses: [] },
      LateReferralLastName: { users_by_pk: { last_name: 'Lovelace' } },
      LateReferredName: {
        users_by_pk: { first_name: 'Grace', last_name: 'Hopper' },
      },
    });
    hasura.executeMutation.mockImplementation((query: string) => {
      if (query.includes('LateApplyAgentReferral')) {
        return Promise.resolve({ update_agents: { affected_rows: 1 } });
      }
      return Promise.resolve({ update_businesses: { affected_rows: 0 } });
    });

    await expect(service.apply('user-1', 'AB12CD')).resolves.toEqual({
      maskedName: 'Ada L.',
    });
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledTimes(1);
  });

  it('keeps the applied code when the referrer notification fails', async () => {
    notifications.sendPaymentProgramNotice.mockRejectedValue(new Error('push down'));

    await expect(service.apply('user-1', 'AB12CD')).resolves.toEqual({
      maskedName: 'Ada L.',
    });
  });
});

function daysAgo(days: number, extraMs = 0): string {
  return new Date(NOW.getTime() - days * DAY_MS - extraMs).toISOString();
}

function openAgent() {
  return {
    id: 'agent-1',
    referred_by_agent_id: null,
    referred_by_business_id: null,
    referral_code_used: null,
  };
}

function openBusiness() {
  return {
    id: 'biz-1',
    referred_by_agent_id: null,
    referred_by_business_id: null,
    referral_code_used: null,
  };
}

function installQueries(
  hasura: { executeQuery: jest.Mock },
  handlers: Record<string, unknown>
) {
  hasura.executeQuery.mockImplementation((text: string) => {
    const name = Object.keys(handlers).find((key) => text.includes(key));
    return Promise.resolve(name ? handlers[name] : {});
  });
}

async function lateError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: any) {
    expect(error).toBeInstanceOf(HttpException);
    return error;
  }
  throw new Error('expected a late referral error');
}
