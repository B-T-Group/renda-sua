import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  DEDICATED_AGENTS_FLAG_KEY,
  DEDICATED_CONFIG_KEYS,
  DEDICATED_NUMBER_CONFIG,
  DEFAULT_DEDICATED_AGENTS_CONFIG,
  type DedicatedAgentsConfig,
  type DedicatedNumberConfigKey,
} from './dedicated-agents.constants';

export interface DedicatedConfigRow {
  config_key: string;
  boolean_value?: boolean | null;
  number_value?: number | string | null;
  country_code?: string | null;
}

const CACHE_TTL_MS = 30_000;

function pickRow(
  rows: DedicatedConfigRow[],
  key: string,
  countryCode: string | null
): DedicatedConfigRow | undefined {
  const forKey = rows.filter((r) => r.config_key === key);
  if (countryCode) {
    const country = forKey.find(
      (r) => r.country_code?.trim().toUpperCase() === countryCode
    );
    if (country) return country;
  }
  return forKey.find((r) => !r.country_code);
}

/**
 * Resolve the #594 config from application_configurations rows: a country
 * row wins over the global row; missing, null or out-of-range values fall
 * back to the defaults, and the flag falls back to off.
 */
export function resolveDedicatedAgentsConfig(
  rows: DedicatedConfigRow[],
  countryCode?: string | null
): DedicatedAgentsConfig {
  const code = countryCode?.trim().toUpperCase() || null;
  const config: DedicatedAgentsConfig = { ...DEFAULT_DEDICATED_AGENTS_CONFIG };
  config.enabled =
    pickRow(rows, DEDICATED_AGENTS_FLAG_KEY, code)?.boolean_value === true;
  for (const key of Object.keys(
    DEDICATED_NUMBER_CONFIG
  ) as DedicatedNumberConfigKey[]) {
    const spec = DEDICATED_NUMBER_CONFIG[key];
    const raw = pickRow(rows, key, code)?.number_value;
    const value = raw == null || raw === '' ? Number.NaN : Number(raw);
    config[spec.field] =
      Number.isInteger(value) && value >= spec.min && value <= spec.max
        ? value
        : spec.fallback;
  }
  return config;
}

@Injectable()
export class DedicatedAgentsConfigService {
  private readonly logger = new Logger(DedicatedAgentsConfigService.name);
  private cache: { rows: DedicatedConfigRow[]; expiresAt: number } | null =
    null;

  constructor(private readonly hasura: HasuraSystemService) {}

  async getConfig(countryCode?: string | null): Promise<DedicatedAgentsConfig> {
    return resolveDedicatedAgentsConfig(await this.loadRows(), countryCode);
  }

  /** `dedicated_agents_enabled`; false when the row is missing or unreadable. */
  async isEnabled(countryCode?: string | null): Promise<boolean> {
    return (await this.getConfig(countryCode)).enabled;
  }

  private async loadRows(): Promise<DedicatedConfigRow[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.rows;
    let rows: DedicatedConfigRow[] = [];
    try {
      const result = await this.hasura.executeQuery<{
        application_configurations: DedicatedConfigRow[];
      }>(
        `query DedicatedAgentsConfig($keys: [String!]!) {
          application_configurations(
            where: { config_key: { _in: $keys }, status: { _eq: "active" } }
          ) {
            config_key
            boolean_value
            number_value
            country_code
          }
        }`,
        { keys: [...DEDICATED_CONFIG_KEYS] }
      );
      rows = result?.application_configurations ?? [];
    } catch (error) {
      this.logger.warn(
        `Failed to load dedicated agents config; feature stays off: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return rows;
    }
    this.cache = { rows, expiresAt: now + CACHE_TTL_MS };
    return rows;
  }
}
