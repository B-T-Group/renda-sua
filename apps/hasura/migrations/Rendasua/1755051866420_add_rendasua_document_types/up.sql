-- Add additional document types for Rendasua
INSERT INTO public.document_types (name, description) VALUES
    ('rendasua_contract_agreement', 'Rendasua Contract Agreement'),
    ('rendasua_training_completion', 'Rendasua Training Completion Certificate')
ON CONFLICT (name) DO NOTHING;
