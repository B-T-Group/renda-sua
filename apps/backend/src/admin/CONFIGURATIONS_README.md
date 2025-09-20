# Application Configurations Management

This module provides admin-only APIs for managing application configuration items that control various aspects of the application behavior.

## Overview

The `application_configurations` table stores configuration items that can be:

- **Global**: Applied to all countries (country_code = null)
- **Country-specific**: Applied to specific countries using ISO 3166-1 alpha-2 country codes
- **Versioned**: Each configuration has a version number for tracking changes
- **Typed**: Supports multiple data types (string, number, boolean, json, array, date, currency)

## Database Schema

### Table: `application_configurations`

| Column             | Type                     | Description                                                        |
| ------------------ | ------------------------ | ------------------------------------------------------------------ |
| `id`               | UUID                     | Primary key                                                        |
| `config_key`       | VARCHAR(255)             | Unique configuration key (cannot be changed)                       |
| `config_name`      | VARCHAR(255)             | Human-readable name                                                |
| `description`      | TEXT                     | Configuration description                                          |
| `data_type`        | VARCHAR(50)              | Type of data: string, number, boolean, json, array, date, currency |
| `string_value`     | TEXT                     | Value for string/currency types                                    |
| `number_value`     | DECIMAL(15,4)            | Value for number/currency types                                    |
| `boolean_value`    | BOOLEAN                  | Value for boolean type                                             |
| `json_value`       | JSONB                    | Value for json type                                                |
| `array_value`      | TEXT[]                   | Value for array type                                               |
| `date_value`       | TIMESTAMP WITH TIME ZONE | Value for date type                                                |
| `country_code`     | VARCHAR(2)               | ISO 3166-1 alpha-2 country code (null for global)                  |
| `status`           | VARCHAR(20)              | active, inactive, deprecated                                       |
| `version`          | INTEGER                  | Version number                                                     |
| `tags`             | TEXT[]                   | Categorization tags                                                |
| `validation_rules` | JSONB                    | Validation constraints                                             |
| `min_value`        | DECIMAL(15,4)            | Minimum value for numeric validations                              |
| `max_value`        | DECIMAL(15,4)            | Maximum value for numeric validations                              |
| `allowed_values`   | TEXT[]                   | Allowed values for enum-like validations                           |
| `created_at`       | TIMESTAMP WITH TIME ZONE | Creation timestamp                                                 |
| `updated_at`       | TIMESTAMP WITH TIME ZONE | Last update timestamp                                              |
| `created_by`       | UUID                     | User who created this config                                       |
| `updated_by`       | UUID                     | User who last updated this config                                  |

### Constraints

- **Unique**: `(config_key, country_code)` - Each config key can only exist once per country
- **Check**: Only one value field can be non-null based on data_type
- **Check**: status must be one of: active, inactive, deprecated
- **Check**: data_type must be one of: string, number, boolean, json, array, date, currency

## API Endpoints

All endpoints require admin authentication via `AdminAuthGuard`.

### Base URL: `/admin/configurations`

#### GET `/`

- **Description**: Get all configurations with optional filtering
- **Query Parameters**:
  - `country` (optional): Filter by country code
  - `tags` (optional): Filter by tags (comma-separated)
- **Response**: Array of configuration objects

#### GET `/:id`

- **Description**: Get configuration by ID
- **Parameters**: `id` (UUID)
- **Response**: Configuration object or null

#### GET `/key/:key`

- **Description**: Get configuration by key with optional country filter
- **Parameters**: `key` (string)
- **Query Parameters**: `country` (optional, string)
- **Response**: Configuration object or null

#### PATCH `/:id`

- **Description**: Update an existing configuration
- **Parameters**: `id` (UUID)
- **Body**: `UpdateConfigurationDto`
- **Restrictions**: `config_key` cannot be changed
- **Response**: Updated configuration object

#### DELETE `/:id`

- **Description**: Delete a configuration
- **Parameters**: `id` (UUID)
- **Response**: Success/failure message

## Initial Configuration Items

The following configuration items are pre-populated:

### Global Configurations

- `default_agent_hold_amount_percentage`: 80% (global)

### Country-Specific Configurations

#### Delivery Fee Configurations by Country:

| Country           | Flat Fee | Base Fee | Rate/km | Min Fee |
| ----------------- | -------- | -------- | ------- | ------- |
| **GA** (Gabon)    | 1,500    | 300      | 200     | 500     |
| **CM** (Cameroon) | 1,500    | 300      | 200     | 500     |
| **CA** (Canada)   | 10       | 1        | 0.75    | 3       |
| **US** (USA)      | 10       | 1.5      | 0.5     | 2       |

## Usage Examples

### Getting a Configuration Value

```typescript
// Get global configuration
const holdPercentage = await configService.getConfigurationByKey('default_agent_hold_amount_percentage');

// Get country-specific configuration
const baseDeliveryFee = await configService.getConfigurationByKey(
  'base_delivery_fee',
  'CM' // Cameroon
);

// Fallback to global if country-specific not found
const config = (await configService.getConfigurationByKey('some_global_config', 'UNKNOWN_COUNTRY')) || (await configService.getConfigurationByKey('some_global_config'));
```

### Updating a Configuration

```typescript
// Update delivery fee for Cameroon
await configService.updateConfiguration(
  configId,
  {
    number_value: 350.0,
    updated_by: userId,
  },
  userId
);
```

## Security

- **Admin Only**: All endpoints require admin authentication
- **No Create API**: Configurations can only be updated/deleted, not created via API
- **Immutable Keys**: Configuration keys cannot be changed once set
- **Audit Trail**: All changes are tracked with timestamps and user IDs

## Validation

The system enforces:

- **Data Type Consistency**: Only the appropriate value field can be set based on data_type
- **Country Code Format**: Must be valid ISO 3166-1 alpha-2 format
- **Status Values**: Must be one of the allowed status values
- **Numeric Constraints**: min_value and max_value constraints when applicable
- **Unique Constraints**: No duplicate config_key + country_code combinations

## Future Enhancements

- **Bulk Operations**: Support for bulk updates/deletes
- **Configuration History**: Track all changes with diff capabilities
- **Dynamic Validation**: Runtime validation based on validation_rules
- **Configuration Templates**: Predefined configuration sets for new countries
- **API Rate Limiting**: Configurable rate limits per configuration
- **Configuration Caching**: Redis-based caching for frequently accessed configs
