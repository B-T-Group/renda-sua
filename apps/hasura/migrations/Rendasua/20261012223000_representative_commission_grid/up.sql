-- Portfolio commission grid, accruals, monthly statements, and holds.
-- Amounts live on the grid row. The country flag only turns the pay on.

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  country_code,
  status,
  version,
  tags
)
SELECT
  'representative_portfolio_commission_enabled',
  'Portfolio commission grid',
  'When true, referred-merchant pay uses the portfolio commission grid instead of the 1% sale share and the first-sale bonus.',
  'boolean',
  false,
  NULL,
  'active',
  1,
  ARRAY['agents', 'commissions', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'representative_portfolio_commission_enabled'
    AND country_code IS NULL
);

CREATE TABLE public.representative_commission_grids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency public.currency_enum NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz NULL,
  base_percent numeric NOT NULL,
  cap_percent numeric NOT NULL,
  hold_percent numeric NOT NULL,
  hold_days int NOT NULL,
  registration_target int NOT NULL,
  objective_threshold_percent numeric NOT NULL,
  activation_amount numeric NOT NULL,
  activation_min_sales numeric NOT NULL,
  activation_window_days int NOT NULL,
  fast_start_amount numeric NOT NULL,
  fast_start_min_registrations int NOT NULL,
  fast_start_window_days int NOT NULL,
  fast_start_weekly_sales numeric NOT NULL,
  quarterly_amount numeric NOT NULL,
  quarterly_min_weeks int NOT NULL,
  quarterly_week_span int NOT NULL,
  quarterly_min_registrations_per_week int NOT NULL,
  quarterly_min_weekly_sales numeric NOT NULL,
  courier_amount numeric NOT NULL,
  courier_min_deliveries int NOT NULL,
  courier_window_days int NOT NULL,
  courier_max_per_month int NOT NULL,
  ambassador_amount numeric NOT NULL,
  ambassador_min_registrations int NOT NULL,
  ambassador_window_days int NOT NULL,
  inactive_days int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT representative_commission_grids_range_check CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

CREATE UNIQUE INDEX uq_representative_commission_grids_open
  ON public.representative_commission_grids (currency)
  WHERE effective_to IS NULL;

CREATE INDEX idx_representative_commission_grids_currency
  ON public.representative_commission_grids (currency, effective_from);

CREATE TABLE public.representative_commission_grid_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id uuid NOT NULL
    REFERENCES public.representative_commission_grids(id) ON UPDATE CASCADE ON DELETE CASCADE,
  min_monthly_sales numeric NOT NULL,
  max_monthly_sales numeric NULL,
  bonus_percent numeric NOT NULL,
  sort_order int NOT NULL
);

CREATE INDEX idx_representative_commission_grid_tiers_grid
  ON public.representative_commission_grid_tiers (grid_id, sort_order);

CREATE TABLE public.representative_portfolio_exits (
  business_id uuid PRIMARY KEY
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  exited_at timestamptz NOT NULL,
  reason text NOT NULL
);

CREATE TABLE public.representative_commission_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency public.currency_enum NOT NULL,
  period_start date NOT NULL,
  grid_id uuid NULL
    REFERENCES public.representative_commission_grids(id) ON UPDATE CASCADE ON DELETE SET NULL,
  eligible_total numeric NOT NULL DEFAULT 0,
  gmv_total numeric NOT NULL DEFAULT 0,
  registration_count int NOT NULL DEFAULT 0,
  objective_met boolean NOT NULL DEFAULT false,
  growth_percent numeric NOT NULL DEFAULT 0,
  base_amount numeric NOT NULL DEFAULT 0,
  growth_amount numeric NOT NULL DEFAULT 0,
  activation_earned numeric NOT NULL DEFAULT 0,
  activation_paid numeric NOT NULL DEFAULT 0,
  fast_start_earned numeric NOT NULL DEFAULT 0,
  fast_start_paid numeric NOT NULL DEFAULT 0,
  quarterly_earned numeric NOT NULL DEFAULT 0,
  quarterly_paid numeric NOT NULL DEFAULT 0,
  in_cap_total numeric NOT NULL DEFAULT 0,
  payable_amount numeric NOT NULL DEFAULT 0,
  hold_amount numeric NOT NULL DEFAULT 0,
  recruitment_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'credited')),
  credited_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_representative_commission_statements_period
    UNIQUE (agent_id, currency, period_start)
);

