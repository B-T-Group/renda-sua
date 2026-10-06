DELETE FROM public.application_configurations
WHERE config_key IN (
  'assistant_launcher_v1',
  'assistant_shopping_v1'
);
