export type WhatsAppInboxStatus = 'open' | 'closed';

export interface WhatsAppInboxConversation {
  id: string;
  waId: string;
  customerPhone: string;
  userId: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  lastCustomerMessageAt: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  status: WhatsAppInboxStatus;
  canReply: boolean;
}

export interface WhatsAppInboxMedia {
  id: string | null;
  mimeType: string | null;
  filename: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface WhatsAppInboxMessage {
  id: string;
  conversationId: string;
  wamid: string | null;
  direction: 'inbound' | 'outbound';
  source: string;
  type: string;
  body: string;
  senderUserId: string | null;
  senderDisplayName: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  media: WhatsAppInboxMedia | null;
}

export interface WhatsAppInboxListResult {
  items: WhatsAppInboxConversation[];
  total: number;
  configured: boolean;
}

export interface WhatsAppInboxThreadResult {
  conversation: WhatsAppInboxConversation;
  items: WhatsAppInboxMessage[];
  total: number;
  canReply: boolean;
}
