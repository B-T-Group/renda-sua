import { ConfigService } from '@nestjs/config';
import { HasuraSystemService } from './hasura-system.service';
import {
  GET_AGENT_LOCATION_CONSENT,
  UPDATE_AGENT_LOCATION_CONSENT_ANDROID,
  UPDATE_AGENT_LOCATION_CONSENT_IOS,
} from './hasura.queries';

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((query, chunk, index) => {
      return `${query}${chunk}${index < values.length ? values[index] : ''}`;
    }, ''),
}));

describe('HasuraSystemService', () => {
  let service: HasuraSystemService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    service = new HasuraSystemService({
      get: jest.fn().mockReturnValue({
        endpoint: 'http://hasura.test/v1/graphql',
        adminSecret: 'test-secret',
      }),
    } as unknown as ConfigService);
  });

  afterEach(() => {
    logSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('getAgentLocationConsent', () => {
    it('returns the iOS consent when platform is ios', async () => {
      const executeQuery = jest.spyOn(service, 'executeQuery').mockResolvedValue({
        agents_by_pk: {
          location_tracking_consent_ios: 'accepted_fg',
          location_tracking_consent_android: 'rejected',
        },
      });

      await expect(service.getAgentLocationConsent('agent-1', 'ios')).resolves.toBe(
        'accepted_fg'
      );
      expect(executeQuery).toHaveBeenCalledWith(GET_AGENT_LOCATION_CONSENT, {
        id: 'agent-1',
      });
    });

    it('returns the Android consent when platform is android', async () => {
      jest.spyOn(service, 'executeQuery').mockResolvedValue({
        agents_by_pk: {
          location_tracking_consent_ios: 'accepted_fg',
          location_tracking_consent_android: 'accepted_bg',
        },
      });

      await expect(
        service.getAgentLocationConsent('agent-1', 'android')
      ).resolves.toBe('accepted_bg');
    });

    it('returns null when the agent is missing', async () => {
      jest.spyOn(service, 'executeQuery').mockResolvedValue({
        agents_by_pk: null,
      });

      await expect(service.getAgentLocationConsent('agent-1', 'ios')).resolves.toBe(
        null
      );
    });
  });

  describe('updateAgentLocationConsent', () => {
    it('uses the iOS mutation when updating iOS consent', async () => {
      const row = {
        id: 'agent-1',
        location_tracking_consent_ios: 'accepted_fg',
        location_tracking_consent_android: 'not_shown',
      };
      const executeMutation = jest
        .spyOn(service, 'executeMutation')
        .mockResolvedValue({ update_agents_by_pk: row });

      await expect(
        service.updateAgentLocationConsent('agent-1', 'ios', 'accepted_fg')
      ).resolves.toEqual(row);
      expect(executeMutation).toHaveBeenCalledWith(
        UPDATE_AGENT_LOCATION_CONSENT_IOS,
        { id: 'agent-1', consent: 'accepted_fg' }
      );
    });

    it('uses the Android mutation when updating Android consent', async () => {
      const row = {
        id: 'agent-1',
        location_tracking_consent_ios: 'not_shown',
        location_tracking_consent_android: 'rejected',
      };
      const executeMutation = jest
        .spyOn(service, 'executeMutation')
        .mockResolvedValue({ update_agents_by_pk: row });

      await expect(
        service.updateAgentLocationConsent('agent-1', 'android', 'rejected')
      ).resolves.toEqual(row);
      expect(executeMutation).toHaveBeenCalledWith(
        UPDATE_AGENT_LOCATION_CONSENT_ANDROID,
        { id: 'agent-1', consent: 'rejected' }
      );
    });
  });
});
