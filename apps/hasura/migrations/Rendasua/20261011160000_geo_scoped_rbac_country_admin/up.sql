-- Geo-scoped platform role grants and the country_admin role.
-- A grant is global (both scope columns null), a whole country, or one state.

CREATE OR REPLACE FUNCTION public.geo_state_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        translate(
          lower(btrim(COALESCE(value, ''))),
          'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
          'aaaaaaeeeeiiiiooooouuuuyycn'
        ),
        ' (region province|province|region)$',
        ''
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.geo_state_key(text) IS
  'Normalized state name: lower case, accents stripped, Region/Province suffix removed.';

ALTER TABLE public.addresses
  ADD COLUMN state_key text
  GENERATED ALWAYS AS (public.geo_state_key(state)) STORED;

ALTER TABLE public.supported_country_states
  ADD COLUMN state_key text
  GENERATED ALWAYS AS (public.geo_state_key(state_name)) STORED;

CREATE INDEX addresses_state_key_idx ON public.addresses (state_key);
CREATE INDEX supported_country_states_state_key_idx
  ON public.supported_country_states (country_code, state_key);

ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_pkey;
ALTER TABLE public.user_roles
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ADD PRIMARY KEY (id);
ALTER TABLE public.user_roles
  ADD COLUMN country_code char(2) NULL,
  ADD COLUMN supported_country_state_id uuid NULL
    REFERENCES public.supported_country_states(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_state_requires_country
  CHECK (
    supported_country_state_id IS NULL OR country_code IS NOT NULL
  );

CREATE UNIQUE INDEX user_roles_global_unique
  ON public.user_roles (user_id, role_id)
  WHERE country_code IS NULL AND supported_country_state_id IS NULL;

CREATE UNIQUE INDEX user_roles_country_unique
  ON public.user_roles (user_id, role_id, country_code)
  WHERE country_code IS NOT NULL AND supported_country_state_id IS NULL;

CREATE UNIQUE INDEX user_roles_state_unique
  ON public.user_roles (user_id, role_id, supported_country_state_id)
  WHERE supported_country_state_id IS NOT NULL;

CREATE INDEX user_roles_country_code_idx ON public.user_roles (country_code);

CREATE OR REPLACE FUNCTION public.user_roles_assert_state_country()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  state_country char(2);
BEGIN
  IF NEW.supported_country_state_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT country_code INTO state_country
  FROM public.supported_country_states
  WHERE id = NEW.supported_country_state_id;
  IF state_country IS NULL OR btrim(state_country::text) <> btrim(NEW.country_code::text) THEN
    RAISE EXCEPTION 'supported_country_state country does not match country_code';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_roles_assert_state_country
  BEFORE INSERT OR UPDATE OF country_code, supported_country_state_id
  ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_roles_assert_state_country();

COMMENT ON COLUMN public.user_roles.country_code IS
  'ISO alpha-2. Null with a null state is a global grant. Set with a null state covers every state in the country.';
COMMENT ON COLUMN public.user_roles.supported_country_state_id IS
  'When set, the grant covers only that state. Several states are several rows.';

ALTER TABLE public.permissions
  ADD COLUMN geo_scopable boolean NOT NULL DEFAULT false;
ALTER TABLE public.roles
  ADD COLUMN requires_geo_scope boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.permissions.geo_scopable IS
  'True when endpoints enforce a country or state scope for this permission.';
COMMENT ON COLUMN public.roles.requires_geo_scope IS
  'True when the role may only be assigned with a country, not globally.';

INSERT INTO public.permissions (key, description, category, geo_scopable) VALUES
  (
    'platform.users.read',
    'Read agents, clients, and businesses in the granted country or state',
    'people',
    true
  ),
  (
    'platform.ops.map',
    'View the operations map for markets in the granted country or state',
    'ops',
    true
  )
ON CONFLICT (key) DO UPDATE SET geo_scopable = EXCLUDED.geo_scopable;

UPDATE public.permissions
SET geo_scopable = true
WHERE key IN (
  'platform.orders.cross_business',
  'platform.ops.credits'
);

INSERT INTO public.roles (key, name, description, is_system, requires_geo_scope)
VALUES (
  'country_admin',
  'Country admin',
  'Read-only people access plus order, map, pickup, and follow-up ops for a country or state',
  true,
  true
)
ON CONFLICT (key) DO UPDATE SET requires_geo_scope = true;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'country_admin'
  AND p.key IN (
    'platform.users.read',
    'platform.ops.map',
    'platform.orders.cross_business',
    'platform.ops.credits'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
