import { Test, TestingModule } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { AgentHoldService } from './agent-hold.service';

describe('AgentHoldService', () => {
  let service: AgentHoldService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;

  const defaultConfig = {
    internalAgentHoldPercentage: 0,
    verifiedAgentHoldPercentage: 80,
    unverifiedAgentHoldPercentage: 100,
  };

  beforeEach(async () => {
    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
    };
    const mockHasuraUserService = {
      getUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentHoldService,
        { provide: HasuraSystemService, useValue: mockHasuraSystemService },
        { provide: HasuraUserService, useValue: mockHasuraUserService },
      ],
    }).compile();

    service = module.get<AgentHoldService>(AgentHoldService);
    hasuraSystemService = module.get(HasuraSystemService);
    hasuraUserService = module.get(HasuraUserService);

    hasuraSystemService.executeQuery.mockResolvedValue({
      application_configurations: [
        { config_key: 'internal_agent_hold_percentage', number_value: 0 },
        { config_key: 'verified_agent_hold_percentage', number_value: 80 },
        { config_key: 'unverified_agent_hold_percentage', number_value: 100 },
      ],
    });
  });

  describe('getHoldPercentageConfigs', () => {
    it('should return default config when all keys present', async () => {
      const config = await service.getHoldPercentageConfigs();
      expect(config).toEqual(defaultConfig);
    });

    it('should use defaults for missing keys', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        application_configurations: [
          { config_key: 'verified_agent_hold_percentage', number_value: 50 },
        ],
      });
      const config = await service.getHoldPercentageConfigs();
      expect(config.internalAgentHoldPercentage).toBe(0);
      expect(config.verifiedAgentHoldPercentage).toBe(50);
      expect(config.unverifiedAgentHoldPercentage).toBe(100);
    });
  });

  describe('getHoldPercentageForAgentSync', () => {
    it('should return 0 for internal agent', () => {
      const result = service.getHoldPercentageForAgentSync(
        { is_internal: true, is_verified: true },
        defaultConfig
      );
      expect(result).toBe(0);
    });

    it('should return verified percentage for verified non-internal agent', () => {
      const result = service.getHoldPercentageForAgentSync(
        { is_internal: false, is_verified: true },
        defaultConfig
      );
      expect(result).toBe(80);
    });

    it('should return unverified percentage for unverified agent', () => {
      const result = service.getHoldPercentageForAgentSync(
        { is_internal: false, is_verified: false },
        defaultConfig
      );
      expect(result).toBe(100);
    });
  });

  describe('getHoldPercentageForAgent', () => {
    it('should return 0 when current user agent is internal', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        agent: { is_internal: true, is_verified: true },
      } as any);
      const result = await service.getHoldPercentageForAgent();
      expect(result).toBe(0);
    });

    it('should return 80 when current user agent is verified but not internal', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        agent: { is_internal: false, is_verified: true },
      } as any);
      const result = await service.getHoldPercentageForAgent();
      expect(result).toBe(80);
    });

    it('should return 100 when current user agent is unverified', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        agent: { is_internal: false, is_verified: false },
      } as any);
      const result = await service.getHoldPercentageForAgent();
      expect(result).toBe(100);
    });

    it('should return correct percentage when agentId provided', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({
          application_configurations: [
            { config_key: 'internal_agent_hold_percentage', number_value: 0 },
            { config_key: 'verified_agent_hold_percentage', number_value: 80 },
            { config_key: 'unverified_agent_hold_percentage', number_value: 100 },
          ],
        })
        .mockResolvedValueOnce({
          agents_by_pk: { is_internal: true, is_verified: true },
        });
      const result = await service.getHoldPercentageForAgent('agent-1');
      expect(result).toBe(0);
    });
  });
});
