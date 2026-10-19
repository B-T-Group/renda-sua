/**
 * #616: CloudWatch must never show a recipient's full email or phone. The real
 * NotificationsService methods run with only Resend / the SMS client faked, and
 * every Logger call is captured.
 */
import { Logger } from '@nestjs/common';
import { inspect } from 'util';
import type { NotificationsService as RealNotificationsService } from './notifications.service';

// test-setup.ts stubs the service globally; this spec needs the real methods.
function realNotificationsService(): typeof RealNotificationsService {
  return jest.requireActual('./notifications.service').NotificationsService;
}

let logged: unknown[][] = [];
beforeEach(() => {
  logged = [];
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  }
});
afterEach(() => jest.restoreAllMocks());
const allLogs = () => logged.map((a) => inspect(a, { depth: 10 })).join('\n');

const EMAIL = 'jane.doe@example.com';

function service(send: jest.Mock, extra: Record<string, unknown> = {}) {
  const svc = Object.create(realNotificationsService().prototype) as any;
  Object.assign(svc, {
    logger: new Logger('NotificationsService'),
    resendClient: { emails: { send } },
    resendTemplateIds: { order_created: 'tpl_1' },
    fromEmail: 'Rendasua <noreply@rendasua.com>',
    renderNotificationHtmlTemplate: () => '<p>hi</p>',
    ...extra,
  });
  return svc;
}

describe('NotificationsService log lines mask recipients (#616)', () => {
  it('"Email sent to …" shows a masked email', async () => {
    const svc = service(jest.fn().mockResolvedValue({ error: null }));
    await svc.sendEmail({ to: EMAIL, templateKey: 'order_created', variables: { a: 1 } });
    expect(allLogs()).toContain('Email sent to ja***@example.com (template order_created)');
    expect(allLogs()).not.toContain('jane.doe');
  });

  it('"Failed to send email to …" shows a masked email', async () => {
    const svc = service(jest.fn().mockResolvedValue({ error: { message: 'boom' } }));
    await svc.sendEmail({ to: EMAIL, templateKey: 'order_created', variables: {} }).catch(() => undefined);
    expect(allLogs()).toContain('Failed to send email to ja***@example.com');
    expect(allLogs()).not.toContain('jane.doe');
  });

  it('referral HTML fallback log shows a masked email', async () => {
    const svc = service(jest.fn().mockResolvedValue({ error: null }));
    await svc.sendAgentBusinessReferredHtmlFallback(EMAIL, 'en', {});
    expect(allLogs()).toContain('Agent business referred email sent to ja***@example.com');
    expect(allLogs()).not.toContain('jane.doe');
  });

  it('Orange SMS log shows only the last 3 digits of a Togo number', async () => {
    const svc = service(jest.fn(), { smsService: { sendSms: jest.fn().mockResolvedValue({ success: true }) } });
    await svc.sendOrangeSmsQuiet('+22890123456', 'hello');
    expect(allLogs()).toContain('Order SMS sent via Orange to ***456');
    expect(allLogs()).not.toContain('90123456');
  });
});
