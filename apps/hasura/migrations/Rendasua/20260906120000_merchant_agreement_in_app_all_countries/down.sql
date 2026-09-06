-- Restore US/CA to BoldSign default by removing their in_app rows.
-- Leave African markets (CM/GA/TG/BJ/CI/CG) as in_app.

DELETE FROM public.application_configurations
WHERE config_key = 'merchant_agreement_provider'
  AND country_code IN ('US', 'CA');
