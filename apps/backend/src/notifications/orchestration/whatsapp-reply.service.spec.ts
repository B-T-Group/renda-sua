import { WhatsAppReplyService } from './whatsapp-reply.service';

describe('WhatsAppReplyService', () => {
  const prefs = {
    findUserIdByPhoneE164: jest.fn(),
    disableWhatsApp: jest.fn(),
  };
  const analytics = { track: jest.fn() };
  const service = new WhatsAppReplyService(prefs as any, analytics as any);

  it('parses STOP and aliases', () => {
    expect(service.parseCommand('stop')).toBe('STOP');
    expect(service.parseCommand('UNSUBSCRIBE')).toBe('STOP');
    expect(service.parseCommand('picked up')).toBe('PICKED_UP');
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
});
