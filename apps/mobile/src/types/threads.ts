export interface MessageThread {
  id: string;
  subject: string | null;
  created_by_user_id: string;
  recipient_user_id: string;
  last_message_at: string;
  creator_last_read_at: string | null;
  recipient_last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

export interface ThreadParticipant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ThreadDetail extends MessageThread {
  creator?: ThreadParticipant;
  recipient?: ThreadParticipant;
  messages?: ThreadMessage[];
}

export interface ThreadListItem extends MessageThread {
  creator?: ThreadParticipant;
  recipient?: ThreadParticipant;
  messages?: Pick<ThreadMessage, 'id' | 'body' | 'created_at' | 'sender_user_id'>[];
}
