import { InventoryItemsService } from './inventory-items.service';

describe('InventoryItemsService.resolveOwnerPreview', () => {
  const businessId = 'biz-1';
  const ownerUser = {
    id: 'user-owner',
    business: { id: businessId },
  };
  const otherUser = {
    id: 'user-admin',
    business: { id: 'biz-other' },
  };

  let hasuraUserService: { getUser: jest.Mock };
  let rbacService: { getEffectiveAccess: jest.Mock };
  let service: InventoryItemsService;

  beforeEach(() => {
    hasuraUserService = { getUser: jest.fn() };
    rbacService = { getEffectiveAccess: jest.fn() };
    service = new InventoryItemsService(
      {} as never,
      hasuraUserService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      rbacService as never
    );
  });

  async function resolveOwnerPreview(
    requestedBusinessId: string | undefined,
    requested: boolean
  ): Promise<boolean> {
    return (service as any).resolveOwnerPreview(requestedBusinessId, requested);
  }

  it('returns false when owner preview is not requested or business id is blank', async () => {
    await expect(resolveOwnerPreview(businessId, false)).resolves.toBe(false);
    await expect(resolveOwnerPreview('  ', true)).resolves.toBe(false);
    expect(hasuraUserService.getUser).not.toHaveBeenCalled();
  });

  it('returns true for the verified business owner without checking RBAC', async () => {
    hasuraUserService.getUser.mockResolvedValue(ownerUser);

    await expect(resolveOwnerPreview(businessId, true)).resolves.toBe(true);
    expect(rbacService.getEffectiveAccess).not.toHaveBeenCalled();
  });

  it('returns true for superusers who do not own the business', async () => {
    hasuraUserService.getUser.mockResolvedValue(otherUser);
    rbacService.getEffectiveAccess.mockResolvedValue({ isSuperuser: true });

    await expect(resolveOwnerPreview(` ${businessId} `, true)).resolves.toBe(
      true
    );
    expect(rbacService.getEffectiveAccess).toHaveBeenCalledWith(otherUser.id);
  });

  it('returns false for non-owner non-superusers', async () => {
    hasuraUserService.getUser.mockResolvedValue(otherUser);
    rbacService.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });

    await expect(resolveOwnerPreview(businessId, true)).resolves.toBe(false);
  });

  it('returns false when auth lookup fails', async () => {
    hasuraUserService.getUser.mockRejectedValue(new Error('unauthorized'));

    await expect(resolveOwnerPreview(businessId, true)).resolves.toBe(false);
  });
});
