import { ForbiddenException, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { HasuraUserService } from '../hasura/hasura-user.service';
import type { DedicatedLocationAccessService } from './dedicated-location-access.service';
import { DedicatedCapabilityController, DedicatedOpportunitiesController } from './dedicated-opportunities.controller';
import type { DedicatedOpportunitiesService } from './dedicated-opportunities.service';
import { DedicatedPostingsBusinessController } from './dedicated-postings-business.controller';
import type { DedicatedPostingsService } from './dedicated-postings.service';

describe('DedicatedPostingsBusinessController', () => {
  const setup = (allowed: boolean) => {
    const service = {
      create: jest.fn(async () => ({ posting: {} })),
      list: jest.fn(async () => ({ postings: [] })),
      updateTerms: jest.fn(async () => ({ posting: {} })),
      close: jest.fn(async () => ({ posting: {}, autoDeclined: 0 })),
      applications: jest.fn(async () => ({ applications: [] })),
      accept: jest.fn(async () => ({})),
      decline: jest.fn(async () => ({})),
    };
    const access = {
      resolve: jest.fn(async (locationId: string) => {
        if (!allowed) throw new ForbiddenException('Missing required delegation permission');
        return { userId: 'u-del', locationId, businessId: 'biz-1', via: 'delegate' };
      }),
    };
    const controller = new DedicatedPostingsBusinessController(
      service as unknown as DedicatedPostingsService,
      access as unknown as DedicatedLocationAccessService
    );
    return { controller, service, access };
  };
  const calls = (c: DedicatedPostingsBusinessController) => [
    () => c.create('loc-1', { headcount: 2, slotKeys: ['morning'] }),
    () => c.list('loc-1'),
    () => c.updateTerms('loc-1', 'po-1', { terms: 't' }),
    () => c.close('loc-1', 'po-1', { reason: 'r' }),
    () => c.applications('loc-1', 'po-1'),
    () => c.accept('loc-1', 'po-1', 'app-1'),
    () => c.decline('loc-1', 'po-1', 'app-1'),
  ];

  it('denied access is 403 on every route, service untouched', async () => {
    const { controller, service, access } = setup(false);
    for (const call of calls(controller)) await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.resolve).toHaveBeenCalledTimes(7);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it('allowed: acting user and path ids are passed through', async () => {
    const { controller, service } = setup(true);
    for (const call of calls(controller)) await expect(call()).resolves.toMatchObject({ success: true });
    const a = { userId: 'u-del', locationId: 'loc-1' };
    expect(service.create).toHaveBeenCalledWith(a, { headcount: 2, slotKeys: ['morning'] });
    expect(service.updateTerms).toHaveBeenCalledWith(a, 'po-1', 't');
    expect(service.close).toHaveBeenCalledWith(a, 'po-1', 'r');
    expect(service.applications).toHaveBeenCalledWith('loc-1', 'po-1');
    expect(service.accept).toHaveBeenCalledWith(a, 'po-1', 'app-1');
    expect(service.decline).toHaveBeenCalledWith(a, 'po-1', 'app-1');
  });
});

describe('DedicatedOpportunitiesController', () => {
  const setup = (userId: string | null) => {
    const service = {
      list: jest.fn(async () => ({ opportunities: [] })),
      apply: jest.fn(async () => ({ application: {} })),
      withdraw: jest.fn(async () => ({ application: {} })),
      detail: jest.fn(async () => ({ opportunity: { id: 'po-1' } })),
    };
    const users = { getUserId: jest.fn(() => userId) };
    const controller = new DedicatedOpportunitiesController(
      service as unknown as DedicatedOpportunitiesService,
      users as unknown as HasuraUserService
    );
    return { controller, service };
  };

  it('uses the caller’s user id', async () => {
    const { controller, service } = setup('u-a1');
    await controller.list();
    await controller.apply('po-1');
    await controller.withdraw('po-1');
    expect(service.list).toHaveBeenCalledWith('u-a1');
    expect(service.apply).toHaveBeenCalledWith('u-a1', 'po-1');
    expect(service.withdraw).toHaveBeenCalledWith('u-a1', 'po-1');
    await expect(controller.detail('po-1')).resolves.toEqual({ success: true, opportunity: { id: 'po-1' } });
    expect(service.detail).toHaveBeenCalledWith('u-a1', 'po-1');
  });

  it('anonymous -> 401', async () => {
    const { controller, service } = setup('anonymous');
    await expect(controller.list()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.apply('po-1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.apply).not.toHaveBeenCalled();
    await expect(controller.detail('po-1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.detail).not.toHaveBeenCalled();
  });

  it('#594 G1: GET :postingId is routed under agents/me/dedicated-opportunities', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DedicatedOpportunitiesController)).toBe('agents/me/dedicated-opportunities');
    expect(Reflect.getMetadata(PATH_METADATA, DedicatedOpportunitiesController.prototype.detail)).toBe(':postingId');
    expect(Reflect.getMetadata(METHOD_METADATA, DedicatedOpportunitiesController.prototype.detail)).toBe(RequestMethod.GET);
  });
});

describe('#594 G12: DedicatedCapabilityController', () => {
  const setup = (userId: string | null) => {
    const service = {
      capabilityForAgent: jest.fn(async () => ({ enabled: true, country: 'CM', reason: null })),
      capabilityForCountry: jest.fn(async () => ({ enabled: false, country: 'GA', reason: null })),
    };
    const users = { getUserId: jest.fn(() => userId) };
    const controller = new DedicatedCapabilityController(
      service as unknown as DedicatedOpportunitiesService,
      users as unknown as HasuraUserService
    );
    return { controller, service };
  };

  it('agent variant uses the caller; country variant passes the query; both wrap in success', async () => {
    const { controller, service } = setup('u-a1');
    await expect(controller.forAgent()).resolves.toEqual({ success: true, enabled: true, country: 'CM', reason: null });
    expect(service.capabilityForAgent).toHaveBeenCalledWith('u-a1');
    await expect(controller.forCountry('ga')).resolves.toEqual({ success: true, enabled: false, country: 'GA', reason: null });
    expect(service.capabilityForCountry).toHaveBeenCalledWith('ga');
  });

  it('anonymous -> 401 on both', async () => {
    const { controller, service } = setup('anonymous');
    await expect(controller.forAgent()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.forCountry('CM')).rejects.toBeInstanceOf(UnauthorizedException);
    const none = setup(null);
    await expect(none.controller.forAgent()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.capabilityForAgent).not.toHaveBeenCalled();
    expect(service.capabilityForCountry).not.toHaveBeenCalled();
  });

  it('paths are the contract’s', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DedicatedCapabilityController.prototype.forAgent)).toBe('agents/me/dedicated-agents/capability');
    expect(Reflect.getMetadata(PATH_METADATA, DedicatedCapabilityController.prototype.forCountry)).toBe('dedicated-agents/capability');
  });
});
