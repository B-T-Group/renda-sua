-- Location-scoped business delegation: catalog, grants, invites, audit, user type, flag.

INSERT INTO public.user_types (id, comment)
VALUES ('user', 'Identity-only user (no persona); used for location delegates')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.location_delegation_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.location_delegation_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT true,
  is_assignable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.location_delegation_role_permissions (
  role_id uuid NOT NULL REFERENCES public.location_delegation_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.location_delegation_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TYPE public.location_delegation_invite_status AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked',
  'superseded'
);

CREATE TYPE public.location_delegation_status AS ENUM (
  'active',
  'revoked'
);

CREATE TYPE public.location_delegation_event_type AS ENUM (
  'invited',
  'accepted',
  'revoked',
  'resent',
  'role_changed'
);

CREATE TABLE public.location_delegation_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status public.location_delegation_invite_status NOT NULL DEFAULT 'pending',
  role_id uuid NOT NULL REFERENCES public.location_delegation_roles(id),
  first_name text,
  last_name text,
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX location_delegation_invites_one_pending_email_location
  ON public.location_delegation_invites (lower(email), business_location_id)
  WHERE status = 'pending';

CREATE INDEX location_delegation_invites_location_idx
  ON public.location_delegation_invites (business_location_id);
CREATE INDEX location_delegation_invites_inviter_idx
  ON public.location_delegation_invites (invited_by_user_id);
CREATE INDEX location_delegation_invites_status_idx
  ON public.location_delegation_invites (status);

CREATE TABLE public.location_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.location_delegation_roles(id),
  status public.location_delegation_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX location_delegations_one_active_user_location
  ON public.location_delegations (user_id, business_location_id)
  WHERE status = 'active';

CREATE INDEX location_delegations_location_idx
  ON public.location_delegations (business_location_id);
CREATE INDEX location_delegations_user_idx
  ON public.location_delegations (user_id);
CREATE INDEX location_delegations_role_idx
  ON public.location_delegations (role_id);

CREATE TABLE public.location_delegation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.location_delegation_event_type NOT NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invite_id uuid REFERENCES public.location_delegation_invites(id) ON DELETE SET NULL,
  delegation_id uuid REFERENCES public.location_delegations(id) ON DELETE SET NULL,
  from_role_id uuid REFERENCES public.location_delegation_roles(id) ON DELETE SET NULL,
  to_role_id uuid REFERENCES public.location_delegation_roles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX location_delegation_events_delegation_idx
  ON public.location_delegation_events (delegation_id);
CREATE INDEX location_delegation_events_invite_idx
  ON public.location_delegation_events (invite_id);

COMMENT ON TABLE public.location_delegation_permissions IS
  'Delegation permission catalog (key = delegation.domain.action); separate from platform RBAC';
COMMENT ON TABLE public.location_delegation_roles IS
  'Named location-delegation roles; is_assignable gates invite/elevate';
COMMENT ON TABLE public.location_delegations IS
  'Active/revoked location grants; permissions resolve from current role_id';
COMMENT ON TABLE public.location_delegation_invites IS
  'Owner invites to a location; token stored as hash only';
COMMENT ON TABLE public.location_delegation_events IS
  'Audit trail for invite, accept, revoke, resend, and role change';

INSERT INTO public.location_delegation_permissions (key, description, category) VALUES
  ('delegation.orders.read', 'List, detail, events, and messages for location orders', 'orders'),
  ('delegation.orders.manage', 'Confirm, prep, cancel, status, pickup, pay-at-pickup, failed-delivery resolve', 'orders'),
  ('delegation.items.read', 'Reserved: list/detail catalog items at a location', 'items'),
  ('delegation.items.manage', 'Reserved: create/update inventory and variants at a location', 'items');

INSERT INTO public.location_delegation_roles (key, name, description, is_system, is_assignable) VALUES
  ('order_manager', 'Order Manager', 'Accept, prepare, cancel, and message orders at this location', true, true),
  ('catalog_manager', 'Catalog Manager', 'Manage catalog items at this location (not assignable in v1)', true, false),
  ('location_manager', 'Location Manager', 'Full location operations (not assignable in v1)', true, false);

INSERT INTO public.location_delegation_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.location_delegation_roles r
CROSS JOIN public.location_delegation_permissions p
WHERE r.key = 'order_manager'
  AND p.key IN ('delegation.orders.read', 'delegation.orders.manage');

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  status,
  version,
  tags
) VALUES (
  'location_delegations',
  'Location-scoped business delegation',
  'When enabled, owners can invite location delegates and /users/me returns delegation context. Default off.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['delegation', 'feature-flag', 'business']
);
