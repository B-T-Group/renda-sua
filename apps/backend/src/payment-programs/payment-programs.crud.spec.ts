import { BadRequestException } from '@nestjs/common';
import { CashAdvanceService } from './cash-advance.service';
import { PartnerBusinessesService } from './partner-businesses.service';
import { PaymentScheduleCatalogService } from './payment-schedule-catalog.service';
import { allocatePurchaseCredits } from './purchase-credit.allocator';
import { PurchaseCreditsService } from './purchase-credits.service';

describe('payment program admin rules', () => {
  it('deactivating a schedule ends active and paused assignments', async () => {
    const hasura = { executeMutation: jest.fn(async () => ({ update_payment_schedules_by_pk: { id: 's1' } })) };
    const service = new PaymentScheduleCatalogService(hasura as never);
    await service.setScheduleActive('s1', false);
    const [mutation] = hasura.executeMutation.mock.calls[0];
    expect(mutation).toContain('is_active: false');
    expect(mutation).toContain('status: ended');
  });

  it('rejects resume when the schedule template is inactive', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          id: 'a1',
          status: 'paused',
          schedule_id: 's1',
          agent_id: 'agent',
          ends_at: null,
          schedule: { is_active: false },
        },
      })),
      executeMutation: jest.fn(),
    };
    const service = new PaymentScheduleCatalogService(hasura as never);
    await expect(service.setAssignmentStatus('a1', 'active')).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a cash-advance limit below the amount already drawn', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        cash_advance_facilities_by_pk: {
          id: 'f1',
          status: 'active',
          account: { cash_advance_balance: -400 },
        },
      })),
      executeMutation: jest.fn(),
    };
    const service = new CashAdvanceService(hasura as never, {} as never, {} as never);
    await expect(service.updateFacility('f1', { limitAmount: 100 })).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('revokes a grant by zeroing remaining and blocks restore credit', async () => {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('purchase_credit_redemptions')) {
          return { purchase_credit_redemptions: [{ id: 'r1', grant_id: 'g1', amount: 500 }] };
        }
        return { purchase_credit_grants_by_pk: { revoked_at: '2026-09-19T00:00:00Z' } };
      }),
      executeMutation: jest.fn(async (mutation: string) => {
        if (mutation.includes('delete_purchase_credit_redemptions_by_pk')) {
          return { delete_purchase_credit_redemptions_by_pk: { id: 'r1' } };
        }
        return {
          update_purchase_credit_grants: { returning: [{ id: 'g1', remaining_amount: 0 }] },
        };
      }),
    };
    const service = new PurchaseCreditsService(hasura as never, {} as never);
    await service.revoke('g1');
    expect(hasura.executeMutation.mock.calls[0][0]).toContain('remaining_amount: 0');
    await service.restore('order-1');
    const mutations = hasura.executeMutation.mock.calls.map(([query]) => query as string);
    expect(mutations.some((query) => query.includes('CreditCreditRemaining'))).toBe(false);
  });

  it('keeps a deactivated partner row and still applies a specific grant', async () => {
    const hasura = {
      executeMutation: jest.fn(async () => ({ insert_partner_businesses_one: { id: 'p1', is_active: false } })),
    };
    const partners = new PartnerBusinessesService(hasura as never);
    await partners.set({ businessId: 'store-1', isActive: false, notes: 'paused' });
    const [mutation, vars] = hasura.executeMutation.mock.calls[0];
    expect(mutation).toContain('on_conflict');
    expect(mutation).not.toContain('delete_partner_businesses');
    expect(vars.object.is_active).toBe(false);
    const allocated = allocatePurchaseCredits({
      lines: [{ businessId: 'store-1', subtotal: 1000 }],
      partnerBusinessIds: new Set(),
      maxTotal: 1000,
      grants: [{
        id: 'named',
        remainingAmount: 1000,
        applicability: 'specific_business',
        businessId: 'store-1',
        expiresAt: null,
        createdAt: '2026-01-01T00:00:00Z',
      }],
    });
    expect(allocated.total).toBe(1000);
  });
});
