import { HasuraSystemService } from './hasura-system.service';

describe('HasuraSystemService.insertUserWithPersonas', () => {
  const configService = {
    get: (key: string) =>
      key === 'hasura'
        ? { endpoint: 'http://localhost:8080/v1/graphql', adminSecret: 'test' }
        : undefined,
  };

  function serviceWithInsertSpy() {
    const service = new HasuraSystemService(configService as never);
    const executeMutation = jest
      .spyOn(service, 'executeMutation')
      .mockResolvedValue({
        insert_users_one: {
          id: 'user-1',
          email: 'owner@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: null,
          phone_number_verified: false,
          email_verified: false,
          user_type_id: 'business',
          created_at: '2026-10-25T00:00:00.000Z',
          updated_at: '2026-10-25T00:00:00.000Z',
          business: { id: 'biz-1' },
        },
      });
    return { service, executeMutation };
  }

  it('grants 20 free tokens that cannot be gifted', async () => {
    const { service, executeMutation } = serviceWithInsertSpy();

    await service.insertUserWithPersonas({
      first_name: 'Ada',
      last_name: 'Lovelace',
      personas: ['business'],
      business_name: 'Shop',
    });

    const [mutation, variables] = executeMutation.mock.calls[0];
    expect(variables.ai_tokens).toBe(20);
    expect(variables.ai_tokens_nongiftable).toBe(20);
    expect(mutation).toContain('ai_tokens_nongiftable: $ai_tokens_nongiftable');
    expect(variables.referral_applied_at).toBeUndefined();
    expect(mutation).not.toContain('referral_applied_at');
  });

  it('stamps referral_applied_at when a business signup uses a code', async () => {
    const { service, executeMutation } = serviceWithInsertSpy();

    await service.insertUserWithPersonas({
      first_name: 'Ada',
      last_name: 'Lovelace',
      personas: ['business'],
      business_name: 'Shop',
      business_referral_business_id: 'biz-ref',
      business_referral_code_used: 'AB12CD',
    });

    const [mutation, variables] = executeMutation.mock.calls[0];
    expect(variables.ai_tokens_nongiftable).toBe(20);
    expect(variables.referral_applied_at).toEqual(expect.any(String));
    expect(mutation).toContain('referral_applied_at: $referral_applied_at');
    expect(variables.referred_by_business_id).toBe('biz-ref');
    expect(variables.referral_code_used).toBe('AB12CD');
  });
});
