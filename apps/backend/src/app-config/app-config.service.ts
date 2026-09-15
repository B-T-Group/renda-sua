import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  CLIENT_FLAG_KEYS,
  ClientFlags,
  DEFAULT_CLIENT_FLAGS,
  type ClientFlagKey,
} from './client-flags.constants';

type ConfigRow = {
  config_key: string;
  boolean_value: boolean | null;
  country_code: string | null;
  status: string;
};

const CACHE_TTL_MS = 30_000;

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private cache: { flags: ClientFlags; expiresAt: number } | null = null;

  constructor(private readonly hasura: HasuraSystemService) {}

  async getClientFlags(countryCode?: string): Promise<ClientFlags> {
    const now = Date.now();
    const cacheKey = countryCode?.trim().toUpperCase() || 'GLOBAL';
    if (
      this.cache &&
      this.cache.expiresAt > now &&
      (this.cache as { key?: string }).key === cacheKey
    ) {
      return this.cache.flags;
    }

    const flags = { ...DEFAULT_CLIENT_FLAGS };
    try {
      const rows = await this.fetchFlagRows();
      for (const key of CLIENT_FLAG_KEYS) {
        flags[key] = this.resolveBooleanFlag(rows, key, countryCode);
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to load client flags; using defaults: ${error?.message ?? error}`
      );
    }

    this.cache = {
      flags,
      expiresAt: now + CACHE_TTL_MS,
      key: cacheKey,
    } as { flags: ClientFlags; expiresAt: number; key: string };
    return flags;
  }

  private async fetchFlagRows(): Promise<ConfigRow[]> {
    const result = await this.hasura.executeQuery<{
      application_configurations: ConfigRow[];
    }>(
      `query ClientFlagConfigs($keys: [String!]!) {
        application_configurations(
          where: {
            config_key: { _in: $keys }
            status: { _eq: "active" }
          }
        ) {
          config_key
          boolean_value
          country_code
          status
        }
      }`,
      { keys: [...CLIENT_FLAG_KEYS] }
    );
    return result.application_configurations ?? [];
  }

  private resolveBooleanFlag(
    rows: ConfigRow[],
    key: ClientFlagKey,
    countryCode?: string
  ): boolean {
    const code = countryCode?.trim().toUpperCase();
    const forKey = rows.filter((r) => r.config_key === key);
    if (!forKey.length) return DEFAULT_CLIENT_FLAGS[key];

    if (code) {
      const countryRow = forKey.find((r) => r.country_code === code);
      if (countryRow?.boolean_value != null) {
        return countryRow.boolean_value;
      }
    }

    const globalRow = forKey.find((r) => !r.country_code);
    if (globalRow?.boolean_value != null) {
      return globalRow.boolean_value;
    }

    return DEFAULT_CLIENT_FLAGS[key];
  }
}
