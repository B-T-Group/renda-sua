import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { maskEmail, maskPhone } from './assistant-cards';
import type {
  AssistantIdentity,
  AssistantLocale,
  AssistantToolResult,
} from './assistant.types';

const ACCOUNT_TOOLS = new Set([
  'get_my_profile_summary',
  'get_my_addresses',
  'get_my_purchase_credits',
  'get_my_wallet',
]);

const ADDRESS_PERSONAS = new Set(['client', 'agent', 'business']);

type CreditRow = {
  remaining_amount: number;
  currency: string;
  applicability: string;
  expires_at: string | null;
  business?: { name?: string | null } | null;
};

type AccountRow = { currency: string; available_balance: number };

export class AssistantAccountToolsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  handles(name: string): boolean {
    return ACCOUNT_TOOLS.has(name);
  }

  tools(identity: AssistantIdentity): Tool[] {
    const tools = [
      simpleTool('get_my_profile_summary', 'Name, active persona, country, language, masked phone and email.'),
      simpleTool('get_my_purchase_credits', 'Active store credits: remaining amount, currency, where they apply, expiry. Empty means none.'),
      simpleTool('get_my_wallet', 'Wallet available balance and currency only. Do not explain withdrawals.'),
    ];
    if (ADDRESS_PERSONAS.has(identity.accountType || '')) {
      tools.push(simpleTool('get_my_addresses', 'The user’s active saved addresses.'));
    }
    return tools;
  }

  run(
    name: string,
    identity: AssistantIdentity,
    locale: AssistantLocale
  ): Promise<AssistantToolResult> {
    if (!identity.userId) return Promise.resolve(signInRequired(locale));
    if (identity.accountType === 'delegate') {
      return Promise.resolve({ content: 'Open Delegate orders in the app for order management.' });
    }
    if (name === 'get_my_profile_summary') return Promise.resolve(this.profile(identity));
    if (name === 'get_my_addresses') return this.addresses(identity);
    if (name === 'get_my_purchase_credits') return this.credits(identity.userId);
    if (name === 'get_my_wallet') return this.wallet(identity.userId);
    return Promise.resolve({ content: `Unknown tool: ${name}`, handoff: true });
  }

  private profile(identity: AssistantIdentity): AssistantToolResult {
    const enrolled = enrolledPersonas(identity);
    return {
      content: JSON.stringify({
        firstName: identity.firstName,
        lastName: identity.lastName || null,
        activePersona: identity.accountType,
        enrolledPersonas: enrolled,
        country: identity.country,
        preferredLanguage: identity.preferredLanguage,
        phone: maskPhone(identity.phoneE164),
        email: maskEmail(identity.email),
      }),
    };
  }

  private async addresses(identity: AssistantIdentity): Promise<AssistantToolResult> {
    const type = identity.accountType;
    if (!identity.userId || !ADDRESS_PERSONAS.has(type || '')) {
      return { content: 'No address profile is available.' };
    }
    const rows = await this.hasura.getAllUserAddresses(identity.userId, type!);
    return { content: JSON.stringify(rows.slice(0, 10)) };
  }

  private async credits(userId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ purchase_credit_grants: CreditRow[] }>(
      CREDITS_QUERY,
      { userId }
    );
    const grants = (result.purchase_credit_grants || []).map(summarizeCredit);
    const note = grants.length
      ? 'These store credits apply to item subtotals and cannot be withdrawn.'
      : 'This account has no active store credits.';
    return { content: `${note}\n${JSON.stringify(grants)}` };
  }

  private async wallet(userId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ accounts: AccountRow[] }>(
      WALLET_QUERY,
      { userId }
    );
    const balances = sumBalances(result.accounts || []);
    const note = balances.length
      ? 'Available wallet balance only. Do not give withdrawal steps.'
      : 'No wallet balance was found for this account.';
    return { content: `${note}\n${JSON.stringify(balances)}` };
  }
}

function enrolledPersonas(identity: AssistantIdentity): string[] {
  const personas: string[] = [];
  if (identity.clientId) personas.push('client');
  if (identity.agentId) personas.push('agent');
  if (identity.businessId) personas.push('business');
  return personas;
}

function summarizeCredit(row: CreditRow) {
  return {
    remaining: Number(row.remaining_amount),
    currency: row.currency,
    appliesTo: row.applicability,
    businessName: row.business?.name || null,
    expiresAt: row.expires_at,
  };
}

function sumBalances(rows: AccountRow[]): Array<{ currency: string; available: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const current = totals.get(row.currency) || 0;
    totals.set(row.currency, current + Number(row.available_balance || 0));
  }
  return [...totals.entries()].map(([currency, available]) => ({ currency, available }));
}

function signInRequired(locale: AssistantLocale): AssistantToolResult {
  const content = locale === 'fr'
    ? 'Connexion requise pour les informations du compte.'
    : 'Sign-in is required for account information.';
  return { content };
}

function simpleTool(name: string, description: string): Tool {
  return {
    toolSpec: {
      name,
      description,
      inputSchema: { json: { type: 'object', properties: {} } },
    },
  };
}

const CREDITS_QUERY = `query AssistantCredits($userId: uuid!) {
  purchase_credit_grants(
    where: {
      user_id: { _eq: $userId }
      remaining_amount: { _gt: 0 }
      revoked_at: { _is_null: true }
    }
    order_by: { created_at: desc }
    limit: 10
  ) {
    remaining_amount currency applicability expires_at
    business { name }
  }
}`;

const WALLET_QUERY = `query AssistantWallet($userId: uuid!) {
  accounts(where: { user_id: { _eq: $userId } }, limit: 8) {
    currency available_balance
  }
}`;
