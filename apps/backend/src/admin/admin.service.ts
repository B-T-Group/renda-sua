import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const GET_AGENTS_QUERY = `
  query GetAgents {
    agents(order_by: {created_at: desc}) {
      id
      user_id
      vehicle_type_id
      is_verified
      created_at
      updated_at
      user {
        id
        identifier
        email
        first_name
        last_name
        phone_number
        accounts {
          id
          currency
          available_balance
          withheld_balance
          total_balance
          is_active
          created_at
          updated_at
        }
      }
      agent_addresses {
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          is_primary
          address_type
          latitude
          longitude
          created_at
          updated_at
        }
      }
    }
  }
`;

const GET_CLIENTS_QUERY = `
  query GetClients {
    clients(order_by: {created_at: desc}) {
      id
      user_id
      created_at
      updated_at
      user {
        id
        identifier
        email
        first_name
        last_name
        phone_number
        accounts {
          id
          currency
          available_balance
          withheld_balance
          total_balance
          is_active
          created_at
          updated_at
        }
      }
      client_addresses {
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          is_primary
          address_type
          latitude
          longitude
          created_at
          updated_at
        }
      }
    }
  }
`;

const GET_BUSINESSES_QUERY = `
  query GetBusinesses {
    businesses(order_by: {created_at: desc}) {
      id
      user_id
      name
      is_admin
      is_verified
      created_at
      updated_at
      user {
        id
        identifier
        email
        first_name
        last_name
        phone_number
        accounts {
          id
          currency
          available_balance
          withheld_balance
          total_balance
          is_active
          created_at
          updated_at
        }
      }
      business_addresses {
        address {
          id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          is_primary
          address_type
          latitude
          longitude
          created_at
          updated_at
        }
      }
    }
  }
`;

const UPDATE_USER_MUTATION = `
  mutation UpdateUser($userId: uuid!, $updates: users_set_input!) {
    update_users_by_pk(pk_columns: { id: $userId }, _set: $updates) {
      id
      first_name
      last_name
      phone_number
      email
      identifier
      user_type_id
      updated_at
    }
  }
`;

const UPDATE_AGENT_MUTATION = `
  mutation UpdateAgent($id: uuid!, $updates: agents_set_input!) {
    update_agents_by_pk(pk_columns: { id: $id }, _set: $updates) {
      id
      user_id
      vehicle_type_id
      is_verified
      updated_at
    }
  }
`;

const UPDATE_BUSINESS_MUTATION = `
  mutation UpdateBusiness($id: uuid!, $updates: businesses_set_input!) {
    update_businesses_by_pk(pk_columns: { id: $id }, _set: $updates) {
      id
      user_id
      name
      is_admin
      is_verified
      updated_at
    }
  }
`;

@Injectable()
export class AdminService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getAgentsWithDetails() {
    const result = await this.hasuraSystemService.executeQuery(
      GET_AGENTS_QUERY
    );
    return (result.agents || []).map((agent: any) => ({
      ...agent,
      addresses: (agent.agent_addresses || []).map((row: any) => row.address),
    }));
  }

  async getClientsWithDetails() {
    const result = await this.hasuraSystemService.executeQuery(
      GET_CLIENTS_QUERY
    );
    return (result.clients || []).map((client: any) => ({
      ...client,
      addresses: (client.client_addresses || []).map((row: any) => row.address),
    }));
  }

  async getBusinessesWithDetails() {
    const result = await this.hasuraSystemService.executeQuery(
      GET_BUSINESSES_QUERY
    );
    return (result.businesses || []).map((business: any) => ({
      ...business,
      addresses: (business.business_addresses || []).map(
        (row: any) => row.address
      ),
    }));
  }

  private async getUserIdByEntity(
    entity: 'agent' | 'client' | 'business',
    id: string
  ): Promise<string> {
    const queries: Record<string, string> = {
      agent: `query GetAgent($id: uuid!) { agents(where: {id: {_eq: $id}}) { user_id } }`,
      client: `query GetClient($id: uuid!) { clients(where: {id: {_eq: $id}}) { user_id } }`,
      business: `query GetBusiness($id: uuid!) { businesses(where: {id: {_eq: $id}}) { user_id } }`,
    };
    const result = await this.hasuraSystemService.executeQuery(
      queries[entity],
      { id }
    );
    const row = (result.agents || result.clients || result.businesses || [])[0];
    return row?.user_id;
  }

  private async updateUserProfile(
    userId: string,
    updates: { first_name?: string; last_name?: string; phone_number?: string }
  ) {
    const result = await this.hasuraSystemService.executeMutation(
      UPDATE_USER_MUTATION,
      { userId, updates }
    );
    return result.update_users_by_pk;
  }

  private async updateAgentRecord(
    agentId: string,
    updates: { is_verified?: boolean; vehicle_type_id?: string }
  ) {
    const result = await this.hasuraSystemService.executeMutation(
      UPDATE_AGENT_MUTATION,
      { id: agentId, updates }
    );
    return result.update_agents_by_pk;
  }

  async updateClientUser(
    clientId: string,
    updates: { first_name?: string; last_name?: string; phone_number?: string }
  ) {
    const userId = await this.getUserIdByEntity('client', clientId);
    return this.updateUserProfile(userId, updates);
  }

  private async updateBusinessRecord(
    businessId: string,
    updates: { name?: string; is_admin?: boolean }
  ) {
    const result = await this.hasuraSystemService.executeMutation(
      UPDATE_BUSINESS_MUTATION,
      { id: businessId, updates }
    );
    return result.update_businesses_by_pk;
  }

  async updateAgent(
    agentId: string,
    userUpdates: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
    },
    agentUpdates: { is_verified?: boolean; vehicle_type_id?: string }
  ) {
    const userId = await this.getUserIdByEntity('agent', agentId);
    const updatedUser = Object.keys(userUpdates || {}).length
      ? await this.updateUserProfile(userId, userUpdates)
      : null;
    const updatedAgent = Object.keys(agentUpdates || {}).length
      ? await this.updateAgentRecord(agentId, agentUpdates)
      : null;
    return { user: updatedUser, agent: updatedAgent };
  }

  async updateBusiness(
    businessId: string,
    userUpdates: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
    },
    businessUpdates: { name?: string; is_admin?: boolean }
  ) {
    const userId = await this.getUserIdByEntity('business', businessId);
    const updatedUser = Object.keys(userUpdates || {}).length
      ? await this.updateUserProfile(userId, userUpdates)
      : null;
    const updatedBusiness = Object.keys(businessUpdates || {}).length
      ? await this.updateBusinessRecord(businessId, businessUpdates)
      : null;
    return { user: updatedUser, business: updatedBusiness };
  }
}
