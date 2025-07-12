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
  "country": "CM",
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
- `country`: Country code (ISO 3166-1 alpha-2 format, e.g., "CM", "US", "GB")

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
      "country": "CM",
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

1. **Currency Detection**: The system uses the `country-to-currency` package to determine the currency for the selected country code
2. **Existing Account Check**: Checks if the user already has an account with the detected currency
3. **Account Creation**: If no account exists for the currency, a new account is created with:
   - Zero initial balance
   - Active status
   - The detected currency

#### Database Schema

The address creation process involves multiple tables:

1. **addresses**: Stores the actual address information
2. **client_addresses**: Junction table linking clients to addresses
3. **business_addresses**: Junction table linking businesses to addresses
4. **agent_addresses**: Junction table linking agents to addresses
5. **accounts**: Stores user accounts with different currencies

#### Currency Mapping

The system uses ISO 3166-1 alpha-2 country codes (e.g., "CM", "US", "GB") and maps them to ISO 4217 currency codes:

- **CM** (Cameroon) → **XAF** (Central African CFA franc)
- **US** (United States) → **USD** (US Dollar)
- **GB** (United Kingdom) → **GBP** (British Pound)
- **DE** (Germany) → **EUR** (Euro)
- **NG** (Nigeria) → **NGN** (Nigerian Naira)
- **ZA** (South Africa) → **ZAR** (South African Rand)
- **KE** (Kenya) → **KES** (Kenyan Shilling)
- **GH** (Ghana) → **GHS** (Ghanaian Cedi)

#### Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400 Bad Request**: Missing required fields or invalid data
- **401 Unauthorized**: Missing or invalid authentication
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server-side errors

#### Authentication

This endpoint requires a valid JWT token in the Authorization header. The token must contain a valid user identifier that exists in the system.

#### Dependencies

- `country-to-currency`: For mapping country codes to currency codes
- `@nestjs/common`: For HTTP decorators and exceptions
- `HasuraSystemService`: For GraphQL mutations with admin privileges
- `HasuraUserService`: For user authentication and data retrieval
