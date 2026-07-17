import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { DeliveryUnavailableReason } from '../delivery-availability.types';
import { ServiceAreaEnabledRule } from './service-area-enabled.rule';

describe('ServiceAreaEnabledRule', () => {
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let rule: ServiceAreaEnabledRule;

  const baseCtx = {
    businessId: 'biz-1',
    sellerCountry: 'CM',
    sellerState: 'Littoral',
    pickupLat: 4.05,
    pickupLon: 9.7,
    evaluatedAt: new Date(),
  };

  beforeEach(() => {
    hasuraSystemService = {
      executeQuery: jest.fn(),
    } as unknown as jest.Mocked<HasuraSystemService>;
    rule = new ServiceAreaEnabledRule(hasuraSystemService);
  });

  function mockStates(rows: Array<{ state_name: string | null; delivery_enabled: boolean }>) {
    (hasuraSystemService.executeQuery as jest.Mock).mockResolvedValue({
      supported_country_states: rows,
    });
  }

  it('passes when the seller state has delivery enabled', async () => {
    mockStates([
      { state_name: 'Littoral', delivery_enabled: true },
      { state_name: 'Centre', delivery_enabled: false },
    ]);

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(true);
  });

  it('fails with SERVICE_AREA_DISABLED when the seller state row disables delivery', async () => {
    mockStates([
      { state_name: 'Littoral', delivery_enabled: false },
      { state_name: 'Centre', delivery_enabled: true },
    ]);

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(false);
    if (!outcome.pass) {
      expect(outcome.reason).toBe(
        DeliveryUnavailableReason.SERVICE_AREA_DISABLED
      );
    }
  });

  it('falls back to any-state check when seller state has no dedicated row', async () => {
    mockStates([{ state_name: 'Centre', delivery_enabled: true }]);

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(true);
  });

  it('fails when no state in the country allows delivery', async () => {
    mockStates([
      { state_name: 'Centre', delivery_enabled: false },
      { state_name: 'Nord', delivery_enabled: false },
    ]);

    const outcome = await rule.evaluate({ ...baseCtx, sellerState: 'Sud' });

    expect(outcome.pass).toBe(false);
  });

  it('passes when the country has no supported_country_states rows', async () => {
    mockStates([]);

    const outcome = await rule.evaluate(baseCtx);

    expect(outcome.pass).toBe(true);
    expect(hasuraSystemService.executeQuery).toHaveBeenCalled();
  });

  it('passes without querying when seller country is missing', async () => {
    const outcome = await rule.evaluate({ ...baseCtx, sellerCountry: '' });

    expect(outcome.pass).toBe(true);
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });
});
