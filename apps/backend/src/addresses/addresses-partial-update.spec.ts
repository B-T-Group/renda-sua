import { HttpException, HttpStatus } from '@nestjs/common';
import { AddressesService } from './addresses.service';

describe('AddressesService.updateAddress partial PATCH', () => {
  const existing = {
    id: 'addr-1',
    address_line_1: '12 Market St',
    address_line_2: 'Suite 2',
    city: 'Douala',
    state: 'Littoral',
    postal_code: '00000',
    country: 'CM',
    is_primary: true,
    address_type: 'home',
  };

  function createService() {
    const hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        active_persona: 'client',
        client: { id: 'client-1' },
      }),
    };
    const hasuraSystem = {
      executeMutation: jest.fn().mockResolvedValue({
        update_addresses_by_pk: { ...existing, instructions: 'Leave at door' },
      }),
      executeQuery: jest.fn().mockResolvedValue({
        client_addresses: [{ id: 'link-1' }],
        agent_addresses: [],
        business_addresses: [],
      }),
    };
    const service = new AddressesService(
      hasuraUser as any,
      hasuraSystem as any,
      {} as any,
      { get: jest.fn() } as any
    );
    jest.spyOn(service as any, 'getAddressesByIds').mockResolvedValue([existing]);
    jest.spyOn(service as any, 'ensureSinglePrimaryAddress').mockResolvedValue(undefined);
    return { service, hasuraSystem };
  }

  it('sends only provided fields in addresses_set_input', async () => {
    const { service, hasuraSystem } = createService();

    await service.updateAddress('addr-1', { instructions: 'Leave at door' });

    expect(hasuraSystem.executeMutation).toHaveBeenCalledTimes(1);
    const [mutation, variables] = hasuraSystem.executeMutation.mock.calls[0];
    expect(mutation).toContain('$set: addresses_set_input!');
    expect(variables).toEqual({
      addressId: 'addr-1',
      set: { instructions: 'Leave at door' },
    });
  });

  it('does not wipe required columns when only toggling primary', async () => {
    const { service, hasuraSystem } = createService();

    await service.updateAddress('addr-1', { is_primary: true });

    const [, variables] = hasuraSystem.executeMutation.mock.calls[0];
    expect(variables.set).toEqual({ is_primary: true });
    expect(variables.set).not.toHaveProperty('city');
    expect(variables.set).not.toHaveProperty('country');
    expect(variables.set).not.toHaveProperty('postal_code');
  });

  it('skips Hasura when the PATCH has no persistable fields', async () => {
    const { service, hasuraSystem } = createService();

    const result = await service.updateAddress('addr-1', {});

    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
    expect(result.address).toEqual(existing);
  });

  it('remaps unexpected Hasura errors with a Sentry-readable message', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockRejectedValue(
      new Error('null value in column "city" of relation "addresses"')
    );

    await expect(
      service.updateAddress('addr-1', { instructions: 'x' })
    ).rejects.toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    try {
      await service.updateAddress('addr-1', { instructions: 'x' });
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).toContain('null value in column "city"');
    }
  });
});
