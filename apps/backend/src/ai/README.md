# AI Module

This module provides AI-powered product description generation using OpenAI's GPT-3.5-turbo model.

## Features

- **Product Description Generation**: Generate compelling product descriptions based on product details
- **Multilingual Support**: Supports English and French descriptions
- **Comprehensive Input**: Accepts product name, SKU, category, subcategory, price, currency, weight, brand, and language
- **Error Handling**: Comprehensive error handling for API failures, rate limits, and timeouts
- **Security**: Protected with JWT authentication
- **Swagger Documentation**: Full API documentation with examples

## API Endpoint

### Generate Product Description

**POST** `/ai/generate-description`

**Authentication**: Bearer token required

**Request Body**:

```json
{
  "name": "Wireless Bluetooth Headphones",
  "sku": "WBH-001",
  "category": "Electronics",
  "subCategory": "Audio & Headphones",
  "price": 99.99,
  "currency": "XAF",
  "weight": 250,
  "weightUnit": "g",
  "brand": "TechSound",
  "language": "en"
}
```

**Response**:

```json
{
  "success": true,
  "description": "Experience premium sound quality with our wireless Bluetooth headphones. Featuring advanced noise cancellation and 30-hour battery life, these headphones deliver exceptional audio performance for both work and leisure.",
  "message": "Product description generated successfully"
}
```

## Environment Setup

### Required Environment Variable

Add the following environment variable to your `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
```

### Getting an OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to the API section
4. Create a new API key
5. Copy the key and add it to your environment variables

### Cost Considerations

- **GPT-3.5-turbo**: $0.002 per 1K tokens (input + output)
- **Average cost per description**: ~$0.001-0.003
- **Monthly cost for 1000 descriptions**: ~$1-3
- **Free tier**: $5 credit for new accounts

## Error Handling

The service handles various error scenarios:

- **401 Unauthorized**: Invalid OpenAI API key
- **429 Too Many Requests**: OpenAI API rate limit exceeded
- **408 Request Timeout**: Request timeout (30 seconds)
- **500 Internal Server Error**: General API failures

## Usage Examples

### English Description

```bash
curl -X POST http://localhost:3000/ai/generate-description \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Bluetooth Headphones",
    "category": "Electronics",
    "brand": "TechSound",
    "language": "en"
  }'
```

### French Description

```bash
curl -X POST http://localhost:3000/ai/generate-description \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Casque Bluetooth Sans Fil",
    "category": "Électronique",
    "brand": "TechSound",
    "language": "fr"
  }'
```

## Integration with Frontend

The AI service can be integrated with the frontend ItemFormPage to automatically generate product descriptions. The frontend can call this API when the user clicks a "Generate Description" button.

## Security Notes

- API key is stored securely in environment variables
- Endpoint is protected with JWT authentication
- Input validation prevents malicious requests
- Rate limiting handled by OpenAI API

## Monitoring and Logging

The service includes comprehensive logging:

- Request/response logging
- Error tracking
- Performance monitoring
- OpenAI API usage tracking
