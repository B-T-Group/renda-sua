-- System-generated documents (receipts, merchant agreements, training
-- completions) never go through admin review; mark existing rows approved.
UPDATE public.user_uploads uu
SET is_approved = true
FROM public.document_types dt
WHERE uu.document_type_id = dt.id
  AND dt.name IN (
    'order_receipt',
    'rendasua_contract_agreement',
    'rendasua_training_completion'
  )
  AND uu.is_approved = false;
