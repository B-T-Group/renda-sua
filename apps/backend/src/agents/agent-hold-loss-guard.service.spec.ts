import { AgentHoldLossGuardService } from './agent-hold-loss-guard.service';

const passed = {
  exceeded: false,
  weeklyLoss: 0,
  cap: 100000,
  autoDisabled: false,
};

function harness() {
  const checkAndEnforceLossGuard = jest.fn();
  const service = new AgentHoldLossGuardService({
    checkAndEnforceLossGuard,
  } as any);
  return { service, checkAndEnforceLossGuard };
}

describe('AgentHoldLossGuardService', () => {
  it('skips a second hourly check while the first is still running', async () => {
    const { service, checkAndEnforceLossGuard } = harness();
    let release: (value: typeof passed) => void = () => undefined;
    checkAndEnforceLossGuard.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const first = service.checkLossGuard();
    await service.checkLossGuard();
    expect(checkAndEnforceLossGuard).toHaveBeenCalledTimes(1);

    release(passed);
    await first;
    await service.checkLossGuard();
    expect(checkAndEnforceLossGuard).toHaveBeenCalledTimes(2);
  });

  it('runs the next check after a failed one', async () => {
    const { service, checkAndEnforceLossGuard } = harness();
    checkAndEnforceLossGuard.mockRejectedValueOnce(new Error('hasura down'));
    checkAndEnforceLossGuard.mockResolvedValueOnce(passed);

    await service.checkLossGuard();
    await service.checkLossGuard();

    expect(checkAndEnforceLossGuard).toHaveBeenCalledTimes(2);
  });

  it('returns the loss-guard result from a manual check', async () => {
    const { service, checkAndEnforceLossGuard } = harness();
    const exceeded = {
      exceeded: true,
      weeklyLoss: 120000,
      cap: 100000,
      autoDisabled: true,
    };
    checkAndEnforceLossGuard.mockResolvedValue(exceeded);

    await expect(service.manualCheck()).resolves.toEqual(exceeded);
  });

  it('lets a manual check failure surface', async () => {
    const { service, checkAndEnforceLossGuard } = harness();
    checkAndEnforceLossGuard.mockRejectedValue(new Error('hasura down'));

    await expect(service.manualCheck()).rejects.toThrow('hasura down');
  });
});
