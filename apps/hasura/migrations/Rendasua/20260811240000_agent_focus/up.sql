CREATE TYPE public.agent_focus_enum AS ENUM ('delivery', 'commercial', 'both');

ALTER TABLE public.agents
  ADD COLUMN focus public.agent_focus_enum NOT NULL DEFAULT 'both';
