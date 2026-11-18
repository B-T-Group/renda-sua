import { readFileSync } from 'fs';
import { join } from 'path';
import { capRefund, declineRail, mapRefundPoll, maskMomoPhone, providerRefundPlan, refundFromLedger, sumCollected } from './pickup-decline.money';
import { DECLINE_FLAG_THRESHOLD, declineGuard } from './pickup-decline.policy';
import { isDeclineEvidenceKey, isPublicBaselineKey } from './pickup-decline.keys';
import { BASELINE_PHOTOS } from './pickup-decline.queries';

describe('pickup decline money', () => {
  const paid = [{ amount: 100, currency: 'XAF', provider: 'mtn', phone: '2376700006712', transactionId: 't' }];

  it('never refunds more than the ledger collected', () => {
    expect(sumCollected(paid, 'XAF')).toBe(100);
    expect(refundFromLedger(100, 250)).toBe(100);
    expect(capRefund(100, 250)).toBe(100);
    expect(sumCollected(paid, 'CAD')).toBe(0);
  });

  it('picks the rail from what was actually collected', () => {
    expect(declineRail({ collected: 100, authorizedAmount: 65, walletHold: 10 })).toBe('momo_paid');
    expect(declineRail({ collected: 0, authorizedAmount: 65, walletHold: 10 })).toBe('card');
    expect(declineRail({ collected: 0, authorizedAmount: 0, walletHold: 10 })).toBe('wallet');
    expect(declineRail({ collected: 0, authorizedAmount: 0, walletHold: 0 })).toBe('momo_unpaid');
  });

  it('maps provider plans and poll codes without inventing success', () => {
    expect(providerRefundPlan('mtn')).toBe('mtn');
    expect(providerRefundPlan('freemopay')).toBe('freemopay');
    expect(providerRefundPlan('fedapay')).toBe('fedapay');
    expect(providerRefundPlan('mypvit')).toBe('unsupported');
    expect(providerRefundPlan('orange')).toBe('unsupported');
    expect(mapRefundPoll('SUCCESSFUL')).toBe('refunded');
    expect(mapRefundPoll('approved')).toBe('refunded');
    expect(mapRefundPoll('FAILED')).toBe('failed');
    expect(mapRefundPoll('PENDING')).toBe('refund_pending');
    expect(mapRefundPoll(null)).toBe('refund_pending');
    expect(maskMomoPhone('2376700006712')).toBe('····· 67 12');
  });
});

describe('pickup decline guards', () => {
  const open = {
    status: 'reserved',
    actual_start_at: null,
    inspection_policy_version: 1,
    pickup_current_version_id: 'version',
  };

  it('allows an open inspected booking and rejects the others', () => {
    expect(declineGuard(open, 'version')).toBe('ok');
    expect(declineGuard({ ...open, status: 'confirmed' }, 'version')).toBe('ok');
    expect(declineGuard({ ...open, inspection_policy_version: null }, 'version')).toBe('not_inspected');
    expect(declineGuard({ ...open, status: 'active' }, 'version')).toBe('closed');
    expect(declineGuard({ ...open, actual_start_at: '2026-01-01' }, 'version')).toBe('closed');
    expect(declineGuard(open, 'other')).toBe('version');
  });

  it('flags a party at 5 declines, not 4', () => {
    expect(DECLINE_FLAG_THRESHOLD).toBe(5);
    expect(4 >= DECLINE_FLAG_THRESHOLD).toBe(false);
    expect(5 >= DECLINE_FLAG_THRESHOLD).toBe(true);
  });

  it('keeps public baseline keys separate from evidence', () => {
    const item = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const booking = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const photo = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const baseline = `dev/rental-inspection/baseline/${item}/${photo}.jpg`;
    const decline = `dev/rental-inspection/decline/${booking}/${photo}.jpg`;
    expect(isPublicBaselineKey(baseline, item)).toBe(true);
    expect(isPublicBaselineKey(decline, item)).toBe(false);
    expect(isPublicBaselineKey(`dev/rental-inspection/${booking}/${photo}.jpg`, item)).toBe(false);
    expect(isDeclineEvidenceKey(decline, booking)).toBe(true);
    expect(isDeclineEvidenceKey(baseline, booking)).toBe(false);
    expect(BASELINE_PHOTOS).toContain('rental_item_baseline_photos');
    expect(BASELINE_PHOTOS).not.toContain('rental_condition_decline_photos');
    expect(BASELINE_PHOTOS).not.toContain('rental_inspection_media');
  });
});

describe('pickup decline migration', () => {
  const dir = join(__dirname, '../../../../hasura/migrations/Rendasua/20261115030000_rentals_pickup_decline');
  const up = readFileSync(join(dir, 'up.sql'), 'utf8');
  const constants = readFileSync(join(__dirname, '../../app-config/client-flags.constants.ts'), 'utf8');

  it('seeds the flag false and does not turn it on by environment', () => {
    expect(up).toContain("'rentals_pickup_decline_enabled'");
    expect(up).toContain('false');
    expect(constants).toMatch(/rentals_pickup_decline_enabled: false/);
    expect(constants).not.toMatch(/rentals_pickup_decline_enabled:\s*isNonProduction/);
    expect(up).toContain('refund_status');
    expect(up).toContain('rental_condition_decline_counts_90d');
    expect(up).toContain('5 or more');
  });
});
