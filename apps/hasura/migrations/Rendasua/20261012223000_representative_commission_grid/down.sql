DROP TABLE IF EXISTS public.representative_commission_deductions;
DROP TABLE IF EXISTS public.representative_commission_premiums;
DROP TABLE IF EXISTS public.representative_commission_holds;
DROP TABLE IF EXISTS public.representative_commission_accruals;
DROP TABLE IF EXISTS public.representative_commission_statements;
DROP TABLE IF EXISTS public.representative_portfolio_exits;
DROP TABLE IF EXISTS public.representative_commission_grid_tiers;
DROP TABLE IF EXISTS public.representative_commission_grids;

DELETE FROM public.application_configurations
WHERE config_key = 'representative_portfolio_commission_enabled'
  AND country_code IS NULL;
