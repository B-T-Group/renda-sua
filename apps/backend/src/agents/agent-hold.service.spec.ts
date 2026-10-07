import { Test, TestingModule } from '@nestjs/testing';
import { AgentHoldService } from './agent-hold.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

describe('AgentHoldService', () => {
  let service: AgentHoldService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentHoldService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn(),
            executeMutation: jest.fn(),
            getAccount: jest.fn(),
          },
        },
        {
          provide: HasuraUserService,
          useValue: {
            getUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AgentHoldService>(AgentHoldService);
    hasuraSystemService = module.get(
      HasuraSystemService
    ) as jest.Mocked<HasuraSystemService>;
    hasuraUserService = module.get(
      HasuraUserService
    ) as jest.Mocked<HasuraUserService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHoldPercentageConfigs', () => {
    it('should fetch and return hold percentage configs', async () => {
      const mockConfigs = [
        { config_key: 'internal_agent_hold_percentage', number_value: 0 },
        { config_key: 'verified_agent_hold_percentage', number_value: 80 },
        { config_key: 'unverified_agent_hold_percentage', number_value: 100 },
      ];
      hasuraSystemService.executeQuery.mockResolvedValue({
        application_configurations: mockConfigs,
      });

      const result = await service.getHoldPercentageConfigs();

      expect(result).toEqual({
        internalAgentHoldPercentage: 0,
        verifiedAgentHoldPercentage: 80,
        unverifiedAgentHoldPercentage: 100,
      });
    });

    it('should use defaults when configs are missing', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        application_configurations: [],
      });

      const result = await service.getHoldPercentageConfigs();

      expect(result).toEqual({
        internalAgentHoldPercentage: 0,
        verifiedAgentHoldPercentage: 80,
        unverifiedAgentHoldPercentage: 100,
      });
    });
  });

  describe('getHoldCeilingConfig', () => {
    it('should fetch and return hold ceiling configs', async () => {
      const mockConfigs = [
        { config_key: 'agent_hold_ceiling_enabled', boolean_value: true },
        { config_key: 'agent_hold_ceiling_xaf', number_value: 50000 },
        { config_key: 'agent_hold_ceiling_city', string_value: 'Yaoundé' },
        {
          config_key: 'agent_hold_ceiling_min_clean_deliveries',
          number_value: 10,
        },
        {
          config_key: 'agent_hold_loss_weekly_cap_xaf',
          number_value: 100000,
        },
      ];
      hasuraSystemService.executeQuery.mockResolvedValue({
        application_configurations: mockConfigs,
      });

      const result = await service.getHoldCeilingConfig();

      expect(result).toEqual({
        enabled: true,
        ceilingXaf: 50000,
        pilotCity: 'Yaoundé',
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: 100000,
      });
    });

    it('should use defaults when ceiling configs are missing', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        application_configurations: [],
      });

      const result = await service.getHoldCeilingConfig();

      expect(result).toEqual({
        enabled: false,
        ceilingXaf: null,
        pilotCity: null,
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: null,
      });
    });
  });

  describe('isAgentEligibleForCeiling', () => {
    const mockCeilingConfig = {
      enabled: true,
      ceilingXaf: 50000,
      pilotCity: 'Yaoundé',
      minCleanDeliveries: 10,
      lossWeeklyCapXaf: 100000,
    };

    it('should return false when ceiling is not enabled', async () => {
      const result = await service.isAgentEligibleForCeiling('agent-id', {
        ...mockCeilingConfig,
        enabled: false,
      });

      expect(result).toBe(false);
    });

    it('should return true for eligible agent (verified, not internal, sufficient deliveries, no faults, in pilot city)', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: true,
          is_internal: false,
          user: {
            id: 'user-id',
            primary_address: { city: 'Yaoundé' },
          },
        },
        completed_deliveries: { aggregate: { count: 15 } },
        agent_faults: { aggregate: { count: 0 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(true);
    });

    it('should return false for unverified agent', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: false,
          is_internal: false,
          user: {
            id: 'user-id',
            primary_address: { city: 'Yaoundé' },
          },
        },
        completed_deliveries: { aggregate: { count: 15 } },
        agent_faults: { aggregate: { count: 0 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(false);
    });

    it('should return false for internal agent', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: true,
          is_internal: true,
          user: {
            id: 'user-id',
            primary_address: { city: 'Yaoundé' },
          },
        },
        completed_deliveries: { aggregate: { count: 15 } },
        agent_faults: { aggregate: { count: 0 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(false);
    });

    it('should return false when deliveries below minimum', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: true,
          is_internal: false,
          user: {
            id: 'user-id',
            primary_address: { city: 'Yaoundé' },
          },
        },
        completed_deliveries: { aggregate: { count: 5 } },
        agent_faults: { aggregate: { count: 0 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(false);
    });

    it('should return false when agent has faults', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: true,
          is_internal: false,
          user: {
            id: 'user-id',
            primary_address: { city: 'Yaoundé' },
          },
        },
        completed_deliveries: { aggregate: { count: 15 } },
        agent_faults: { aggregate: { count: 1 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(false);
    });

    it('should return false when agent not in pilot city', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: true,
          is_internal: false,
          user: {
            id: 'user-id',
            primary_address: { city: 'Douala' },
          },
        },
        completed_deliveries: { aggregate: { count: 15 } },
        agent_faults: { aggregate: { count: 0 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(false);
    });

    it('should normalize city names (case, accents, whitespace)', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agents_by_pk: {
          is_verified: true,
          is_internal: false,
          user: {
            id: 'user-id',
            primary_address: { city: ' yaoundé ' },
          },
        },
        completed_deliveries: { aggregate: { count: 15 } },
        agent_faults: { aggregate: { count: 0 } },
      });

      const result = await service.isAgentEligibleForCeiling(
        'agent-id',
        mockCeilingConfig
      );

      expect(result).toBe(true);
    });
  });

  describe('resolveOrderHoldWithCeiling', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getHoldPercentageConfigs').mockResolvedValue({
        internalAgentHoldPercentage: 0,
        verifiedAgentHoldPercentage: 80,
        unverifiedAgentHoldPercentage: 100,
      });

      jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
        enabled: true,
        ceilingXaf: 50000,
        pilotCity: 'Yaoundé',
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: 100000,
      });
    });

    describe('Stripe rail', () => {
      it('should return 0 hold for stripe rail', async () => {
        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'stripe'
        );

        expect(result).toEqual({
          rail: 'stripe',
          holdPercentage: 0,
          rawHoldAmount: 0,
          holdAmount: 0,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });
    });

    describe('Internal agent', () => {
      it('should return 0 hold for internal agent (mobile money)', async () => {
        hasuraSystemService.executeQuery.mockResolvedValue({
          agents_by_pk: { is_verified: true, is_internal: true },
        });

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 0,
          rawHoldAmount: 0,
          holdAmount: 0,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });
    });

    describe('Unverified agent', () => {
      it('should return 100% hold for unverified agent', async () => {
        hasuraSystemService.executeQuery.mockResolvedValue({
          agents_by_pk: { is_verified: false, is_internal: false },
        });

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 100,
          rawHoldAmount: 100000,
          holdAmount: 100000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });
    });

    describe('Flag OFF', () => {
      it('should return raw hold (80%) for verified agent when flag is off', async () => {
        jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
          enabled: false,
          ceilingXaf: 50000,
          pilotCity: 'Yaoundé',
          minCleanDeliveries: 10,
          lossWeeklyCapXaf: 100000,
        });

        hasuraSystemService.executeQuery.mockResolvedValue({
          agents_by_pk: { is_verified: true, is_internal: false },
        });

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 80000,
          holdAmount: 80000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });
    });

    describe('Eligible agent with ceiling', () => {
      beforeEach(() => {
        hasuraSystemService.executeQuery.mockImplementation(
          async (query: string) => {
            if (query.includes('agents_by_pk')) {
              return {
                agents_by_pk: { is_verified: true, is_internal: false },
              };
            }
            if (query.includes('CheckAgentEligibility')) {
              return {
                agents_by_pk: {
                  is_verified: true,
                  is_internal: false,
                  user: {
                    id: 'user-id',
                    primary_address: { city: 'Yaoundé' },
                  },
                },
                completed_deliveries: { aggregate: { count: 15 } },
                agent_faults: { aggregate: { count: 0 } },
              };
            }
            return {};
          }
        );
        jest.spyOn(service, 'isAgentEligibleForCeiling').mockResolvedValue(true);
      });

      it('should apply ceiling when raw hold > ceiling', async () => {
        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 80000,
          holdAmount: 50000,
          ceilingApplied: true,
          ceilingXaf: 50000,
        });
      });

      it('should not apply ceiling when raw hold < ceiling', async () => {
        const result = await service.resolveOrderHoldWithCeiling(
          50000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 40000,
          holdAmount: 40000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });

      it('should not apply ceiling when raw hold = ceiling', async () => {
        const result = await service.resolveOrderHoldWithCeiling(
          62500,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 50000,
          holdAmount: 50000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });
    });

    describe('Ineligible agent (flag ON)', () => {
      it('should return raw hold for verified but ineligible agent', async () => {
        hasuraSystemService.executeQuery.mockImplementation(
          async (query: string) => {
            if (query.includes('agents_by_pk')) {
              return {
                agents_by_pk: { is_verified: true, is_internal: false },
              };
            }
            if (query.includes('CheckAgentEligibility')) {
              return {
                agents_by_pk: {
                  is_verified: true,
                  is_internal: false,
                  user: {
                    id: 'user-id',
                    primary_address: { city: 'Douala' },
                  },
                },
                completed_deliveries: { aggregate: { count: 15 } },
                agent_faults: { aggregate: { count: 0 } },
              };
            }
            return {};
          }
        );
        jest.spyOn(service, 'isAgentEligibleForCeiling').mockResolvedValue(false);

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 80000,
          holdAmount: 80000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });
    });

    describe('Invalid ceiling', () => {
      it('should return raw hold when ceiling is 0', async () => {
        jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
          enabled: true,
          ceilingXaf: 0,
          pilotCity: 'Yaoundé',
          minCleanDeliveries: 10,
          lossWeeklyCapXaf: 100000,
        });

        hasuraSystemService.executeQuery.mockImplementation(
          async (query: string) => {
            if (query.includes('agents_by_pk')) {
              return {
                agents_by_pk: { is_verified: true, is_internal: false },
              };
            }
            if (query.includes('CheckAgentEligibility')) {
              return {
                agents_by_pk: {
                  is_verified: true,
                  is_internal: false,
                  user: {
                    id: 'user-id',
                    primary_address: { city: 'Yaoundé' },
                  },
                },
                completed_deliveries: { aggregate: { count: 15 } },
                agent_faults: { aggregate: { count: 0 } },
              };
            }
            return {};
          }
        );

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 80000,
          holdAmount: 80000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });

      it('should return raw hold when ceiling is negative', async () => {
        jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
          enabled: true,
          ceilingXaf: -10000,
          pilotCity: 'Yaoundé',
          minCleanDeliveries: 10,
          lossWeeklyCapXaf: 100000,
        });

        hasuraSystemService.executeQuery.mockImplementation(
          async (query: string) => {
            if (query.includes('agents_by_pk')) {
              return {
                agents_by_pk: { is_verified: true, is_internal: false },
              };
            }
            if (query.includes('CheckAgentEligibility')) {
              return {
                agents_by_pk: {
                  is_verified: true,
                  is_internal: false,
                  user: {
                    id: 'user-id',
                    primary_address: { city: 'Yaoundé' },
                  },
                },
                completed_deliveries: { aggregate: { count: 15 } },
                agent_faults: { aggregate: { count: 0 } },
              };
            }
            return {};
          }
        );

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result).toEqual({
          rail: 'mobile_money',
          holdPercentage: 80,
          rawHoldAmount: 80000,
          holdAmount: 80000,
          ceilingApplied: false,
          ceilingXaf: null,
        });
      });

      it('should never return 0 hold for verified agent with positive subtotal', async () => {
        jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
          enabled: true,
          ceilingXaf: null,
          pilotCity: 'Yaoundé',
          minCleanDeliveries: 10,
          lossWeeklyCapXaf: 100000,
        });

        hasuraSystemService.executeQuery.mockImplementation(
          async (query: string) => {
            if (query.includes('agents_by_pk')) {
              return {
                agents_by_pk: { is_verified: true, is_internal: false },
              };
            }
            return {};
          }
        );

        const result = await service.resolveOrderHoldWithCeiling(
          100000,
          'agent-id',
          'mobile_money'
        );

        expect(result.holdAmount).toBeGreaterThan(0);
        expect(result.holdAmount).toBe(80000);
      });
    });
  });

  describe('checkAndEnforceLossGuard', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
        enabled: true,
        ceilingXaf: 50000,
        pilotCity: 'Yaoundé',
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: 100000,
      });
    });

    it('should return not exceeded when no cap configured', async () => {
      jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
        enabled: true,
        ceilingXaf: 50000,
        pilotCity: 'Yaoundé',
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: null,
      });

      const result = await service.checkAndEnforceLossGuard();

      expect(result).toEqual({
        exceeded: false,
        weeklyLoss: 0,
        cap: null,
        autoDisabled: false,
      });
    });

    it('should return not exceeded when cap is 0', async () => {
      jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
        enabled: true,
        ceilingXaf: 50000,
        pilotCity: 'Yaoundé',
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: 0,
      });

      const result = await service.checkAndEnforceLossGuard();

      expect(result).toEqual({
        exceeded: false,
        weeklyLoss: 0,
        cap: null,
        autoDisabled: false,
      });
    });

    it('should return not exceeded when no agent faults in past 7 days', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        failed_deliveries: [],
      });

      const result = await service.checkAndEnforceLossGuard();

      expect(result).toEqual({
        exceeded: false,
        weeklyLoss: 0,
        cap: 100000,
        autoDisabled: false,
      });
    });

    it('should return not exceeded when weekly loss below cap', async () => {
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('failed_deliveries')) {
            return {
              failed_deliveries: [
                { order_id: 'order-1' },
                { order_id: 'order-2' },
              ],
            };
          }
          if (query.includes('order_holds')) {
            return {
              order_holds: [
                { agent_hold_amount: 30000 },
                { agent_hold_amount: 20000 },
              ],
            };
          }
          return {};
        }
      );

      const result = await service.checkAndEnforceLossGuard();

      expect(result).toEqual({
        exceeded: false,
        weeklyLoss: 50000,
        cap: 100000,
        autoDisabled: false,
      });
    });

    it('should return exceeded and auto-disable when weekly loss exceeds cap', async () => {
      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('failed_deliveries')) {
            return {
              failed_deliveries: [
                { order_id: 'order-1' },
                { order_id: 'order-2' },
                { order_id: 'order-3' },
              ],
            };
          }
          if (query.includes('order_holds')) {
            return {
              order_holds: [
                { agent_hold_amount: 50000 },
                { agent_hold_amount: 40000 },
                { agent_hold_amount: 30000 },
              ],
            };
          }
          return {};
        }
      );
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_application_configurations: { affected_rows: 1 },
      });

      const result = await service.checkAndEnforceLossGuard();

      expect(result).toEqual({
        exceeded: true,
        weeklyLoss: 120000,
        cap: 100000,
        autoDisabled: true,
      });

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('update_application_configurations'),
        {}
      );
    });

    it('should not auto-disable when flag already off (idempotent)', async () => {
      jest.spyOn(service, 'getHoldCeilingConfig').mockResolvedValue({
        enabled: false,
        ceilingXaf: 50000,
        pilotCity: 'Yaoundé',
        minCleanDeliveries: 10,
        lossWeeklyCapXaf: 100000,
      });

      hasuraSystemService.executeQuery.mockImplementation(
        async (query: string) => {
          if (query.includes('failed_deliveries')) {
            return {
              failed_deliveries: [{ order_id: 'order-1' }],
            };
          }
          if (query.includes('order_holds')) {
            return {
              order_holds: [{ agent_hold_amount: 120000 }],
            };
          }
          return {};
        }
      );

      const result = await service.checkAndEnforceLossGuard();

      expect(result).toEqual({
        exceeded: true,
        weeklyLoss: 120000,
        cap: 100000,
        autoDisabled: false,
      });

      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });
  });
});
