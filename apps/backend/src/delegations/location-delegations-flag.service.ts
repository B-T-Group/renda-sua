import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { LOCATION_DELEGATIONS_FLAG_KEY } from './delegation.constants';

@Injectable()
export class LocationDelegationsFlagService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async isEnabled(): Promise<boolean> {
    try {
      const result = await this.hasura.executeQuery<{
        application_configurations: Array<{
          boolean_value?: boolean | null;
          status?: string | null;
        }>;
      }>(
        `
        query LocationDelegationsFlag($key: String!) {
          application_configurations(
            where: { config_key: { _eq: $key }, status: { _eq: "active" } }
            limit: 1
          ) {
            boolean_value
            status
          }
        }
      `,
        { key: LOCATION_DELEGATIONS_FLAG_KEY }
      );
      const row = result.application_configurations?.[0];
      return row?.boolean_value === true && row?.status === 'active';
    } catch {
      return false;
    }
  }
}
