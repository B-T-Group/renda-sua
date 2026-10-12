import { AgentContractGateService } from './agent-contract-gate.service';

describe('AgentContractGateService', () => {
  function gate(flag: boolean | null, signed: boolean) {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations:
          flag == null ? [] : [{ boolean_value: flag }],
      }),
    };
    const db = {
      hasSigned: jest.fn().mockResolvedValue(signed),
      signedAgentIds: jest.fn().mockResolvedValue(new Set(signed ? ['a1'] : [])),
    };
    return {
      service: new AgentContractGateService(hasura as never, db as never),
      db,
    };
  }

  it('blocks an unsigned agent when the flag row is missing', async () => {
    const { service } = gate(null, false);
    await expect(service.assertCanOperate('a1')).rejects.toMatchObject({
      response: { error: 'AGENT_CONTRACT_REQUIRED' },
    });
  });

  it('allows claims when the flag is off', async () => {
    const { service, db } = gate(false, false);
    await expect(service.canOperate('a1')).resolves.toBe(true);
    expect(db.hasSigned).not.toHaveBeenCalled();
  });

  it('allows a signed agent when the flag is on', async () => {
    const { service } = gate(true, true);
    await expect(service.canOperate('a1')).resolves.toBe(true);
  });

  it('returns null signed ids when the flag is off', async () => {
    const { service } = gate(false, false);
    await expect(service.signedIdsOrSkip(['a1'])).resolves.toBeNull();
  });
});
