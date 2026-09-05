import { PlatformRoles } from '../rbac/platform-permissions';
import {
  WHATSAPP_INBOX_STAFF_ROLES,
  buildWhatsAppInboxPushCopy,
} from './whatsapp-inbox-push.util';

describe('whatsapp-inbox-push.util', () => {
  it('pages superusers and WhatsApp managers', () => {
    expect(WHATSAPP_INBOX_STAFF_ROLES).toEqual([
      PlatformRoles.SUPERUSER,
      PlatformRoles.WHATSAPP_MANAGER,
    ]);
  });

  it('prefers the message preview', () => {
    expect(
      buildWhatsAppInboxPushCopy({
        preview: '  Hello  ',
        customerPhone: '15551234',
        preferredLanguage: 'en',
      })
    ).toEqual({
      title: 'New WhatsApp message',
      body: 'Hello',
    });
  });

  it('falls back to the phone in French', () => {
    expect(
      buildWhatsAppInboxPushCopy({
        preview: ' ',
        customerPhone: '15551234',
        preferredLanguage: 'fr',
      })
    ).toEqual({
      title: 'Nouveau message WhatsApp',
      body: '15551234',
    });
  });
});
