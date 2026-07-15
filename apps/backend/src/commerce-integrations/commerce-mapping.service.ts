import { Injectable } from '@nestjs/common';
import { BusinessItemsAccessService } from '../business-items/business-items-access.service';
import { CommerceConnectionService } from './commerce-connection.service';
import { CommerceIntegrationsDatabaseService } from './commerce-integrations-database.service';

@Injectable()
export class CommerceMappingService {
  constructor(
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly connection: CommerceConnectionService,
    private readonly access: BusinessItemsAccessService
  ) {}

  async listExternalLocations(integrationId: string, businessId?: string) {
    const ctx = await this.access.resolveAccess(businessId);
    const integration = await this.connection.requireOwnedIntegration(
      integrationId,
      ctx.targetBusinessId
    );
    const { token, connector } = this.connection.getDecryptedAccess(
      integration.provider,
      integration
    );
    const locations = await connector.listLocations(
      token,
      integration.external_shop_id
    );
    const mappings = await this.db.listMappings(integrationId, 'location');
    const byExternal = new Map(mappings.map((m) => [m.external_id, m]));
    return locations.map((loc) => ({
      ...loc,
      mapping: byExternal.get(loc.externalId)
        ? {
            internalId: byExternal.get(loc.externalId)!.internal_id,
            syncEnabled: byExternal.get(loc.externalId)!.sync_enabled,
            mappingId: byExternal.get(loc.externalId)!.id,
          }
        : null,
    }));
  }

  async saveLocationMappings(
    integrationId: string,
    mappings: Array<{
      externalId: string;
      internalId: string | null;
      syncEnabled: boolean;
    }>,
    businessId?: string
  ) {
    const ctx = await this.access.resolveAccess(businessId);
    const integration = await this.connection.requireOwnedIntegration(
      integrationId,
      ctx.targetBusinessId
    );

    for (const mapping of mappings) {
      if (!mapping.internalId) {
        const existing = await this.db.findMappingByExternal(
          integration.id,
          'location',
          mapping.externalId
        );
        if (existing) {
          await this.db.updateMapping(existing.id, { sync_enabled: false });
        }
        continue;
      }
      await this.db.upsertMapping({
        integration_id: integration.id,
        entity_type: 'location',
        internal_id: mapping.internalId,
        external_id: mapping.externalId,
        sync_enabled: mapping.syncEnabled,
      });
    }
    return { success: true };
  }
}
