export interface UserMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  message_type?: string;
  message_payload?: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  entity_type_info?: {
    id: string;
    comment: string;
  };
}
