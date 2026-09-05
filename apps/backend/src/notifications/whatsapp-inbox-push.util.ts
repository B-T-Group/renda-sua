import { PlatformRoles } from '../rbac/platform-permissions';
import { normalizeLanguage } from './email-template-data';

export const WHATSAPP_INBOX_STAFF_ROLES: string[] = [
  PlatformRoles.SUPERUSER,
  PlatformRoles.WHATSAPP_MANAGER,
];

export function buildWhatsAppInboxPushCopy(params: {
  preview: string;
  customerPhone: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const french = normalizeLanguage(params.preferredLanguage) === 'fr';
  const preview = params.preview.trim();
  const fallback = params.customerPhone.trim();
  return {
    title: french ? 'Nouveau message WhatsApp' : 'New WhatsApp message',
    body:
      preview ||
      fallback ||
      (french ? 'Ouvrez la boîte de réception' : 'Open the inbox to reply'),
  };
}
