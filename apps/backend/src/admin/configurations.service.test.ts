// Example test cases for the updated getFastDeliveryFromSupportedLocations function

import { ConfigurationsService } from '../admin/configurations.service';

describe('ConfigurationsService - getFastDeliveryFromSupportedLocations', () => {
  let service: ConfigurationsService;

  beforeEach(() => {
    service = new ConfigurationsService();
  });

  it('should match state by state_name', async () => {
    // Test with state code 'ES' (Estuaire)
    const result = await service.getFastDeliveryFromSupportedLocations(
      'GA',
      'ES'
    );

    expect(result).toBeDefined();
    expect(result.enabled).toBe(true);
    expect(result.fee).toBe(2000);
  });

  it('should match state by state_name', async () => {
    // Test with state name 'Estuaire'
    const result = await service.getFastDeliveryFromSupportedLocations(
      'GA',
      'Estuaire'
    );

    expect(result).toBeDefined();
    expect(result.enabled).toBe(true);
    expect(result.fee).toBe(2000);
  });

  it('should return null for non-existent state', async () => {
    // Test with non-existent state
    const result = await service.getFastDeliveryFromSupportedLocations(
      'GA',
      'NonExistent'
    );

    expect(result).toBeNull();
  });

  it('should return country-level config when no state provided', async () => {
    // Test without state code
    const result = await service.getFastDeliveryFromSupportedLocations('GA');

    expect(result).toBeDefined();
  });
});

// Example usage scenarios:

// Scenario 1: Frontend sends state code
const config1 = await service.getFastDeliveryFromSupportedLocations('GA', 'ES');
// This will match the state_name field

// Scenario 2: Frontend sends state name
const config2 = await service.getFastDeliveryFromSupportedLocations(
  'GA',
  'Estuaire'
);
// This will match the state_name field

// Scenario 3: Both scenarios return the same configuration
// because they refer to the same state (Estuaire in Gabon)
