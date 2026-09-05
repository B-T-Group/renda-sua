-- WhatsApp support inbox (Cloud API transcripts) + whatsapp_manager RBAC

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  customer_phone text NOT NULL,
  user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  last_customer_message_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text NOT NULL DEFAULT '',
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_conversations_last_message_at_idx
  ON public.whatsapp_conversations (last_message_at DESC);
CREATE INDEX whatsapp_conversations_status_idx
  ON public.whatsapp_conversations (status);
CREATE INDEX whatsapp_conversations_user_id_idx
  ON public.whatsapp_conversations (user_id);

COMMENT ON TABLE public.whatsapp_conversations IS
  'One WhatsApp Cloud API conversation per Meta wa_id for admin support inbox';

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wamid text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  source text NOT NULL
    CHECK (source IN ('user', 'agent_inbox', 'template', 'system')),
  type text NOT NULL DEFAULT 'text'
    CHECK (type IN (
      'text', 'image', 'audio', 'video', 'document',
      'location', 'interactive', 'unknown', 'template'
    )),
  body text NOT NULL DEFAULT '',
  raw_payload jsonb NOT NULL,
  sender_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_messages_conversation_created_idx
  ON public.whatsapp_messages (conversation_id, created_at);
CREATE INDEX whatsapp_messages_wamid_idx
  ON public.whatsapp_messages (wamid)
  WHERE wamid IS NOT NULL;

COMMENT ON TABLE public.whatsapp_messages IS
  'Append-only WhatsApp Cloud API messages for support inbox and analysis';

-- RBAC: inbox permission + dedicated manager role
INSERT INTO public.permissions (key, description, category)
VALUES (
  'platform.ops.whatsapp_inbox',
  'View and reply to WhatsApp support inbox conversations',
  'ops'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles (key, name, description, is_system)
VALUES (
  'whatsapp_manager',
  'WhatsApp manager',
  'Views and replies to WhatsApp support inbox messages',
  true
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'whatsapp_manager'
  AND p.key = 'platform.ops.whatsapp_inbox'
ON CONFLICT (role_id, permission_id) DO NOTHING;
