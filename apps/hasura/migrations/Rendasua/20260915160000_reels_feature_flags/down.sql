DELETE FROM public.application_configurations
WHERE config_key IN (
  'reels_enabled',
  'reels_comments_enabled',
  'reels_merchant_allowlist_only',
  'floating_nav_enabled'
);
