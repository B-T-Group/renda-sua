import { WhatsAppReplyService } from './whatsapp-reply.service';

describe('WhatsAppReplyService', () => {
  const prefs = {
    findUserIdByPhoneE164: jest.fn(),
    disableWhatsApp: jest.fn(),
  };
  const analytics = { track: jest.fn() };
  const orderActions = { handleAction: jest.fn() };
  const whatsapp = { isConfigured: () => false, sendSessionText: jest.fn() };
  const service = new WhatsAppReplyService(
    prefs as any,
    analytics as any,
    orderActions as any,
    whatsapp as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses STOP and aliases', () => {
    expect(service.parseCommand('stop')).toBe('STOP');
    expect(service.parseCommand('UNSUBSCRIBE')).toBe('STOP');
    expect(service.parseCommand('picked up')).toBe('PICKED_UP');
    expect(service.parseCommand('BUSY')).toBe('BUSY');
    expect(service.parseCommand('oui')).toBe('CONFIRM');
  });

  it('maps button reply ids', () => {
    expect(service.parseButtonReply('confirm')).toBe('CONFIRM');
    expect(service.parseButtonReply('busy')).toBe('BUSY');
    expect(service.parseButtonReply('decline')).toBe('DECLINE');
  });

  it('maps French quick-reply titles when Meta sends text as id', () => {
    expect(service.parseButtonReply('Confirmer', 'Confirmer')).toBe('CONFIRM');
    expect(service.parseButtonReply(undefined, 'Besoin de temps')).toBe('BUSY');
    expect(service.parseButtonReply('Refuser')).toBe('DECLINE');
  });

  it('disables whatsapp on STOP', async () => {
    prefs.findUserIdByPhoneE164.mockResolvedValue('user-1');
    const result = await service.handleInboundText({
      fromPhone: '15551234567',
      text: 'STOP',
      messageId: 'wamid.1',
    });
    expect(result.handled).toBe(true);
    expect(prefs.disableWhatsApp).toHaveBeenCalledWith('user-1');
    expect(analytics.track).toHaveBeenCalled();
  });

  it('routes CONFIRM to order actions', async () => {
    prefs.findUserIdByPhoneE164.mockResolvedValue('user-1');
    orderActions.handleAction.mockResolvedValue({
      handled: true,
      message: 'Order ORD-1 confirmed.',
    });
    const result = await service.handleInboundText({
      fromPhone: '15551234567',
      text: 'CONFIRM',
    });
    expect(orderActions.handleAction).toHaveBeenCalledWith({
      fromPhone: '15551234567',
      action: 'CONFIRM',
    });
    expect(result.handled).toBe(true);
  });
});
