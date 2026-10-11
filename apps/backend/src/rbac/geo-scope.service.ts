import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { unionScopes } from './geo-access.util';
import {
  addressGeoWhere,
  businessGeoWhere,
  creditGeoWhere,
  orderGeoWhere,
  personaGeoWhere,
  resolveCountryCode,
  scopeCovers,
  type MarketRow,
  type ResourceGeo,
} from './geo-scope.util';
import type { GeoScope } from './platform-permissions';
import { RbacService } from './rbac.service';

const MARKETS_QUERY = `
  query GeoMarkets {
    supported_country_states(order_by: { country_name: asc, state_name: asc }) {
      id country_code country_name state_name state_key
    }
  }
`;

@Injectable()
export class GeoScopeService {
  private marketsPromise: Promise<MarketRow[]> | null = null;

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly rbac: RbacService
  ) {}

  async markets(): Promise<MarketRow[]> {
    if (!this.marketsPromise) this.marketsPromise = this.loadMarkets();
    return this.marketsPromise;
  }

  async require(permissionKey: string): Promise<GeoScope> {
    return this.requireAny([permissionKey]);
  }

  async requireAny(permissionKeys: string[]): Promise<GeoScope> {
    const user = await this.users.getUser();
    const scopes = await this.scopesFor(user?.id, permissionKeys);
    const merged = unionScopes(scopes);
    if (!merged) throw new ForbiddenException('Access denied');
    return merged;
  }

  async coversOrder(
    userId: string,
    permissionKey: string,
    orderId: string
  ): Promise<boolean> {
    const scope = await this.rbac.getScope(userId, permissionKey);
    if (!scope) return false;
    if (scope.all) return true;
    return this.orderMatches(scope, orderId);
  }

  async orderWhere(scope: GeoScope) {
    return orderGeoWhere(scope, await this.markets());
  }

  async businessWhere(scope: GeoScope) {
    return businessGeoWhere(scope, await this.markets());
  }

  async personaWhere(scope: GeoScope, addressPaths: string[]) {
    return personaGeoWhere(scope, await this.markets(), addressPaths);
  }

  async creditWhere(scope: GeoScope) {
    return creditGeoWhere(scope, await this.markets());
  }

  async addressWhere(scope: GeoScope) {
    return addressGeoWhere(scope, await this.markets());
  }

  async assertIncident(scope: GeoScope, incidentId: string): Promise<void> {
    if (scope.all) return;
    const orderId = await this.incidentOrderId(incidentId);
    await this.assertOrder(scope, orderId);
  }

  async assertOrder(scope: GeoScope, orderId: string): Promise<void> {
    if (scope.all) return;
    if (!(await this.orderMatches(scope, orderId))) {
      throw new NotFoundException('Order not found');
    }
  }

  async assertBusiness(scope: GeoScope, businessId: string): Promise<void> {
    if (scope.all) return;
    const row = await this.loadBusinessGeo(businessId);
    if (!row || !(await this.matchesAny(scope, row.country, row.addresses))) {
      throw new NotFoundException('Business not found');
    }
  }

  async assertAgent(scope: GeoScope, agentId: string): Promise<void> {
    if (scope.all) return;
    const row = await this.loadAgentGeo(agentId);
    if (!row || !(await this.matchesAny(scope, row.country, row.addresses))) {
      throw new NotFoundException('Agent not found');
    }
  }

  async assertPerson(scope: GeoScope, userId: string): Promise<void> {
    if (scope.all) return;
    const row = await this.loadPersonGeo(userId);
    if (!row || !(await this.matchesAny(scope, row.country, row.addresses))) {
      throw new NotFoundException('User not found');
    }
  }

  async normalizeCountry(raw: string | null | undefined): Promise<string | null> {
    return resolveCountryCode(raw, await this.markets());
  }

  private async scopesFor(
    userId: string | undefined,
    keys: string[]
  ): Promise<GeoScope[]> {
    if (!userId) return [];
    const scopes: GeoScope[] = [];
    for (const key of keys) {
      const scope = await this.rbac.getScope(userId, key);
      if (scope) scopes.push(scope);
    }
    return scopes;
  }

  private async incidentOrderId(incidentId: string): Promise<string> {
    const result = await this.hasura.executeQuery(
      `query IncidentOrder($id: uuid!) {
        order_risk_incidents_by_pk(id: $id) { order_id }
      }`,
      { id: incidentId }
    );
    const orderId = result.order_risk_incidents_by_pk?.order_id as string | undefined;
    if (!orderId) throw new NotFoundException('Incident not found');
    return orderId;
  }

  private async orderMatches(scope: GeoScope, orderId: string): Promise<boolean> {
    const geo = await this.loadOrderGeo(orderId);
    if (!geo) return false;
    return scopeCovers(scope, geo, await this.markets());
  }

  private async matchesAny(
    scope: GeoScope,
    country: string | null,
    addresses: ResourceGeo[]
  ): Promise<boolean> {
    const markets = await this.markets();
    if (scopeCovers(scope, { countryCode: country }, markets)) return true;
    return addresses.some((address) => scopeCovers(scope, address, markets));
  }

  private async loadMarkets(): Promise<MarketRow[]> {
    try {
      const result = await this.hasura.executeQuery(MARKETS_QUERY);
      return (result.supported_country_states ?? []).map(mapMarketRow);
    } catch (error) {
      this.marketsPromise = null;
      throw error;
    }
  }

  private async loadOrderGeo(orderId: string): Promise<ResourceGeo | null> {
    const result = await this.hasura.executeQuery(
      `query OrderGeo($id: uuid!) {
        orders_by_pk(id: $id) {
          business_location { address { country state } }
          delivery_address { country state }
        }
      }`,
      { id: orderId }
    );
    return orderGeo(result.orders_by_pk);
  }

  private loadBusinessGeo(businessId: string) {
    return this.loadParty(
      `query BusinessGeo($id: uuid!) {
        businesses_by_pk(id: $id) {
          user { country }
          business_addresses { address { country state } }
          business_locations { address { country state } }
        }
      }`,
      'businesses_by_pk',
      businessId
    );
  }

  private loadAgentGeo(agentId: string) {
    return this.loadParty(
      `query AgentGeo($id: uuid!) {
        agents_by_pk(id: $id) {
          user { country }
          agent_addresses { address { country state } }
        }
      }`,
      'agents_by_pk',
      agentId
    );
  }

  private loadPersonGeo(userId: string) {
    return this.loadParty(
      `query PersonGeo($id: uuid!) {
        users_by_pk(id: $id) {
          country
          agent { agent_addresses { address { country state } } }
          client { client_addresses { address { country state } } }
          business {
            business_addresses { address { country state } }
            business_locations { address { country state } }
          }
        }
      }`,
      'users_by_pk',
      userId
    );
  }

  private async loadParty(query: string, key: string, id: string) {
    const result = await this.hasura.executeQuery(query, { id });
    const row = result[key];
    if (!row) return null;
    return { country: partyCountry(row), addresses: partyAddresses(row) };
  }
}

