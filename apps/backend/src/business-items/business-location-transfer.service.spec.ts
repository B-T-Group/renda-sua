jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BusinessLocationTransferService } from './business-location-transfer.service';

describe('BusinessLocationTransferService ownership transfer', () => {
  it('revokes location delegations and pending invites with the transfer', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({
        update_business_location_transfer_requests: { affected_rows: 1 },
      }),
    };
    const notifications = { sendNotification: jest.fn() };
    const service = new BusinessLocationTransferService(
      hasura as any,
      notifications as any
    );

    await (service as any).executeOwnershipTransfer(
      {
        id: 'req-1',
        to_business_id: 'biz-new',
        from_business_id: 'biz-old',
        to_user_id: 'user-new',
      },
      {
        id: 'loc-1',
        address_id: 'addr-1',
      },
      { itemIds: ['item-1'], rentalItemIds: [], listingIds: [] }
    );

    const mutation = String(hasura.executeMutation.mock.calls[0][0]);
    expect(mutation).toContain('update_location_delegations');
    expect(mutation).toContain('update_location_delegation_invites');
    expect(mutation).toMatch(
      /status:\s*\{\s*_eq:\s*"active"\s*\}[\s\S]*status:\s*"revoked"/
    );
    expect(mutation).toMatch(
      /status:\s*\{\s*_eq:\s*"pending"\s*\}[\s\S]*status:\s*"revoked"/
    );
    expect(hasura.executeMutation.mock.calls[0][1]).toMatchObject({
      locationId: 'loc-1',
      toBusinessId: 'biz-new',
      fromBusinessId: 'biz-old',
    });
  });
});
