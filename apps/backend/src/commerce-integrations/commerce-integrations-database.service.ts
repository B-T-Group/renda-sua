import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  CommerceEntityType,
  CommerceIntegrationStatus,
  CommerceProvider,
  CommerceSyncDirection,
  CommerceSyncStatus,
  CommerceSyncTrigger,
} from './connectors/commerce-connector';

export interface CommerceIntegrationRow {
  id: string;
  business_id: string;
  provider: CommerceProvider;
  external_shop_id: string;
  display_name: string | null;
  status: CommerceIntegrationStatus;
  access_token_encrypted: string | null;
  scopes: string | null;
  provider_metadata: Record<string, unknown>;
  feature_flags: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommerceEntityMappingRow {
  id: string;
  integration_id: string;
  entity_type: CommerceEntityType;
  internal_id: string;
  external_id: string;
  external_parent_id: string | null;
  sync_enabled: boolean;
  metadata: Record<string, unknown>;
  last_synced_at: string | null;
  last_external_updated_at: string | null;
}

@Injectable()
export class CommerceIntegrationsDatabaseService {
  private readonly logger = new Logger(CommerceIntegrationsDatabaseService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async findIntegrationById(
    id: string
  ): Promise<CommerceIntegrationRow | null> {
    const q = `
      query ($id: uuid!) {
        commerce_integrations_by_pk(id: $id) {
          id business_id provider external_shop_id display_name status
          access_token_encrypted scopes provider_metadata feature_flags
          last_synced_at last_error created_at updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_integrations_by_pk: CommerceIntegrationRow | null;
    }>(q, { id });
    return res.commerce_integrations_by_pk;
  }

  async findIntegrationByBusinessAndProvider(
    businessId: string,
    provider: CommerceProvider
  ): Promise<CommerceIntegrationRow | null> {
    const q = `
      query ($businessId: uuid!, $provider: commerce_provider_enum!) {
        commerce_integrations(
          where: { business_id: { _eq: $businessId }, provider: { _eq: $provider } }
          limit: 1
        ) {
          id business_id provider external_shop_id display_name status
          access_token_encrypted scopes provider_metadata feature_flags
          last_synced_at last_error created_at updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_integrations: CommerceIntegrationRow[];
    }>(q, { businessId, provider });
    return res.commerce_integrations[0] ?? null;
  }

  async findIntegrationByShop(
    provider: CommerceProvider,
    externalShopId: string
  ): Promise<CommerceIntegrationRow | null> {
    const q = `
      query ($provider: commerce_provider_enum!, $shop: String!) {
        commerce_integrations(
          where: {
            provider: { _eq: $provider }
            external_shop_id: { _eq: $shop }
          }
          limit: 1
        ) {
          id business_id provider external_shop_id display_name status
          access_token_encrypted scopes provider_metadata feature_flags
          last_synced_at last_error created_at updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_integrations: CommerceIntegrationRow[];
    }>(q, { provider, shop: externalShopId });
    return res.commerce_integrations[0] ?? null;
  }

  async listIntegrationsForBusiness(
    businessId: string
  ): Promise<CommerceIntegrationRow[]> {
    const q = `
      query ($businessId: uuid!) {
        commerce_integrations(
          where: { business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
        ) {
          id business_id provider external_shop_id display_name status
          scopes provider_metadata feature_flags
          last_synced_at last_error created_at updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_integrations: CommerceIntegrationRow[];
    }>(q, { businessId });
    return res.commerce_integrations;
  }

  async listConnectedIntegrations(): Promise<CommerceIntegrationRow[]> {
    const q = `
      query {
        commerce_integrations(where: { status: { _eq: connected } }) {
          id business_id provider external_shop_id display_name status
          access_token_encrypted scopes provider_metadata feature_flags
          last_synced_at last_error created_at updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_integrations: CommerceIntegrationRow[];
    }>(q);
    return res.commerce_integrations;
  }

  async upsertIntegration(data: {
    business_id: string;
    provider: CommerceProvider;
    external_shop_id: string;
    display_name?: string;
    status: CommerceIntegrationStatus;
    access_token_encrypted?: string | null;
    scopes?: string;
    provider_metadata?: Record<string, unknown>;
  }): Promise<CommerceIntegrationRow> {
    const mutation = `
      mutation ($object: commerce_integrations_insert_input!) {
        insert_commerce_integrations_one(
          object: $object
          on_conflict: {
            constraint: commerce_integrations_business_provider_unique
            update_columns: [
              external_shop_id
              display_name
              status
              access_token_encrypted
              scopes
              provider_metadata
              last_error
              updated_at
            ]
          }
        ) {
          id business_id provider external_shop_id display_name status
          access_token_encrypted scopes provider_metadata feature_flags
          last_synced_at last_error created_at updated_at
        }
      }
    `;
    const res = await this.hasura.executeMutation<{
      insert_commerce_integrations_one: CommerceIntegrationRow;
    }>(mutation, {
      object: {
        ...data,
        provider_metadata: data.provider_metadata ?? {},
        last_error: null,
      },
    });
    return res.insert_commerce_integrations_one;
  }

  async updateIntegration(
    id: string,
    updates: Partial<{
      status: CommerceIntegrationStatus;
      access_token_encrypted: string | null;
      display_name: string;
      scopes: string;
      provider_metadata: Record<string, unknown>;
      feature_flags: Record<string, unknown>;
      last_synced_at: string;
      last_error: string | null;
    }>
  ): Promise<void> {
    const mutation = `
      mutation ($id: uuid!, $updates: commerce_integrations_set_input!) {
        update_commerce_integrations_by_pk(
          pk_columns: { id: $id }
          _set: $updates
        ) { id }
      }
    `;
    await this.hasura.executeMutation(mutation, { id, updates });
  }

  async upsertMapping(data: {
    integration_id: string;
    entity_type: CommerceEntityType;
    internal_id: string;
    external_id: string;
    external_parent_id?: string | null;
    sync_enabled?: boolean;
    metadata?: Record<string, unknown>;
    last_synced_at?: string;
    last_external_updated_at?: string;
  }): Promise<CommerceEntityMappingRow> {
    const mutation = `
      mutation ($object: commerce_entity_mappings_insert_input!) {
        insert_commerce_entity_mappings_one(
          object: $object
          on_conflict: {
            constraint: commerce_entity_mappings_external_unique
            update_columns: [
              internal_id
              external_parent_id
              sync_enabled
              metadata
              last_synced_at
              last_external_updated_at
              updated_at
            ]
          }
        ) {
          id integration_id entity_type internal_id external_id
          external_parent_id sync_enabled metadata
          last_synced_at last_external_updated_at
        }
      }
    `;
    const res = await this.hasura.executeMutation<{
      insert_commerce_entity_mappings_one: CommerceEntityMappingRow;
    }>(mutation, {
      object: {
        ...data,
        sync_enabled: data.sync_enabled ?? true,
        metadata: data.metadata ?? {},
      },
    });
    return res.insert_commerce_entity_mappings_one;
  }

  async listMappings(
    integrationId: string,
    entityType?: CommerceEntityType
  ): Promise<CommerceEntityMappingRow[]> {
    const q = `
      query ($integrationId: uuid!, $where: commerce_entity_mappings_bool_exp!) {
        commerce_entity_mappings(
          where: {
            _and: [
              { integration_id: { _eq: $integrationId } }
              $where
            ]
          }
        ) {
          id integration_id entity_type internal_id external_id
          external_parent_id sync_enabled metadata
          last_synced_at last_external_updated_at
        }
      }
    `;
    const where = entityType
      ? { entity_type: { _eq: entityType } }
      : {};
    const res = await this.hasura.executeQuery<{
      commerce_entity_mappings: CommerceEntityMappingRow[];
    }>(q, { integrationId, where });
    return res.commerce_entity_mappings;
  }

  async findMappingByExternal(
    integrationId: string,
    entityType: CommerceEntityType,
    externalId: string
  ): Promise<CommerceEntityMappingRow | null> {
    const q = `
      query ($integrationId: uuid!, $entityType: commerce_entity_type_enum!, $externalId: String!) {
        commerce_entity_mappings(
          where: {
            integration_id: { _eq: $integrationId }
            entity_type: { _eq: $entityType }
            external_id: { _eq: $externalId }
          }
          limit: 1
        ) {
          id integration_id entity_type internal_id external_id
          external_parent_id sync_enabled metadata
          last_synced_at last_external_updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_entity_mappings: CommerceEntityMappingRow[];
    }>(q, { integrationId, entityType, externalId });
    return res.commerce_entity_mappings[0] ?? null;
  }

  async findMappingByInternal(
    integrationId: string,
    entityType: CommerceEntityType,
    internalId: string
  ): Promise<CommerceEntityMappingRow | null> {
    const q = `
      query ($integrationId: uuid!, $entityType: commerce_entity_type_enum!, $internalId: uuid!) {
        commerce_entity_mappings(
          where: {
            integration_id: { _eq: $integrationId }
            entity_type: { _eq: $entityType }
            internal_id: { _eq: $internalId }
          }
          limit: 1
        ) {
          id integration_id entity_type internal_id external_id
          external_parent_id sync_enabled metadata
          last_synced_at last_external_updated_at
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_entity_mappings: CommerceEntityMappingRow[];
    }>(q, { integrationId, entityType, internalId });
    return res.commerce_entity_mappings[0] ?? null;
  }

  async updateMapping(
    id: string,
    updates: Partial<{
      sync_enabled: boolean;
      metadata: Record<string, unknown>;
      last_synced_at: string;
      last_external_updated_at: string;
      internal_id: string;
    }>
  ): Promise<void> {
    const mutation = `
      mutation ($id: uuid!, $updates: commerce_entity_mappings_set_input!) {
        update_commerce_entity_mappings_by_pk(
          pk_columns: { id: $id }
          _set: $updates
        ) { id }
      }
    `;
    await this.hasura.executeMutation(mutation, { id, updates });
  }

  async recordWebhookEvent(data: {
    provider: CommerceProvider;
    event_id: string;
    topic: string;
    shop_domain?: string;
    integration_id?: string;
    payload?: unknown;
  }): Promise<boolean> {
    const mutation = `
      mutation ($object: commerce_webhook_events_insert_input!) {
        insert_commerce_webhook_events_one(
          object: $object
          on_conflict: {
            constraint: commerce_webhook_events_event_id_key
            update_columns: []
          }
        ) { id }
      }
    `;
    const res = await this.hasura.executeMutation<{
      insert_commerce_webhook_events_one: { id: string } | null;
    }>(mutation, {
      object: {
        provider: data.provider,
        event_id: data.event_id,
        topic: data.topic,
        shop_domain: data.shop_domain,
        integration_id: data.integration_id,
        payload: data.payload ?? {},
        status: 'pending',
      },
    });
    return !!res.insert_commerce_webhook_events_one?.id;
  }

  async markWebhookProcessed(
    provider: CommerceProvider,
    eventId: string,
    status: CommerceSyncStatus,
    error?: string
  ): Promise<void> {
    const mutation = `
      mutation (
        $provider: commerce_provider_enum!
        $eventId: String!
        $status: commerce_sync_status_enum!
        $error: String
      ) {
        update_commerce_webhook_events(
          where: {
            provider: { _eq: $provider }
            event_id: { _eq: $eventId }
          }
          _set: {
            status: $status
            error: $error
            processed_at: "now()"
          }
        ) { affected_rows }
      }
    `;
    await this.hasura.executeMutation(mutation, {
      provider,
      eventId,
      status,
      error: error ?? null,
    });
  }

  async createSyncRun(data: {
    integration_id: string;
    trigger: CommerceSyncTrigger;
    direction?: CommerceSyncDirection;
    entity_type?: CommerceEntityType;
    status?: CommerceSyncStatus;
  }): Promise<string> {
    const mutation = `
      mutation ($object: commerce_sync_runs_insert_input!) {
        insert_commerce_sync_runs_one(object: $object) { id }
      }
    `;
    const res = await this.hasura.executeMutation<{
      insert_commerce_sync_runs_one: { id: string };
    }>(mutation, {
      object: {
        ...data,
        status: data.status ?? 'running',
      },
    });
    return res.insert_commerce_sync_runs_one.id;
  }

  async completeSyncRun(
    id: string,
    status: CommerceSyncStatus,
    summary?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const mutation = `
      mutation (
        $id: uuid!
        $status: commerce_sync_status_enum!
        $summary: jsonb
        $error: String
      ) {
        update_commerce_sync_runs_by_pk(
          pk_columns: { id: $id }
          _set: {
            status: $status
            summary: $summary
            error: $error
            completed_at: "now()"
          }
        ) { id }
      }
    `;
    await this.hasura.executeMutation(mutation, {
      id,
      status,
      summary: summary ?? {},
      error: error ?? null,
    });
  }

  async listSyncRuns(
    integrationId: string,
    limit = 20
  ): Promise<
    Array<{
      id: string;
      trigger: string;
      direction: string | null;
      status: string;
      started_at: string;
      completed_at: string | null;
      error: string | null;
      summary: Record<string, unknown>;
    }>
  > {
    const q = `
      query ($integrationId: uuid!, $limit: Int!) {
        commerce_sync_runs(
          where: { integration_id: { _eq: $integrationId } }
          order_by: { started_at: desc }
          limit: $limit
        ) {
          id trigger direction status started_at completed_at error summary
        }
      }
    `;
    const res = await this.hasura.executeQuery<{
      commerce_sync_runs: Array<{
        id: string;
        trigger: string;
        direction: string | null;
        status: string;
        started_at: string;
        completed_at: string | null;
        error: string | null;
        summary: Record<string, unknown>;
      }>;
    }>(q, { integrationId, limit });
    return res.commerce_sync_runs;
  }

  async recordSyncEvent(data: {
    sync_run_id?: string;
    integration_id: string;
    provider: CommerceProvider;
    direction: CommerceSyncDirection;
    entity_type?: CommerceEntityType;
    internal_entity_id?: string;
    external_entity_id?: string;
    trigger: CommerceSyncTrigger;
    status: CommerceSyncStatus;
    error?: string;
    idempotency_key?: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const mutation = `
      mutation ($object: commerce_sync_events_insert_input!) {
        insert_commerce_sync_events_one(
          object: $object
          on_conflict: {
            constraint: commerce_sync_events_idempotency_key_unique
            update_columns: []
          }
        ) { id }
      }
    `;
    try {
      const res = await this.hasura.executeMutation<{
        insert_commerce_sync_events_one: { id: string } | null;
      }>(mutation, {
        object: {
          ...data,
          metadata: data.metadata ?? {},
          completed_at:
            data.status === 'success' ||
            data.status === 'failed' ||
            data.status === 'skipped'
              ? new Date().toISOString()
              : null,
        },
      });
      return !!res.insert_commerce_sync_events_one?.id;
    } catch (error: any) {
      this.logger.warn(`recordSyncEvent failed: ${error?.message}`);
      return false;
    }
  }

  async markSyncEventByIdempotencyKey(
    idempotencyKey: string,
    status: CommerceSyncStatus,
    error?: string
  ): Promise<void> {
    const mutation = `
      mutation (
        $idempotencyKey: String!
        $status: commerce_sync_status_enum!
        $error: String
      ) {
        update_commerce_sync_events(
          where: { idempotency_key: { _eq: $idempotencyKey } }
          _set: {
            status: $status
            error: $error
            completed_at: "now()"
          }
        ) { affected_rows }
      }
    `;
    await this.hasura.executeMutation(mutation, {
      idempotencyKey,
      status,
      error: error ?? null,
    });
  }
}
