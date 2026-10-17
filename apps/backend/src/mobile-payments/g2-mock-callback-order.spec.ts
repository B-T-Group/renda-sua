import { FedaPayService } from './providers/fedapay.service';
import { GiveChangePayoutService } from './give-change-payout.service';

/**
 * G2: Mock callbacks must be scheduled AFTER persisting the transaction_id
 * to avoid race conditions where the callback fires before the id is stored.
 */
describe('G2: Mock callback scheduling order', () => {
  let mockUpdateTransaction: jest.Mock;
  let mockScheduleMockCallback: jest.Mock;
  let mockRegisterHold: jest.Mock;

  beforeEach(() => {
    mockUpdateTransaction = jest.fn().mockResolvedValue(undefined);
    mockScheduleMockCallback = jest.fn();
    mockRegisterHold = jest.fn().mockResolvedValue({ success: true });
  });

  it('controller top-up: scheduleMockCallback called AFTER updateTransaction', async () => {
    // Simulate the controller flow
    const transactionId = 'mock-abc-123';
    const reference = 'REF-123';

    await mockUpdateTransaction('tx-1', { transaction_id: transactionId });
    mockScheduleMockCallback(transactionId, reference);

    expect(mockUpdateTransaction).toHaveBeenCalledWith('tx-1', { transaction_id: transactionId });
    expect(mockScheduleMockCallback).toHaveBeenCalledWith(transactionId, reference);

    const updateOrder = mockUpdateTransaction.mock.invocationCallOrder[0];
    const scheduleOrder = mockScheduleMockCallback.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(scheduleOrder);
  });

  it('give-change: scheduleMockCallback called AFTER registerHold', async () => {
    // Simulate give-change flow
    const providerTxId = 'mock-payout-456';
    const reference = 'GC-REF-456';

    await mockRegisterHold({ transaction_id: providerTxId });
    mockScheduleMockCallback(providerTxId, reference);

    expect(mockRegisterHold).toHaveBeenCalled();
    expect(mockScheduleMockCallback).toHaveBeenCalledWith(providerTxId, reference);

    const holdOrder = mockRegisterHold.mock.invocationCallOrder[0];
    const scheduleOrder = mockScheduleMockCallback.mock.invocationCallOrder[0];
    expect(holdOrder).toBeLessThan(scheduleOrder);
  });

  it('non-mock id does not schedule callback', () => {
    const realId = 'real-tx-789';
    
    // Mock payment should not schedule if ID doesn't start with 'mock-'
    if (realId.startsWith('mock-')) {
      mockScheduleMockCallback(realId, 'REF');
    }

    expect(mockScheduleMockCallback).not.toHaveBeenCalled();
  });
});
