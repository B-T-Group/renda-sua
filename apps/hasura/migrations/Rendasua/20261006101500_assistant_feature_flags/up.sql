-- Client-readable feature flags for shopping assistant (#451 PR-0/PR-1).
-- Phase 0b: assistant_launcher_v1 gates orb, nudge, chips (restyle ships unflagged).
-- Phase 1: assistant_shopping_v1 (per market) gates search_catalog and get_reorder_options tools.
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  status,
  version,
  tags
) VALUES
(
  'assistant_launcher_v1',
  'Shopping assistant launcher v1',
  'When enabled, clients and guests see the animated Renda orb, first-run nudge, and quick-question chips. Default off for safe Phase 0b rollout.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['assistant', 'mobile', 'web', 'feature-flag']
),
(
  'assistant_shopping_v1',
  'Shopping assistant catalog tools v1',
  'When enabled in a market, assistant can use search_catalog and get_reorder_options to show item/store/reorder cards. Requires assistant_launcher_v1. Per-country rollout after Phase 0b intent gate (≥15%). Default off.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['assistant', 'shopping', 'mobile', 'web', 'feature-flag', 'per-market']
)
ON CONFLICT DO NOTHING;
