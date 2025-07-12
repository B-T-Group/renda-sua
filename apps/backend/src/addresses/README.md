# Addresses API

This module provides address management functionality with automatic account creation based on country selection.

## Features

- **Address Creation**: Create addresses for users and businesses
- **Automatic Account Creation**: Automatically creates accounts based on the country's currency
- **Currency Detection**: Uses country-to-currency mapping to determine the appropriate currency
- **Junction Table Integration**: Uses junction tables to link addresses to different entity types

## API Endpoints

### POST /addresses

Creates a new address and optionally creates an account for the country's currency.

#### Request Body

```json
{
  "address_line_1": "123 Main Street",
  "address_line_2": "Apt 4B",
  "city": "Douala",
  "state": "Littoral",
  "postal_code": "237",
  "country": "Cameroon",
  "is_primary": false,
  "address_type": "home",
  "latitude": 4.0511,
  "longitude": 9.7679
}
```

#### Required Fields

- `address_line_1`: Primary address line
- `city`: City name
- `state`: State/province name
- `postal_code`: Postal/ZIP code
- `country`: Country name

#### Optional Fields

- `address_line_2`: Secondary address line
- `is_primary`: Whether this is the primary address (default: false)
- `address_type`: Type of address - home, work, delivery, billing, etc. (default: "home")
- `latitude`: Latitude coordinate
- `longitude`: Longitude coordinate

#### Response

```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "id": "uuid",
      "address_line_1": "123 Main Street",
      "address_line_2": "Apt 4B",
      "city": "Douala",
      "state": "Littoral",
      "postal_code": "237",
      "country": "Cameroon",
      "is_primary": false,
      "address_type": "home",
      "latitude": 4.0511,
      "longitude": 9.7679,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    "accountCreated": {
      "message": "New account created with currency XAF",
      "account": {
        "id": "account-uuid",
        "user_id": "user-uuid",
        "currency": "XAF",
        "available_balance": 0,
        "withheld_balance": 0,
        "total_balance": 0,
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

#### Account Creation Logic

1. **Currency Detection**: The system uses the `country-currency-map` package to determine the currency for the selected country
2. **Existing Account Check**: Checks if the user already has an account with the detected currency
3. **Account Creation**: If no account exists for the currency, a new account is created with:
   - Zero initial balance
   - Active status
   - The detected currency

#### Database Schema

The address creation process involves multiple tables:

1. **addresses**: Stores the actual address information

   - `id`: Primary key
   - `address_line_1`: Primary address line
   - `address_line_2`: Secondary address line (optional)
   - `city`: City name
   - `state`: State/province name
   - `postal_code`: Postal/ZIP code
   - `country`: Country name
   - `is_primary`: Whether this is the primary address
   - `address_type`: Type of address (home, work, delivery, etc.)
   - `latitude`: Latitude coordinate (optional)
   - `longitude`: Longitude coordinate (optional)
   - `created_at`: Creation timestamp
   - `updated_at`: Last update timestamp

2. **Junction Tables**: Link addresses to different entity types

   - `client_addresses`: Links addresses to clients
   - `agent_addresses`: Links addresses to agents
   - `business_addresses`: Links addresses to businesses

3. **accounts**: Stores user account information
   - `user_id`: Reference to the user
   - `currency`: Account currency
   - `available_balance`: Available balance
   - `withheld_balance`: Withheld balance
   - `total_balance`: Computed total balance

#### Entity Type Detection

The system determines the entity type based on the user's `user_type_id`:

- `1`: Client → Creates entry in `client_addresses`
- `2`: Business → Creates entry in `business_addresses`
- `3`: Agent → Creates entry in `agent_addresses`

#### Error Handling

- **400 Bad Request**: Missing required fields
- **404 Not Found**: User not found
- **409 Conflict**: User already has an account with the detected currency
- **500 Internal Server Error**: Database or system errors

#### Authentication

This endpoint requires authentication. The user identifier is extracted from the authentication context to determine the user and their entity type.

#### Dependencies

- `country-currency-map`: For country-to-currency mapping
- `@nestjs/common`: NestJS framework
- Hasura services for database operations
