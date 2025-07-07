# Winston Logging with AWS CloudWatch Integration

This backend application uses Winston logging with AWS CloudWatch integration for centralized log management.

## Features

- **Structured Logging**: JSON formatted logs with metadata
- **Multiple Transports**: Console (development) and CloudWatch (production)
- **Error Handling**: Automatic capture of uncaught exceptions and unhandled rejections
- **Environment-based Configuration**: Different logging behavior for development and production
- **NestJS Integration**: Winston replaces the default NestJS logger

## Configuration

### Environment Variables

Add these environment variables to your `.env` file:

```bash
# AWS Configuration
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# CloudWatch Logging
CLOUDWATCH_LOG_GROUP=rendasua-backend-logs
CLOUDWATCH_LOG_STREAM=application

# Logging Configuration
LOG_LEVEL=debug
NODE_ENV=development
```

### Log Levels

- `error`: Only error messages
- `warn`: Error and warning messages
- `info`: Error, warning, and info messages
- `debug`: All messages including debug
- `verbose`: All messages including verbose

## Usage

### Injecting the Logger

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class YourService {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  someMethod() {
    this.logger.info('This is an info message', {
      service: 'YourService',
      method: 'someMethod',
      additionalData: 'value',
    });
  }
}
```

### Logging Methods

```typescript
// Info logging
this.logger.info('User logged in', { userId: '123', timestamp: new Date() });

// Warning logging
this.logger.warn('Rate limit approaching', { endpoint: '/api/users', count: 95 });

// Error logging
try {
  // some operation
} catch (error) {
  this.logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: 'YourService',
  });
}

// Debug logging
this.logger.debug('Processing request', { requestId: 'abc123', data: requestData });
```

## AWS CloudWatch Setup

### 1. Create Log Group

```bash
aws logs create-log-group --log-group-name rendasua-backend-logs --region ca-central-1
```

### 2. Set Retention Policy (Optional)

```bash
aws logs put-retention-policy --log-group-name rendasua-backend-logs --retention-in-days 30 --region ca-central-1
```

### 3. IAM Permissions

Ensure your AWS credentials have the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams"],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## Development vs Production

### Development Environment

- Console transport enabled
- CloudWatch transport disabled
- Pretty-printed logs with colors
- Debug level logging

### Production Environment

- Console transport disabled
- CloudWatch transport enabled
- JSON formatted logs
- Configurable log level

## Testing the Logging

### Test Endpoints

1. **Health Check**: `GET /api/health`

   - Logs info message when called

2. **Hello Endpoint**: `GET /api/`

   - Logs info message when called

3. **Error Test**: `GET /api/test-error`
   - Logs warning and error messages

### Example Log Output

#### Development (Console)

```
[2024-01-15 10:30:45] [RendasuaBackend] [INFO] [AppController] GET / endpoint called
```

#### Production (CloudWatch)

```json
{
  "level": "info",
  "message": "GET / endpoint called",
  "service": "rendasua-backend",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "service": "AppController",
  "method": "getHello",
  "endpoint": "/"
}
```

## Troubleshooting

### Common Issues

1. **CloudWatch Connection Failed**

   - Check AWS credentials
   - Verify IAM permissions
   - Ensure log group exists

2. **Logs Not Appearing**

   - Check log level configuration
   - Verify transport configuration
   - Check for error handlers

3. **Performance Issues**
   - Consider using log batching
   - Adjust log level for production
   - Monitor CloudWatch costs

### Debug Mode

Enable debug logging to see Winston internal messages:

```bash
LOG_LEVEL=debug NODE_ENV=development npm run start:dev
```

## Best Practices

1. **Structured Logging**: Always include relevant metadata
2. **Log Levels**: Use appropriate log levels for different types of messages
3. **Error Context**: Include stack traces and context for errors
4. **Performance**: Avoid logging sensitive data or large objects
5. **Monitoring**: Set up CloudWatch alarms for error rates

## References

- [Nest-Winston Documentation](https://www.npmjs.com/package/nest-winston)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Winston CloudWatch](https://github.com/winstonjs/winston-cloudwatch)
- [AWS CloudWatch Logs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
