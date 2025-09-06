# Inventory Items Module

This module provides API endpoints for managing inventory items in the system.

## Endpoints

### GET /inventory-items

**Public endpoint** - Get paginated inventory items with optional filters.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search term for item name, description, SKU, or brand
- `category` (optional): Filter by category name
- `brand` (optional): Filter by brand name
- `min_price` (optional): Minimum price filter
- `max_price` (optional): Maximum price filter
- `currency` (optional): Filter by currency (XAF, USD, etc.)
- `is_active` (optional): Filter by active status (default: true)

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  },
  "message": "Inventory items retrieved successfully"
}
```

### GET /inventory-items/:id

**Protected endpoint** - Get a specific inventory item by ID.

**Parameters:**

- `id`: UUID of the inventory item

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "business_location_id": "uuid",
    "item_id": "uuid",
    "computed_available_quantity": 10,
    "selling_price": 1000,
    "is_active": true,
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z",
    "item": {
      "id": "uuid",
      "name": "Item Name",
      "description": "Item description",
      "price": 1000,
      "currency": "XAF",
      "weight": 1.5,
      "weight_unit": "kg",
      "size": 10,
      "size_unit": "cm",
      "item_sub_category_id": 1,
      "sku": "SKU123",
      "brand": {
        "id": "uuid",
        "name": "Brand Name"
      },
      "model": "Model Name",
      "color": "Red",
      "material": "Plastic",
      "is_fragile": false,
      "is_perishable": false,
      "requires_special_handling": false,
      "max_delivery_distance": 50,
      "estimated_delivery_time": 2,
      "min_order_quantity": 1,
      "max_order_quantity": 10,
      "is_active": true,
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z",
      "item_sub_category": {
        "id": 1,
        "name": "Sub Category",
        "item_category": {
          "id": 1,
          "name": "Category"
        }
      },
      "item_images": [
        {
          "id": "uuid",
          "image_url": "https://example.com/image.jpg",
          "image_type": "PRIMARY",
          "alt_text": "Item image",
          "caption": "Item caption",
          "display_order": 1
        }
      ]
    },
    "business_location": {
      "id": "uuid",
      "business_id": "uuid",
      "name": "Location Name",
      "location_type": "STORE",
      "is_primary": true,
      "business": {
        "id": "uuid",
        "name": "Business Name",
        "is_verified": true
      },
      "address": {
        "id": "uuid",
        "address_line_1": "123 Main St",
        "address_line_2": "Suite 100",
        "city": "City",
        "state": "State",
        "postal_code": "12345",
        "country": "Country"
      }
    }
  },
  "message": "Inventory item retrieved successfully"
}
```

## Features

- **Pagination**: Support for paginated results with configurable page size
- **Search**: Full-text search across item name, description, SKU, and brand
- **Filtering**: Multiple filter options including category, brand, price range, and currency
- **Business Verification**: Only shows items from verified businesses
- **Active Status**: Filter by active/inactive items
- **Comprehensive Data**: Includes full item details, business location, and address information

## Security

- `/inventory-items` is a public endpoint (no authentication required)
- `/inventory-items/:id` requires user authentication
- Only shows items from verified businesses
- Respects item active status

## Error Handling

The module provides comprehensive error handling with appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (for protected endpoints)
- `404`: Not Found (item doesn't exist)
- `500`: Internal Server Error

All error responses follow the standard format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Error details"
}
```
