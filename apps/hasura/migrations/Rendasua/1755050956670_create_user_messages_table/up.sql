-- Create user_messages table
CREATE TABLE public.user_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entity_type text NOT NULL REFERENCES public.entity_types(id) ON DELETE RESTRICT,
    entity_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_user_messages_user_id ON public.user_messages(user_id);
CREATE INDEX idx_user_messages_entity_type ON public.user_messages(entity_type);
CREATE INDEX idx_user_messages_entity_id ON public.user_messages(entity_id);
CREATE INDEX idx_user_messages_created_at ON public.user_messages(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_messages_updated_at 
    BEFORE UPDATE ON public.user_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
