-- Remove additional document types for Rendasua
DELETE FROM public.document_types WHERE name IN (
    'rendasua_contract_agreement',
    'rendasua_training_completion'
);
