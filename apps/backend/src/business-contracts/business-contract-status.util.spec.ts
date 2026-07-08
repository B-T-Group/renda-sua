import { createHmac } from 'crypto';
import { BoldsignWebhookVerifierService } from './boldsign-webhook-verifier.service';
import {
  canTransitionContractStatus,
  mapBoldSignEventToStatus,
} from './business-contract-status.util';

describe('business-contract-status.util', () => {
  it('maps BoldSign events to contract statuses', () => {
    expect(mapBoldSignEventToStatus('Completed')).toBe('signed');
    expect(mapBoldSignEventToStatus('Viewed')).toBe('viewed');
    expect(mapBoldSignEventToStatus('Reminder')).toBeNull();
  });

  it('allows valid transitions', () => {
    expect(canTransitionContractStatus('sent', 'viewed')).toBe(true);
    expect(canTransitionContractStatus('viewed', 'signed')).toBe(true);
    expect(canTransitionContractStatus('signed', 'viewed')).toBe(false);
  });
});

describe('BoldsignWebhookVerifierService', () => {
  const configService = {
    get: () => ({
      enabled: true,
      apiKey: 'key',
      baseUrl: 'https://api.boldsign.com',
      webhookSigningSecret: 'test-secret',
      reminderIntervalDays: 3,
      expirationDays: 30,
    }),
  } as any;

  it('verifies a valid signature', () => {
    const service = new BoldsignWebhookVerifierService(configService);
    const body = Buffer.from('{"event":{"eventType":"Completed"}}');
    const timestamp = '1234567890';
    const payload = `${timestamp}.${body.toString('utf8')}`;
    const sig = createHmac('sha256', 'test-secret').update(payload).digest('hex');
    const header = `t=${timestamp},s0=${sig}`;
    expect(service.verify(header, body)).toBe(true);
  });

  it('rejects tampered body', () => {
    const service = new BoldsignWebhookVerifierService(configService);
    const body = Buffer.from('{"tampered":true}');
    const timestamp = '1234567890';
    const payload = `${timestamp}.{"event":{"eventType":"Completed"}}`;
    const sig = createHmac('sha256', 'test-secret').update(payload).digest('hex');
    const header = `t=${timestamp},s0=${sig}`;
    expect(service.verify(header, body)).toBe(false);
  });
});
