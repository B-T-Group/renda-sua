import { HttpStatus } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BusinessLocationTransferService,
  TransferRequestRow,
} from './business-location-transfer.service';

const request: TransferRequestRow = {
  id: 'request-id',
  business_location_id: 'location-id',
  from_business_id: 'source-id',
  to_business_id: 'destination-id',
  from_user_id: 'source-user-id',
  to_user_id: 'destination-user-id',
  requested_by_user_id: 'requester-id',
  status: 'pending',
  item_count: 0,
  rental_item_count: 0,
  order_count: 0,
  metadata: {},
  expires_at: '2099-01-01T00:00:00.000Z',
  responded_at: null,
  created_at: '2026-07-14T00:00:00.000Z',
  updated_at: '2026-07-14T00:00:00.000Z',
};

describe('BusinessLocationTransferService', () => {
  const executeQuery = jest.fn();
  const executeMutation = jest.fn();
  const notifications = {
    sendBusinessLocationTransferPush: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BusinessLocationTransferService(
    { executeQuery, executeMutation } as unknown as HasuraSystemService,
    notifications as unknown as NotificationsService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts through the transactional database function', async () => {
    mockAcceptQueries(executeQuery);
    executeMutation.mockResolvedValue({
      accept_business_location_transfer: [{ id: request.id }],
    });

    await service.accept(request.id, request.to_business_id);

    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation.mock.calls[0][0]).toContain(
      'accept_business_location_transfer'
    );
    expect(executeMutation.mock.calls[0][1]).toMatchObject({
      requestId: request.id,
      destinationBusinessId: request.to_business_id,
    });
  });

  it('does not overwrite a request changed by a concurrent accept', async () => {
    executeQuery.mockResolvedValueOnce({
      business_location_transfer_requests_by_pk: request,
    });
    executeMutation.mockResolvedValueOnce({
      update_business_location_transfer_requests: { affected_rows: 0 },
    });

    const rejection = service.reject(request.id, request.to_business_id);

    await expect(rejection).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
  });
});

function mockAcceptQueries(executeQuery: jest.Mock): void {
  executeQuery
    .mockResolvedValueOnce({
      business_location_transfer_requests_by_pk: request,
    })
    .mockResolvedValueOnce({ business_locations_by_pk: location })
    .mockResolvedValueOnce({ businesses_by_pk: destination })
    .mockResolvedValueOnce({
      business_inventory: [],
      rental_location_listings: [],
    })
    .mockResolvedValueOnce({
      business_locations_aggregate: { aggregate: { count: 2 } },
    })
    .mockResolvedValueOnce({
      orders_aggregate: { aggregate: { count: 0 } },
    })
    .mockResolvedValueOnce({
      orders_aggregate: { aggregate: { count: 0 } },
    })
    .mockResolvedValueOnce({
      orders_aggregate: { aggregate: { count: 0 } },
    })
    .mockResolvedValueOnce({ business_locations_by_pk: location })
    .mockResolvedValueOnce({
      business_location_transfer_requests_by_pk: {
        ...request,
        status: 'accepted',
      },
    });
}

const location = {
  id: request.business_location_id,
  name: 'Transfer location',
  business_id: request.from_business_id,
  address_id: 'address-id',
  is_primary: false,
  business: {
    id: request.from_business_id,
    name: 'Source',
    user_id: request.from_user_id,
    user: { email: 'source@example.com' },
  },
};

const destination = {
  id: request.to_business_id,
  name: 'Destination',
  user_id: request.to_user_id,
  user: { email: 'destination@example.com' },
};
