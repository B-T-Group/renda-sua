-- Support ticket types
CREATE TYPE public.support_ticket_type AS ENUM (
  'dispute',
  'complaint',
  'question'
);

-- Support ticket status
CREATE TYPE public.support_ticket_status AS ENUM (
  'open',
  'in_review',
  'resolved'
);

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type public.support_ticket_type NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  subject TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_support_tickets_order_id ON public.support_tickets(order_id);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

COMMENT ON TABLE public.support_tickets IS 'User support and dispute tickets linked to orders';
