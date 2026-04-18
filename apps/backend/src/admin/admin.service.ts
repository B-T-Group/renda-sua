import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const GET_AGENTS_QUERY = `
  query GetAgents {
    agents(order_by: {created_at: desc}) {
      id
      user_id
      vehicle_type_id
      is_verified
      status
      created_at
      updated_at
      user {
        id
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
      agent_addresses(where: { address: { status: { _eq: active } } }) {
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
      client_addresses(where: { address: { status: { _eq: active } } }) {
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
      business_addresses(where: { address: { status: { _eq: active } } }) {
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
      image_cleanup_enabled
      updated_at
    }
  }
`;

@Injectable()
export class AdminService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  private buildAgentWhere(search: string, unverifiedOnly?: boolean): any {
    const conditions: any[] = [];
    if (search) {
      const pattern = `%${search}%`;
      conditions.push({
        _or: [
          { user: { email: { _ilike: pattern } } },
          { user: { first_name: { _ilike: pattern } } },
          { user: { last_name: { _ilike: pattern } } },
          {
            _and: [
              { user: { first_name: { _ilike: pattern } } },
              { user: { last_name: { _ilike: pattern } } },
            ],
          },
        ],
      });
    }
    if (unverifiedOnly) {
      conditions.push({ is_verified: { _eq: false } });
    }
    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { _and: conditions };
  }

  private buildClientWhere(search: string): any {
    if (!search) return {};
    const pattern = `%${search}%`;
    return {
      _or: [
        { user: { email: { _ilike: pattern } } },
        { user: { first_name: { _ilike: pattern } } },
        { user: { last_name: { _ilike: pattern } } },
        {
          _and: [
            { user: { first_name: { _ilike: pattern } } },
            { user: { last_name: { _ilike: pattern } } },
          ],
        },
      ],
    };
  }

  private buildBusinessWhere(search: string): any {
    if (!search) return {};
    const pattern = `%${search}%`;
    return {
      _or: [
        { name: { _ilike: pattern } },
        { user: { email: { _ilike: pattern } } },
        { user: { first_name: { _ilike: pattern } } },
        { user: { last_name: { _ilike: pattern } } },
      ],
    };
  }

  async getAgentsPaginated(params: {
    page: number;
    limit: number;
    search: string;
    unverifiedOnly?: boolean;
  }) {
    const { page, limit, search, unverifiedOnly } = params;
    const offset = (page - 1) * limit;
    const idTypeNames = AdminService.ID_DOCUMENT_TYPE_NAMES;
    const query = `
      query GetAgents($where: agents_bool_exp, $limit: Int!, $offset: Int!, $idTypeNames: [String!]) {
        agents(where: $where, limit: $limit, offset: $offset, order_by: {created_at: desc}) {
          id user_id vehicle_type_id is_verified is_internal created_at updated_at
          user {
          id email first_name last_name phone_number
            accounts { id currency available_balance withheld_balance total_balance is_active created_at updated_at }
            user_uploads(where: { document_type: { name: { _in: $idTypeNames } } }, order_by: { created_at: desc }) {
              id file_name content_type document_type_id is_approved note created_at updated_at
              document_type { id name description }
            }
          }
          agent_addresses(where: { address: { status: { _eq: active } } }) { address { id address_line_1 address_line_2 city state postal_code country is_primary address_type latitude longitude created_at updated_at } }
        }
        agents_aggregate(where: $where) { aggregate { count } }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      where: this.buildAgentWhere(search, unverifiedOnly),
      limit,
      offset,
      idTypeNames,
    });
    const items = (result.agents || []).map((a: any) => {
      const idDocuments = a.user?.user_uploads ?? [];
      const { user, ...rest } = a;
      const { user_uploads, ...userRest } = user || {};
      return {
        ...rest,
        user: userRest,
        addresses: (a.agent_addresses || []).map((x: any) => x.address),
        id_documents: idDocuments,
      };
    });
    const total = result.agents_aggregate?.aggregate?.count || 0;
    return { items, total, page, limit };
  }

  async getClientsPaginated(params: {
    page: number;
    limit: number;
    search: string;
  }) {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;
    const query = `
      query GetClients($where: clients_bool_exp, $limit: Int!, $offset: Int!) {
        clients(where: $where, limit: $limit, offset: $offset, order_by: {created_at: desc}) {
          id user_id created_at updated_at
          user { id email first_name last_name phone_number accounts { id currency available_balance withheld_balance total_balance is_active created_at updated_at } }
          client_addresses(where: { address: { status: { _eq: active } } }) { address { id address_line_1 address_line_2 city state postal_code country is_primary address_type latitude longitude created_at updated_at } }
        }
        clients_aggregate(where: $where) { aggregate { count } }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      where: this.buildClientWhere(search),
      limit,
      offset,
    });
    const items = (result.clients || []).map((c: any) => ({
      ...c,
      addresses: (c.client_addresses || []).map((x: any) => x.address),
    }));
    const total = result.clients_aggregate?.aggregate?.count || 0;
    return { items, total, page, limit };
  }

  async getBusinessesPaginated(params: {
    page: number;
    limit: number;
    search: string;
  }) {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;
    const query = `
      query GetBusinesses($where: businesses_bool_exp, $limit: Int!, $offset: Int!) {
        businesses(where: $where, limit: $limit, offset: $offset, order_by: {created_at: desc}) {
          id user_id name is_admin is_verified image_cleanup_enabled created_at updated_at
          user { id email first_name last_name phone_number accounts { id currency available_balance withheld_balance total_balance is_active created_at updated_at } }
          business_addresses(where: { address: { status: { _eq: active } } }) { address { id address_line_1 address_line_2 city state postal_code country is_primary address_type latitude longitude created_at updated_at } }
        }
        businesses_aggregate(where: $where) { aggregate { count } }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      where: this.buildBusinessWhere(search),
      limit,
      offset,
    });
    const items = (result.businesses || []).map((b: any) => ({
      ...b,
      addresses: (b.business_addresses || []).map((x: any) => x.address),
    }));
    const total = result.businesses_aggregate?.aggregate?.count || 0;
    return { items, total, page, limit };
  }

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
    updates: {
      name?: string;
      is_admin?: boolean;
      image_cleanup_enabled?: boolean;
    }
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

  /**
   * Restore a suspended agent to active. Records the restoration in agent_restorations.
   */
  async restoreAgent(
    agentId: string,
    restoredByUserId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateMutation = `
        mutation SetAgentActive($agentId: uuid!) {
          update_agents_by_pk(
            pk_columns: { id: $agentId }
            _set: { status: "active" }
          ) {
            id
            status
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(updateMutation, {
        agentId,
      });
      const insertMutation = `
        mutation InsertAgentRestoration($agentId: uuid!, $restoredByUserId: uuid!, $reason: String) {
          insert_agent_restorations_one(
            object: {
              agent_id: $agentId
              restored_by_user_id: $restoredByUserId
              reason: $reason
            }
          ) {
            id
            restored_at
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(insertMutation, {
        agentId,
        restoredByUserId,
        reason: reason ?? null,
      });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message ?? 'Failed to restore agent',
      };
    }
  }

  async updateBusiness(
    businessId: string,
    userUpdates: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
    },
    businessUpdates: {
      name?: string;
      is_admin?: boolean;
      image_cleanup_enabled?: boolean;
    }
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

  async getUserUploads(params: {
    userId: string;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;

    const query = `
      query GetUserUploads($userId: uuid!, $limit: Int!, $offset: Int!) {
        user_uploads(
          where: { user_id: { _eq: $userId } }
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id
          user_id
          file_name
          key
          content_type
          file_size
          document_type_id
          is_approved
          note
          created_at
          updated_at
          document_type {
            id
            name
            description
          }
          user {
            id
            email
            first_name
            last_name
          }
        }
        user_uploads_aggregate(where: { user_id: { _eq: $userId } }) {
          aggregate {
            count
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      userId: params.userId,
      limit: params.limit,
      offset,
    });

    const uploads = result.user_uploads || [];
    const totalCount = result.user_uploads_aggregate?.aggregate?.count || 0;
    const totalPages = Math.ceil(totalCount / params.limit);

    return {
      uploads,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: totalCount,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
      },
    };
  }

  private static readonly ID_DOCUMENT_TYPE_NAMES = [
    'id_card',
    'passport',
    'driver_license',
  ];

  async getAgentIdDocuments(agentId: string) {
    const agentQuery = `
      query GetAgentUserId($agentId: uuid!) {
        agents_by_pk(id: $agentId) {
          user_id
        }
      }
    `;
    const agentResult = await this.hasuraSystemService.executeQuery(
      agentQuery,
      { agentId }
    );
    const userId = (agentResult?.agents_by_pk as { user_id: string } | null)
      ?.user_id;
    if (!userId) {
      return { uploads: [] };
    }

    const query = `
      query GetAgentIdDocuments($userId: uuid!, $typeNames: [String!]) {
        user_uploads(
          where: {
            user_id: { _eq: $userId }
            document_type: { name: { _in: $typeNames } }
          }
          order_by: { created_at: desc }
        ) {
          id
          user_id
          file_name
          key
          content_type
          file_size
          document_type_id
          is_approved
          note
          created_at
          updated_at
          document_type {
            id
            name
            description
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
      typeNames: AdminService.ID_DOCUMENT_TYPE_NAMES,
    });
    const uploads = result.user_uploads || [];
    return { uploads };
  }

  async getUserMessages(params: {
    userId: string;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;

    const query = `
      query GetUserMessages($userId: uuid!, $limit: Int!, $offset: Int!) {
        user_messages(
          where: { user_id: { _eq: $userId } }
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id
          user_id
          entity_type
          entity_id
          message
          created_at
          updated_at
          user {
            id
            email
            first_name
            last_name
          }
          entity_type_info {
            id
            comment
          }
        }
        user_messages_aggregate(where: { user_id: { _eq: $userId } }) {
          aggregate {
            count
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      userId: params.userId,
      limit: params.limit,
      offset,
    });

    const messages = result.user_messages || [];
    const totalCount = result.user_messages_aggregate?.aggregate?.count || 0;
    const totalPages = Math.ceil(totalCount / params.limit);

    return {
      messages,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: totalCount,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
      },
    };
  }

  async getUserDetails(userId: string) {
    const query = `
      query GetUserDetails($userId: uuid!) {
        users_by_pk(id: $userId) {
          id
          email
          first_name
          last_name
          phone_number
          created_at
          updated_at
          user_type_id
          user_type {
            id
            comment
          }
          agent {
            id
            user_id
            vehicle_type_id
            is_verified
            created_at
            updated_at
            vehicle_type {
              id
              comment
            }
          }
          client {
            id
            user_id
            created_at
            updated_at
          }
          business {
            id
            user_id
            name
            is_admin
            created_at
            updated_at
          }
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
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });

    if (!result.users_by_pk) {
      throw new Error('User not found');
    }

    return result.users_by_pk;
  }

  async getCommissionUsers() {
    const query = `
      query GetCommissionUsers($userType: user_types_enum!) {
        users(
          where: {
            _or: [
              { user_type_id: { _eq: $userType } }
              { email: { _eq: "hq@rendasua.com" } }
            ]
          }
          order_by: { created_at: desc }
        ) {
          id
          email
          first_name
          last_name
          phone_number
          user_type_id
          created_at
          updated_at
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
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      userType: 'partner',
    });

    return result.users || [];
  }

  async getAccountTransactions(params: {
    accountId: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const query = `
      query GetAccountTransactions($accountId: uuid!, $limit: Int!, $offset: Int!) {
        account_transactions(
          where: { account_id: { _eq: $accountId } }
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id
          account_id
          amount
          transaction_type
          memo
          reference_id
          created_at
          account {
            id
            currency
            user_id
          }
        }
        account_transactions_aggregate(where: { account_id: { _eq: $accountId } }) {
          aggregate {
            count
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      accountId: params.accountId,
      limit,
      offset,
    });

    const transactions = result.account_transactions || [];
    const totalCount = result.account_transactions_aggregate?.aggregate?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