function mapMarketRow(row: any): MarketRow {
  return {
    countryCode: String(row.country_code ?? '').trim().toUpperCase(),
    countryName: String(row.country_name ?? '').trim(),
    stateId: row.id,
    stateName: row.state_name,
    stateKey: row.state_key,
  };
}

function orderGeo(order: any): ResourceGeo | null {
  if (!order) return null;
  const shop = order.business_location?.address;
  const drop = order.delivery_address;
  const address = shop?.country ? shop : drop;
  return {
    countryCode: address?.country ?? null,
    stateName: address?.state ?? null,
  };
}

function partyCountry(row: any): string | null {
  return row.country ?? row.user?.country ?? null;
}

function partyAddresses(row: any): ResourceGeo[] {
  return [
    ...addressRows(row.agent_addresses),
    ...addressRows(row.client_addresses),
    ...addressRows(row.business_addresses),
    ...addressRows(row.business_locations),
    ...addressRows(row.agent?.agent_addresses),
    ...addressRows(row.client?.client_addresses),
    ...addressRows(row.business?.business_addresses),
    ...addressRows(row.business?.business_locations),
  ];
}

function addressRows(rows: any[] | null | undefined): ResourceGeo[] {
  return (rows ?? [])
    .map((row) => row?.address)
    .filter((address) => address?.country)
    .map((address) => ({
      countryCode: address.country as string,
      stateName: address.state as string | null,
    }));
}
