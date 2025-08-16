-- Create entity_types enum table
CREATE TABLE public.entity_types (
    id text PRIMARY KEY,
    comment text NOT NULL
);

-- Insert default entity types
INSERT INTO public.entity_types (id, comment) VALUES
    ('document', 'Document related messages'),
    ('order', 'Order related messages'),
    ('item', 'Item related messages'),
    ('agent', 'Agent related messages'),
    ('business', 'Business related messages'),
    ('client', 'Client related messages'),
    ('account', 'Account related messages'),
    ('address', 'Address related messages');
