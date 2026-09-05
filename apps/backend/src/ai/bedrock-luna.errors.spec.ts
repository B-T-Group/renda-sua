import { HttpStatus } from '@nestjs/common';
import { mapBedrockErrorToHttpException } from './bedrock-luna.errors';

describe('mapBedrockErrorToHttpException', () => {
  it('maps ValidationException (400) to 503 and preserves cause', () => {
    const awsError = {
      name: 'ValidationException',
      message: 'The maximum image size is 3.75 MB',
      $metadata: { httpStatusCode: 400 },
    };
    const mapped = mapBedrockErrorToHttpException(awsError);
    expect(mapped.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mapped.message).toBe('AI temporarily unavailable. Please try again.');
    expect(mapped.cause).toBe(awsError);
  });

  it('maps 403 to 503 with the later-retry message', () => {
    const mapped = mapBedrockErrorToHttpException({
      name: 'AccessDeniedException',
      $metadata: { httpStatusCode: 403 },
    });
    expect(mapped.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mapped.message).toBe(
      'AI temporarily unavailable. Please try again later.'
    );
  });

  it('maps throttling to 429', () => {
    const mapped = mapBedrockErrorToHttpException({
      name: 'ThrottlingException',
      $metadata: { httpStatusCode: 429 },
    });
    expect(mapped.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('maps aborted converse to 408', () => {
    const mapped = mapBedrockErrorToHttpException({
      code: 'ECONNABORTED',
      message: 'Bedrock Converse timed out',
    });
    expect(mapped.getStatus()).toBe(HttpStatus.REQUEST_TIMEOUT);
    expect(mapped.message).toBe('AI request timed out. Please try again.');
  });
});
