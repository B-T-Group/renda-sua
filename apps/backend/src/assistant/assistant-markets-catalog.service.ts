import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type AssistantCountryStateRow = {
  country_code: string;
  country_name: string;
  currency_code: string;
  service_status: string;
  delivery_enabled: boolean;
  state_name: string;
};

export type AssistantPaymentSystemRow = {
  name: string;
  country: string;
};

/**
 * Live market/payment catalog for the assistant (Hasura-backed, not static KB).
 */
@Injectable()
export class AssistantMarketsCatalogService {
  private readonly logger = new Logger(AssistantMarketsCatalogService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async listCountryStates(countryCode?: string | null): Promise<string> {
    const code = normalizeCountry(countryCode);
    const rows = await this.fetchCountryStates(code);
    if (!rows.length) {
      return code
        ? `No supported country/state rows found for ${code}. Rendasua is not listed as available there.`
        : 'No supported country/state rows are configured.';
    }
    return formatCountryStates(rows);
  }

  async listPaymentSystems(countryCode?: string | null): Promise<string> {
    const code = normalizeCountry(countryCode);
    const rows = await this.fetchPaymentSystems(code);
    if (!rows.length) {
      return code
        ? `No active payment systems found for ${code}. Do not invent payment methods for this country.`
        : 'No active payment systems are configured.';
    }
    return formatPaymentSystems(rows);
  }

  private async fetchCountryStates(
    countryCode: string | null
  ): Promise<AssistantCountryStateRow[]> {
    const where = countryCode
      ? `{ country_code: { _eq: $country }, service_status: { _in: ["active", "coming_soon"] } }`
      : `{ service_status: { _in: ["active", "coming_soon"] } }`;
    const query = `
      query AssistantCountryStates${countryCode ? '($country: bpchar!)' : ''} {
        supported_country_states(
          where: ${where}
          order_by: [{ country_code: asc }, { state_name: asc }]
        ) {
          country_code
          country_name
          currency_code
          service_status
          delivery_enabled
          state_name
        }
      }
    `;
    try {
      const response = await this.hasura.executeQuery<{
        supported_country_states: AssistantCountryStateRow[];
      }>(query, countryCode ? { country: countryCode } : {});
      return response.supported_country_states || [];
    } catch (error: any) {
      this.logger.warn(
        `Assistant country-states query failed: ${error?.message ?? error}`
      );
      throw error;
    }
  }

  private async fetchPaymentSystems(
    countryCode: string | null
  ): Promise<AssistantPaymentSystemRow[]> {
    const where = countryCode
      ? `{ active: { _eq: true }, country: { _eq: $country } }`
      : `{ active: { _eq: true } }`;
    const query = `
      query AssistantPaymentSystems${countryCode ? '($country: bpchar!)' : ''} {
        supported_payment_systems(
          where: ${where}
          order_by: [{ country: asc }, { name: asc }]
        ) {
          name
          country
        }
      }
    `;
    try {
      const response = await this.hasura.executeQuery<{
        supported_payment_systems: AssistantPaymentSystemRow[];
      }>(query, countryCode ? { country: countryCode } : {});
      return response.supported_payment_systems || [];
    } catch (error: any) {
      this.logger.warn(
        `Assistant payment-systems query failed: ${error?.message ?? error}`
      );
      throw error;
    }
  }
}

function normalizeCountry(code?: string | null): string | null {
  const trimmed = (code || '').trim().toUpperCase();
  return trimmed.length === 2 ? trimmed : null;
}

function formatCountryStates(rows: AssistantCountryStateRow[]): string {
  const byCountry = new Map<string, AssistantCountryStateRow[]>();
  for (const row of rows) {
    const key = String(row.country_code || '').toUpperCase();
    const list = byCountry.get(key) || [];
    list.push(row);
    byCountry.set(key, list);
  }
  const lines: string[] = [
    'Live Rendasua country/state configuration (from supported_country_states):',
    'Only countries listed here with service_status active or coming_soon are configured. Any other country is not available.',
  ];
  for (const [code, states] of byCountry) {
    const head = states[0];
    const status = head?.service_status || 'unknown';
    const delivery = states.some((s) => s.delivery_enabled)
      ? 'delivery enabled'
      : 'delivery not enabled';
    const stateNames = states.map((s) => s.state_name).filter(Boolean);
    lines.push(
      `- ${code} (${head?.country_name || code}), currency ${head?.currency_code || '?'}, status=${status}, ${delivery}; states: ${stateNames.join(', ') || 'none'}`
    );
  }
  return lines.join('\n');
}

function formatPaymentSystems(rows: AssistantPaymentSystemRow[]): string {
  const byCountry = new Map<string, string[]>();
  for (const row of rows) {
    const key = String(row.country || '').toUpperCase();
    const list = byCountry.get(key) || [];
    list.push(labelPaymentSystem(row.name));
    byCountry.set(key, list);
  }
  const lines: string[] = [
    'Active Rendasua payment systems (from supported_payment_systems):',
    'Answer only from these rows. Do not invent rails such as Pix unless listed.',
  ];
  for (const [code, methods] of byCountry) {
    lines.push(`- ${code}: ${[...new Set(methods)].join(', ')}`);
  }
  return lines.join('\n');
}

function labelPaymentSystem(name: string): string {
  const key = (name || '').trim().toLowerCase();
  if (key === 'stripe') return 'stripe (card payments)';
  if (key === 'freemopay') {
    return 'freemopay (Cameroon mobile money: MTN / Orange)';
  }
  if (key === 'mtn') return 'mtn (MTN Mobile Money)';
  if (key === 'orange') return 'orange (Orange Money)';
  if (key === 'airtel') return 'airtel (Airtel Money)';
  if (key === 'moov') return 'moov (Moov Money)';
  return key || name;
}
