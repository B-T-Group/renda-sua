# AWS Service

This module provides AWS S3 integration for generating presigned upload URLs using AWS SDK v3.

## Features

- Generate presigned URLs for S3 uploads
- Support for different file types (images, documents, general files)
- Automatic unique key generation
- Configurable expiration times
- Metadata support

## Environment Variables

Make sure to set the following environment variables:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## API Endpoints

### 1. Generate General Presigned URL

**POST** `/api/aws/presigned-url`

```json
{
  "bucketName": "your-bucket-name",
  "originalFileName": "example.jpg",
  "contentType": "image/jpeg",
  "expiresIn": 3600,
  "prefix": "uploads",
  "metadata": {
    "user-id": "123",
    "category": "profile"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://your-bucket.s3.amazonaws.com/...",
    "fields": {
      "bucket": "your-bucket-name",
      "key": "uploads/1234567890-abc123-example.jpg",
      "Content-Type": "image/jpeg",
      "user-id": "123",
      "category": "profile"
    },
    "expiresAt": "2024-01-01T12:00:00.000Z",
    "key": "uploads/1234567890-abc123-example.jpg"
  }
}
```

### 2. Generate Image Upload URL

**POST** `/api/aws/presigned-url/image`

```json
{
  "bucketName": "your-bucket-name",
  "originalFileName": "profile.jpg",
  "contentType": "image/jpeg",
  "expiresIn": 3600,
  "prefix": "images"
}
```

### 3. Generate Document Upload URL

**POST** `/api/aws/presigned-url/document`

```json
{
  "bucketName": "your-bucket-name",
  "originalFileName": "contract.pdf",
  "contentType": "application/pdf",
  "expiresIn": 3600,
  "prefix": "documents"
}
```

### 4. Generate Unique Keys

**GET** `/api/aws/generate-key?originalFileName=example.jpg&prefix=uploads`

**Response:**

```json
{
  "success": true,
  "key": "uploads/1234567890-abc123-example.jpg"
}
```

## Usage Examples

### Frontend Integration

```typescript
// Generate presigned URL for image upload
const response = await fetch('/api/aws/presigned-url/image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    bucketName: 'my-bucket',
    originalFileName: 'profile.jpg',
    contentType: 'image/jpeg',
  }),
});

const { data } = await response.json();

// Upload file directly to S3
const formData = new FormData();
Object.entries(data.fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', file);

await fetch(data.url, {
  method: 'POST',
  body: formData,
});
```

### Direct Service Usage

```typescript
import { AwsService } from './aws.service';

@Injectable()
export class MyService {
  constructor(private readonly awsService: AwsService) {}

  async uploadFile(file: Express.Multer.File) {
    const key = this.awsService.generateUniqueKey(file.originalname, 'uploads');

    const presignedUrl = await this.awsService.generatePresignedUploadUrl({
      bucketName: 'my-bucket',
      key,
      contentType: file.mimetype,
      expiresIn: 3600,
      metadata: {
        'uploaded-by': 'user-123',
        'file-size': file.size.toString(),
      },
    });

    return presignedUrl;
  }
}
```

## Service Methods

### `generatePresignedUploadUrl(options: PresignedUrlOptions)`

Generate a presigned URL for S3 upload.

**Parameters:**

- `bucketName`: S3 bucket name (required)
- `key`: Object key in S3 (required)
- `contentType`: MIME type (default: 'application/octet-stream')
- `expiresIn`: Expiration time in seconds (default: 3600)
- `metadata`: Additional metadata (optional)

### `generateImageUploadUrl(bucketName, key, contentType, expiresIn)`

Generate a presigned URL specifically for image uploads.

### `generateDocumentUploadUrl(bucketName, key, contentType, expiresIn)`

Generate a presigned URL specifically for document uploads.

### `generateUniqueKey(originalName, prefix)`

Generate a unique key for S3 objects.

**Parameters:**

- `originalName`: Original filename
- `prefix`: Optional prefix for the key (default: 'uploads')

## Security Considerations

1. **IAM Permissions**: Ensure your AWS credentials have minimal required permissions
2. **Bucket Policies**: Configure S3 bucket policies to restrict access
3. **CORS**: Set up CORS on your S3 bucket for web uploads
4. **Expiration**: Use appropriate expiration times for presigned URLs
5. **Validation**: Validate file types and sizes on the server side

## Error Handling

The service includes comprehensive error handling:

- Missing required parameters
- AWS SDK errors
- Invalid bucket names or keys
- Network connectivity issues

All errors are properly typed and include descriptive messages.

## Testing

To test the endpoints locally:

```bash
# Test general presigned URL
curl -X POST http://localhost:3000/api/aws/presigned-url \
  -H "Content-Type: application/json" \
  -d '{
    "bucketName": "test-bucket",
    "originalFileName": "test.jpg",
    "contentType": "image/jpeg"
  }'

# Test key generation
curl "http://localhost:3000/api/aws/generate-key?originalFileName=test.jpg&prefix=uploads"
```