CREATE TABLE public.representative_commission_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE
    REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  business_id uuid NOT NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency public.currency_enum NOT NULL,
  item_commission numeric NOT NULL,
  uncollected_delivery numeric NOT NULL,
  eligible_amount numeric NOT NULL,
  gmv_amount numeric NOT NULL,
  self_purchase boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'zeroed')),
  statement_id uuid NULL
    REFERENCES public.representative_commission_statements(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_representative_commission_accruals_agent
  ON public.representative_commission_accruals (agent_id, status);

CREATE TABLE public.representative_commission_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL
    REFERENCES public.representative_commission_statements(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency public.currency_enum NOT NULL,
  amount numeric NOT NULL,
  remaining numeric NOT NULL,
  release_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'released', 'clawed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_representative_commission_holds_release
  ON public.representative_commission_holds (status, release_at);

CREATE TABLE public.representative_commission_premiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency public.currency_enum NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('activation', 'fast_start', 'quarterly', 'courier', 'ambassador')),
  subject_id uuid NOT NULL,
  earned_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL
    CHECK (status IN ('paid', 'lost', 'clawed')),
  qualified_at timestamptz NULL,
  statement_id uuid NULL
    REFERENCES public.representative_commission_statements(id) ON UPDATE CASCADE ON DELETE SET NULL,
  period_start date NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_representative_commission_premiums_once
  ON public.representative_commission_premiums (kind, subject_id)
  WHERE kind IN ('activation', 'fast_start', 'courier', 'ambassador');

CREATE UNIQUE INDEX uq_representative_commission_premiums_quarter
  ON public.representative_commission_premiums (agent_id, period_start)
  WHERE kind = 'quarterly';

CREATE TABLE public.representative_commission_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  currency public.currency_enum NOT NULL,
  order_id uuid NULL
    REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL,
  amount numeric NOT NULL,
  remaining numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

WITH grid AS (
  INSERT INTO public.representative_commission_grids (
    currency, effective_from,
    base_percent, cap_percent, hold_percent, hold_days,
    registration_target, objective_threshold_percent,
    activation_amount, activation_min_sales, activation_window_days,
    fast_start_amount, fast_start_min_registrations, fast_start_window_days,
    fast_start_weekly_sales,
    quarterly_amount, quarterly_min_weeks, quarterly_week_span,
    quarterly_min_registrations_per_week, quarterly_min_weekly_sales,
    courier_amount, courier_min_deliveries, courier_window_days, courier_max_per_month,
    ambassador_amount, ambassador_min_registrations, ambassador_window_days,
    inactive_days
  ) VALUES (
    'XAF', now(),
    10, 13, 10, 90,
    40, 70,
    4000, 200000, 60,
    120000, 120, 90,
    4000000,
    100000, 10, 13,
    10, 4000000,
    8000, 25, 45, 20,
    20000, 20, 60,
    90
  )
  RETURNING id
)
INSERT INTO public.representative_commission_grid_tiers (
  grid_id, min_monthly_sales, max_monthly_sales, bonus_percent, sort_order
)
SELECT grid.id, tier.min_sales, tier.max_sales, tier.bonus, tier.sort_order
FROM grid
CROSS JOIN (
  VALUES
    (0::numeric, 17319999::numeric, 0::numeric, 0),
    (17320000, 39999999, 0.5, 1),
    (40000000, 99999999, 1, 2),
    (100000000, 199999999, 1.5, 3),
    (200000000, NULL, 2, 4)
) AS tier(min_sales, max_sales, bonus, sort_order);
