-- Generic external commerce / inventory integration framework (Shopify first).

CREATE TYPE public.commerce_provider_enum AS ENUM ('shopify');

CREATE TYPE public.commerce_integration_status_enum AS ENUM (
  'pending',
  'connected',
  'error',
  'disconnected',
  'reauth_required'
);

CREATE TYPE public.commerce_entity_type_enum AS ENUM (
  'location',
  'product',
  'variant',
  'inventory_item',
  'inventory_level'
);

CREATE TYPE public.commerce_sync_direction_enum AS ENUM (
  'inbound',
  'outbound'
);

CREATE TYPE public.commerce_sync_trigger_enum AS ENUM (
  'INITIAL_IMPORT',
  'WEBHOOK',
  'RENDASUA_ORDER',
  'MANUAL_SYNC',
  'RECONCILIATION',
  'DISCONNECT'
);

CREATE TYPE public.commerce_sync_status_enum AS ENUM (
  'pending',
  'running',
  'success',
  'partial',
  'failed',
  'skipped'
);

CREATE TABLE public.commerce_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  provider public.commerce_provider_enum NOT NULL,
  external_shop_id TEXT NOT NULL,
  display_name TEXT,
  status public.commerce_integration_status_enum NOT NULL DEFAULT 'pending',
  access_token_encrypted TEXT,
  scopes TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commerce_integrations_provider_shop_unique UNIQUE (provider, external_shop_id),
  CONSTRAINT commerce_integrations_business_provider_unique UNIQUE (business_id, provider)
);

CREATE INDEX idx_commerce_integrations_business
  ON public.commerce_integrations (business_id);
CREATE INDEX idx_commerce_integrations_status
  ON public.commerce_integrations (status);

CREATE TRIGGER set_public_commerce_integrations_updated_at
  BEFORE UPDATE ON public.commerce_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.commerce_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.commerce_integrations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  entity_type public.commerce_entity_type_enum NOT NULL,
  internal_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  external_parent_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_external_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commerce_entity_mappings_external_unique
    UNIQUE (integration_id, entity_type, external_id),
  CONSTRAINT commerce_entity_mappings_internal_unique
    UNIQUE (integration_id, entity_type, internal_id)
);

CREATE INDEX idx_commerce_entity_mappings_integration
  ON public.commerce_entity_mappings (integration_id);
CREATE INDEX idx_commerce_entity_mappings_internal
  ON public.commerce_entity_mappings (entity_type, internal_id);
CREATE INDEX idx_commerce_entity_mappings_external
  ON public.commerce_entity_mappings (entity_type, external_id);

CREATE TRIGGER set_public_commerce_entity_mappings_updated_at
  BEFORE UPDATE ON public.commerce_entity_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.commerce_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.commerce_provider_enum NOT NULL,
  event_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  shop_domain TEXT,
  integration_id UUID REFERENCES public.commerce_integrations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  payload JSONB,
  status public.commerce_sync_status_enum NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT commerce_webhook_events_event_id_key UNIQUE (provider, event_id)
);

CREATE INDEX idx_commerce_webhook_events_status
  ON public.commerce_webhook_events (status, received_at);
CREATE INDEX idx_commerce_webhook_events_integration
  ON public.commerce_webhook_events (integration_id);

CREATE TABLE public.commerce_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.commerce_integrations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  trigger public.commerce_sync_trigger_enum NOT NULL,
  direction public.commerce_sync_direction_enum,
  entity_type public.commerce_entity_type_enum,
  status public.commerce_sync_status_enum NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commerce_sync_runs_integration
  ON public.commerce_sync_runs (integration_id, started_at DESC);

CREATE TABLE public.commerce_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID REFERENCES public.commerce_sync_runs(id) ON UPDATE CASCADE ON DELETE SET NULL,
  integration_id UUID NOT NULL REFERENCES public.commerce_integrations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  provider public.commerce_provider_enum NOT NULL,
  direction public.commerce_sync_direction_enum NOT NULL,
  entity_type public.commerce_entity_type_enum,
  internal_entity_id UUID,
  external_entity_id TEXT,
  trigger public.commerce_sync_trigger_enum NOT NULL,
  status public.commerce_sync_status_enum NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commerce_sync_events_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX idx_commerce_sync_events_integration
  ON public.commerce_sync_events (integration_id, started_at DESC);
CREATE INDEX idx_commerce_sync_events_status
  ON public.commerce_sync_events (status);

COMMENT ON TABLE public.commerce_integrations IS
  'Connected external commerce providers per Rendasua business';
COMMENT ON COLUMN public.commerce_integrations.access_token_encrypted IS
  'AES-256-GCM encrypted provider access token; never expose to clients';
COMMENT ON TABLE public.commerce_entity_mappings IS
  'Maps Rendasua entities to external provider entity IDs';
