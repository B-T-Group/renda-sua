import { AssistantIdentityService } from './assistant-identity.service';

const hasura = {
  executeQuery: jest.fn(),
};

describe('AssistantIdentityService', () => {
  const service = new AssistantIdentityService(hasura as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns verified identity when phone matches a user', async () => {
    hasura.executeQuery.mockResolvedValue({
      users: [
        {
          id: 'u1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          preferred_language: 'fr',
          country: 'CM',
          phone_number: '+237600000001',
          user_type_id: 'client',
          client: { id: 'c1' },
          agent: null,
          business: null,
        },
      ],
    });
    const identity = await service.resolveFromPhone('+237600000001');
    expect(identity.isVerified).toBe(true);
    expect(identity.userId).toBe('u1');
    expect(identity.firstName).toBe('Ada');
    expect(identity.preferredLanguage).toBe('fr');
    expect(identity.country).toBe('CM');
    expect(identity.accountType).toBe('client');
    expect(identity.clientId).toBe('c1');
  });

  it('returns anonymous identity with inferred country when user is missing', async () => {
    hasura.executeQuery.mockResolvedValue({ users: [] });
    const identity = await service.resolveFromPhone('237600000099');
    expect(identity.isVerified).toBe(false);
    expect(identity.userId).toBeNull();
    expect(identity.country).toBe('CM');
  });

  it('treats anonymous userId as anonymous for app channel', async () => {
    const identity = await service.resolveFromUserId('anonymous');
    expect(identity.isVerified).toBe(false);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('uses the client market over the saved address and the phone country', async () => {
    mockIdentityQueries(clientUser, [address('ga', 'Estuaire')]);
    const identity = await service.resolveFromUserId('u1', {
      country_code: 'sn',
      state: 'Dakar',
    });
    expect(identity.market).toEqual({ country_code: 'SN', state: 'Dakar' });
    expect(identity.country).toBe('SN');
    expect(addressQueries()).toEqual([]);
  });

  it('uses the primary address when the client sends no market', async () => {
    mockIdentityQueries(clientUser, [address('ga', '')]);
    const identity = await service.resolveFromUserId('u1');
    expect(identity.market).toEqual({ country_code: 'GA' });
    expect(identity.country).toBe('GA');
    expect(addressQueries()[0][1]).toEqual({ clientId: 'c1' });
    expect(String(addressQueries()[0][0])).toContain('client_addresses');
  });

  it('falls back to the phone country when the address has no country', async () => {
    mockIdentityQueries(clientUser, [address('', 'Littoral')]);
    const identity = await service.resolveFromPhone('+237600000001');
    expect(identity.market).toEqual({ country_code: 'CM' });
    expect(identity.country).toBe('CM');
  });

  it('reads the agent address only when there is no client profile', async () => {
    mockIdentityQueries(agentUser, [address('ci', 'Lagunes')]);
    const identity = await service.resolveFromUserId('u-agent');
    expect(identity.market).toEqual({ country_code: 'CI', state: 'Lagunes' });
    expect(identity.accountType).toBe('agent');
    expect(String(addressQueries()[0][0])).toContain('agent_addresses');
    expect(addressQueries()[0][1]).toEqual({ agentId: 'a1' });
  });

  it('reads the business address for a business user', async () => {
    mockIdentityQueries(businessUser, [address('cm', null)]);
    const identity = await service.resolveFromUserId('u-biz');
    expect(identity.market).toEqual({ country_code: 'CM' });
    expect(identity.accountType).toBe('business');
    expect(String(addressQueries()[0][0])).toContain('business_addresses');
    expect(addressQueries()[0][1]).toEqual({ businessId: 'b1' });
  });

  it('prefers the client address when the user also has an agent profile', async () => {
    mockIdentityQueries(
      { ...clientUser, agent: { id: 'a1' } },
      [address('ga', 'Estuaire')]
    );
    await service.resolveFromUserId('u1');
    expect(addressQueries()).toHaveLength(1);
    expect(String(addressQueries()[0][0])).toContain('client_addresses');
  });

  it('leaves the market empty when there is no profile and the phone cannot be parsed', async () => {
    mockIdentityQueries(bareUser, []);
    const identity = await service.resolveFromPhone('not-a-phone');
    expect(identity.isVerified).toBe(true);
    expect(identity.market).toBeNull();
    expect(identity.country).toBeNull();
    expect(addressQueries()).toEqual([]);
  });

  it('keeps an anonymous session on the supplied market without a lookup', async () => {
    const market = { country_code: 'ga', state: 'Estuaire' };
    const identity = await service.resolveFromUserId('anonymous', market);
    expect(identity.isVerified).toBe(false);
    expect(identity.market).toEqual(market);
    expect(identity.country).toBe('ga');
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('keeps the supplied market when the user id is unknown', async () => {
    mockIdentityQueries(null, [address('ga', 'Estuaire')]);
    const identity = await service.resolveFromUserId('missing-user', {
      country_code: 'cm',
    });
    expect(identity.isVerified).toBe(false);
    expect(identity.market).toEqual({ country_code: 'cm' });
    expect(addressQueries()).toEqual([]);
  });

  it('uses the active persona when that profile exists', async () => {
    mockIdentityQueries(
      { ...businessUser, client: { id: 'c1' }, agent: { id: 'a1' } },
      []
    );
    const identity = await service.resolveFromUserId('u-biz', null, 'client');
    expect(identity.accountType).toBe('client');
    expect(identity.clientId).toBe('c1');
    expect(identity.agentId).toBe('a1');
    expect(identity.businessId).toBe('b1');
  });

  it('treats an active delegation as a delegate even with a business profile', async () => {
    mockIdentityQueries(businessUser, []);
    const identity = await service.resolveFromUserId('u-biz', null, null, 'grant-1');
    expect(identity.accountType).toBe('delegate');
    expect(identity.businessId).toBe('b1');
    expect(identity.userId).toBe('u-biz');
  });

  it('keeps a signed-out session free of personal ids', async () => {
    const identity = await service.resolveFromUserId(null, { country_code: 'CM' }, 'client');
    expect(identity.userId).toBeNull();
    expect(identity.accountType).toBeNull();
    expect(identity.clientId).toBeNull();
    expect(identity.agentId).toBeNull();
    expect(identity.businessId).toBeNull();
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('does not look up a user for a blank phone', async () => {
    const identity = await service.resolveFromPhone('   ');
    expect(identity.isVerified).toBe(false);
    expect(identity.market).toBeNull();
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('does not grant the client persona when that profile is missing', async () => {
    mockIdentityQueries(businessUser, []);
    const identity = await service.resolveFromUserId('u-biz', null, 'client');
    expect(identity.accountType).toBe('business');
    expect(identity.clientId).toBeNull();
  });

  it('accepts the persona in any case when the profile exists', async () => {
    mockIdentityQueries({ ...businessUser, client: { id: 'c1' } }, []);
    const identity = await service.resolveFromUserId('u-biz', null, 'CLIENT');
    expect(identity.accountType).toBe('client');
  });

  it('does not treat a blank delegation id as a delegate', async () => {
    mockIdentityQueries(businessUser, []);
    const identity = await service.resolveFromUserId('u-biz', null, 'business', '   ');
    expect(identity.accountType).toBe('business');
  });
});

function address(country: string, state: string | null) {
  return { country, state, is_primary: true };
}

function mockIdentityQueries(
  user: Record<string, unknown> | null,
  addresses: ReturnType<typeof address>[]
) {
  hasura.executeQuery.mockImplementation(async (query: string) => {
    if (query.includes('addresses')) return { addresses };
    return { users: user ? [user] : [] };
  });
}

function addressQueries() {
  return hasura.executeQuery.mock.calls.filter(([query]) =>
    String(query).includes('addresses')
  );
}

const clientUser = {
  id: 'u1',
  first_name: 'Ada',
  preferred_language: 'fr',
  phone_number: '+237600000001',
  user_type_id: 'client',
  client: { id: 'c1' },
  agent: null,
  business: null,
};

const agentUser = {
  id: 'u-agent',
  first_name: 'Bo',
  preferred_language: 'fr',
  phone_number: '+24106123456',
  user_type_id: 'agent',
  client: null,
  agent: { id: 'a1' },
  business: null,
};

const businessUser = {
  id: 'u-biz',
  first_name: 'Cleo',
  preferred_language: 'en',
  phone_number: '+237600000002',
  user_type_id: 'business',
  client: null,
  agent: null,
  business: { id: 'b1' },
};

const bareUser = {
  id: 'u-bare',
  first_name: 'Dee',
  preferred_language: null,
  phone_number: 'not-a-phone',
  user_type_id: null,
  client: null,
  agent: null,
  business: null,
};
