import { OrderRiskService, RiskLevel } from './order-risk.service';

describe('OrderRiskService', () => {
  const NOW = '2026-08-20T12:00:00.000Z';
  let service: OrderRiskService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    service = new OrderRiskService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('calculateRiskScore', () => {
    it('returns zero when the order has no current status', () => {
      expect(service.calculateRiskScore({ created_at: '2026-08-20T10:00:00.000Z' })).toEqual({
        score: 0,
        factors: [],
      });
    });

    it('does not flag a pending order younger than 30 minutes', () => {
      const actual = service.calculateRiskScore({
        current_status: 'pending',
        created_at: '2026-08-20T11:50:00.000Z',
      });

      expect(actual.score).toBe(0);
      expect(actual.factors).toEqual([]);
    });

    it('scores a pending order that is still unconfirmed after 30 minutes', () => {
      const actual = service.calculateRiskScore({
        current_status: 'pending',
        created_at: '2026-08-20T11:15:00.000Z',
      });

      expect(actual.score).toBe(30);
      expect(actual.factors[0]).toContain('Not confirmed for 45 minutes');
    });

    it('scores a missed acceptance deadline except for confirmed or terminal orders', () => {
      const overdue = service.calculateRiskScore({
        current_status: 'preparing',
        acceptance_deadline_at: '2026-08-20T11:30:00.000Z',
      });
      const confirmed = service.calculateRiskScore({
        current_status: 'confirmed',
        acceptance_deadline_at: '2026-08-20T11:30:00.000Z',
      });

      expect(overdue.score).toBe(40);
      expect(overdue.factors[0]).toContain('Acceptance deadline passed 30 minutes ago');
      expect(confirmed).toEqual({ score: 0, factors: [] });
    });

    it('adds pickup at-risk and overdue scores', () => {
      expect(
        service.calculateRiskScore({
          current_status: 'assigned_to_agent',
          pickup_state: 'at_risk',
        }).score
      ).toBe(25);
      expect(
        service.calculateRiskScore({
          current_status: 'assigned_to_agent',
          pickup_state: 'overdue',
        }).score
      ).toBe(40);
    });

    it('scores a missed delivery window unless the order is already finished', () => {
      const late = service.calculateRiskScore({
        current_status: 'out_for_delivery',
        delivery_time_window: { time_slot_end: '2026-08-20T11:20:00.000Z' },
      });
      const delivered = service.calculateRiskScore({
        current_status: 'delivered',
        delivery_time_window: { time_slot_end: '2026-08-20T11:20:00.000Z' },
      });

      expect(late.score).toBe(50);
      expect(late.factors[0]).toContain('Past delivery window by 40 minutes');
      expect(delivered).toEqual({ score: 0, factors: [] });
    });

    it('scores assigned pickups that are overdue or due within 10 minutes', () => {
      const overdue = service.calculateRiskScore({
        current_status: 'assigned_to_agent',
        pickup_due_at: '2026-08-20T11:40:00.000Z',
      });
      const dueSoon = service.calculateRiskScore({
        current_status: 'assigned_to_agent',
        pickup_due_at: '2026-08-20T12:05:00.000Z',
      });
      const plentyOfTime = service.calculateRiskScore({
        current_status: 'assigned_to_agent',
        pickup_due_at: '2026-08-20T12:30:00.000Z',
      });

      expect(overdue.score).toBe(25);
      expect(overdue.factors[0]).toContain('20 min overdue');
      expect(dueSoon).toEqual({
        score: 15,
        factors: ['Agent pickup due in 5 minutes'],
      });
      expect(plentyOfTime).toEqual({ score: 0, factors: [] });
    });

    it('scores late estimated delivery for in-transit orders', () => {
      const actual = service.calculateRiskScore({
        current_status: 'in_transit',
        estimated_delivery_time: '2026-08-20T11:30:00.000Z',
      });

      expect(actual.score).toBe(19);
      expect(actual.factors[0]).toContain(
        'Estimated delivery time passed 30 minutes ago'
      );
    });

    it('caps the combined score at 100', () => {
      const actual = service.calculateRiskScore({
        current_status: 'pending',
        created_at: '2026-08-20T11:15:00.000Z',
        acceptance_deadline_at: '2026-08-20T11:30:00.000Z',
        pickup_state: 'overdue',
        delivery_time_window: { time_slot_end: '2026-08-20T11:20:00.000Z' },
      });

      expect(actual.score).toBe(100);
      expect(actual.factors.length).toBeGreaterThan(1);
    });
  });

  describe('getRiskLevel', () => {
    it('maps score bands used by the admin dashboard', () => {
      expect(service.getRiskLevel(0)).toBe(RiskLevel.LOW);
      expect(service.getRiskLevel(14)).toBe(RiskLevel.LOW);
      expect(service.getRiskLevel(15)).toBe(RiskLevel.MEDIUM);
      expect(service.getRiskLevel(29)).toBe(RiskLevel.MEDIUM);
      expect(service.getRiskLevel(30)).toBe(RiskLevel.HIGH);
      expect(service.getRiskLevel(49)).toBe(RiskLevel.HIGH);
      expect(service.getRiskLevel(50)).toBe(RiskLevel.CRITICAL);
    });
  });

  describe('enrichOrderWithRisk', () => {
    it('attaches score and factor strings without dropping order fields', () => {
      const actual = service.enrichOrderWithRisk({
        id: 'ord-1',
        current_status: 'assigned_to_agent',
        pickup_state: 'at_risk',
      });

      expect(actual).toEqual(
        expect.objectContaining({
          id: 'ord-1',
          current_status: 'assigned_to_agent',
          risk_score: 25,
          risk_factors: ['Pickup at risk'],
        })
      );
    });
  });
});
