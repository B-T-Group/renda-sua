-- Platform RBAC: roles, permissions, and user assignments

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TYPE public.permission_effect AS ENUM ('allow', 'deny');

CREATE TABLE public.user_permissions (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  effect public.permission_effect NOT NULL DEFAULT 'allow',
  granted_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX user_roles_role_id_idx ON public.user_roles (role_id);
CREATE INDEX user_permissions_permission_id_idx ON public.user_permissions (permission_id);
CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions (permission_id);

COMMENT ON TABLE public.permissions IS 'Platform permission catalog (key = platform.domain.action)';
COMMENT ON TABLE public.roles IS 'Named platform roles; superuser implies all permissions in app logic';
COMMENT ON TABLE public.user_roles IS 'User to role assignments';
COMMENT ON TABLE public.user_permissions IS 'Direct permission allow/deny overrides; deny wins';

-- Seed permissions
INSERT INTO public.permissions (key, description, category) VALUES
  ('platform.moderate.items', 'Approve/reject sale items and AI item reviews', 'moderation'),
  ('platform.moderate.rentals', 'Approve/reject rental listings and AI rental reviews', 'moderation'),
  ('platform.ops.user_documents', 'View and approve/reject any user uploads', 'ops'),
  ('platform.manage.agents', 'List, verify, restore, and manage agents', 'people'),
  ('platform.manage.clients', 'List and manage clients', 'people'),
  ('platform.manage.businesses', 'List and manage businesses, lifecycle, tokens', 'people'),
  ('platform.ops.user_messages', 'View user messages and send admin broadcasts', 'ops'),
  ('platform.financial.refunds', 'Admin refunds force/retry/metrics', 'finance'),
  ('platform.financial.commissions', 'Commission accounts and withdrawals', 'finance'),
  ('platform.financial.mobile_payments', 'Resolve pending mobile payments', 'finance'),
  ('platform.locations.commission', 'Set platform commission percentages', 'finance'),
  ('platform.content.taxonomy', 'Categories and subcategories CRUD', 'content'),
  ('platform.content.brands', 'Brand create/update/delete', 'content'),
  ('platform.content.stripe_tax', 'Sync Stripe tax codes', 'content'),
  ('platform.config.application', 'Application configurations CRUD', 'config'),
  ('platform.config.country_onboarding', 'Country onboarding wizard', 'config'),
  ('platform.config.application_setup', 'Application setup read', 'config'),
  ('platform.ops.site_events', 'Site events reporting and export', 'ops'),
  ('platform.catalog.cross_business', 'Cross-business catalog access', 'ops'),
  ('platform.orders.cross_business', 'Read/message any order', 'ops'),
  ('platform.locations.transfers_admin', 'List/cancel all location transfers', 'ops'),
  ('platform.dashboard.platform_stats', 'Platform dashboard aggregates', 'ops'),
  ('platform.manage.contracts', 'Contract templates and admin contract actions', 'people'),
  ('platform.rbac.manage', 'Assign and revoke roles/permissions', 'rbac');

-- Seed roles
INSERT INTO public.roles (key, name, description, is_system) VALUES
  ('superuser', 'Superuser', 'Implicit all platform permissions', true),
  ('moderator', 'Moderator', 'Content moderation and document review', true),
  ('finance', 'Finance', 'Refunds, commissions, and payment ops', true),
  ('support', 'Support', 'Agents, clients, documents, and messaging support', true),
  ('content', 'Content', 'Taxonomy, brands, and tax content', true);

-- Role → permission mappings (superuser has none materialised; app grants all)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'moderator'
  AND p.key IN (
    'platform.moderate.items',
    'platform.moderate.rentals',
    'platform.ops.user_documents'
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'finance'
  AND p.key IN (
    'platform.financial.refunds',
    'platform.financial.commissions',
    'platform.financial.mobile_payments',
    'platform.locations.commission'
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'support'
  AND p.key IN (
    'platform.manage.agents',
    'platform.manage.clients',
    'platform.ops.user_documents',
    'platform.ops.user_messages',
    'platform.orders.cross_business'
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'content'
  AND p.key IN (
    'platform.content.taxonomy',
    'platform.content.brands',
    'platform.content.stripe_tax'
  );

-- Migrate existing platform admins to superuser role
INSERT INTO public.user_roles (user_id, role_id)
SELECT b.user_id, r.id
FROM public.businesses b
CROSS JOIN public.roles r
WHERE b.is_admin = true
  AND r.key = 'superuser'
ON CONFLICT DO NOTHING;
