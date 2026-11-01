import { ClientConfirmDeliveryCronService } from './client-confirm-delivery.cron';

describe('ClientConfirmDeliveryCronService', () => {
  const autoCompleteDue = jest.fn();
  const processNonStripeStuck = jest.fn();
  let cron: ClientConfirmDeliveryCronService;

  beforeEach(() => {
    autoCompleteDue.mockReset();
    processNonStripeStuck.mockReset();
    cron = new ClientConfirmDeliveryCronService({
      autoCompleteDue,
      processNonStripeStuck,
    } as never);
  });

  it('skips an auto-complete tick that overlaps a run still in flight', async () => {
    let release: (value: unknown) => void = () => undefined;
    autoCompleteDue.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const first = cron.handleAutoComplete();
    await cron.handleAutoComplete();
    expect(autoCompleteDue).toHaveBeenCalledTimes(1);
    release({ completed: 0 });
    await first;
    autoCompleteDue.mockResolvedValue({ completed: 0 });
    await cron.handleAutoComplete();
    expect(autoCompleteDue).toHaveBeenCalledTimes(2);
  });

  it('clears the auto-complete guard when the sweep throws', async () => {
    autoCompleteDue.mockRejectedValueOnce(new Error('complete down'));
    await cron.handleAutoComplete();
    autoCompleteDue.mockResolvedValue({ completed: 0 });
    await cron.handleAutoComplete();
    expect(autoCompleteDue).toHaveBeenCalledTimes(2);
  });

  it('does not block non-Stripe reminders while auto-complete is in flight', async () => {
    let release: (value: unknown) => void = () => undefined;
    autoCompleteDue.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const first = cron.handleAutoComplete();
    processNonStripeStuck.mockResolvedValue({
      reminded1h: 0,
      reminded24h: 0,
      tickets: 0,
    });

    await cron.handleNonStripeStuck();

    expect(processNonStripeStuck).toHaveBeenCalledTimes(1);
    release({ completed: 0 });
    await first;
  });

  it('clears the stuck-sweep guard when the reminder pass throws', async () => {
    processNonStripeStuck.mockRejectedValueOnce(new Error('reminders down'));
    await cron.handleNonStripeStuck();
    processNonStripeStuck.mockResolvedValue({
      reminded1h: 0,
      reminded24h: 0,
      tickets: 0,
    });
    await cron.handleNonStripeStuck();
    expect(processNonStripeStuck).toHaveBeenCalledTimes(2);
  });
});
