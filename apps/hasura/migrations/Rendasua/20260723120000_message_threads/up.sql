-- Create message_threads table
-- Represents a superuser <-> user conversation thread
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  creator_last_read_at timestamptz,
  recipient_last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create thread_messages table
CREATE TABLE public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_message_threads_created_by ON public.message_threads(created_by_user_id);
CREATE INDEX idx_message_threads_recipient ON public.message_threads(recipient_user_id);
CREATE INDEX idx_message_threads_last_message_at ON public.message_threads(last_message_at DESC);
CREATE INDEX idx_thread_messages_thread_id ON public.thread_messages(thread_id);
CREATE INDEX idx_thread_messages_sender ON public.thread_messages(sender_user_id);
