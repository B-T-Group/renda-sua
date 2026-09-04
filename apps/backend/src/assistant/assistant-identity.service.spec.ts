import { AssistantIdentityService } from './assistant-identity.service';

describe('AssistantIdentityService', () => {
  const hasura = {
    executeQuery: jest.fn(),
  };
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
});
