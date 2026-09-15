-- Client-readable feature flags for reels and floating nav (default OFF).
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
  'reels_enabled',
  'Reels feature enabled',
  'When enabled, clients and merchants see the Reels tab and feed. Default off for safe rollout.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['reels', 'mobile', 'feature-flag']
),
(
  'reels_comments_enabled',
  'Reels comments enabled',
  'When enabled, users can comment on reels. Requires reels_enabled. Default off.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['reels', 'mobile', 'feature-flag']
),
(
  'reels_merchant_allowlist_only',
  'Reels merchant allowlist only',
  'When enabled, only allowlisted merchants can create reels. Default off (all merchants when reels enabled).',
  'boolean',
  false,
  'active',
  1,
  ARRAY['reels', 'merchant', 'feature-flag']
),
(
  'floating_nav_enabled',
  'Floating bottom navigation',
  'When enabled, mobile app uses the floating pill bottom nav style. Default off.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['mobile', 'navigation', 'feature-flag']
)
ON CONFLICT DO NOTHING;
