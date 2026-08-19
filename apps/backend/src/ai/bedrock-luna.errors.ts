import { HttpException, HttpStatus } from '@nestjs/common';

export function mapBedrockErrorToHttpException(error: any): HttpException {
  return new HttpException(bedrockUserMessage(error), bedrockHttpStatus(error), {
    cause: error,
  });
}

function bedrockHttpStatus(error: any): HttpStatus {
  const status = error?.$metadata?.httpStatusCode;
  if (status === 429 || error?.name === 'ThrottlingException') {
    return HttpStatus.TOO_MANY_REQUESTS;
  }
  if (error?.code === 'ECONNABORTED') {
    return HttpStatus.REQUEST_TIMEOUT;
  }
  return HttpStatus.SERVICE_UNAVAILABLE;
}

function bedrockUserMessage(error: any): string {
  if (error?.code === 'ECONNABORTED') {
    return 'AI request timed out. Please try again.';
  }
  const status = error?.$metadata?.httpStatusCode;
  if (
    status === 401 ||
    status === 403 ||
    status === 429 ||
    error?.name === 'ThrottlingException'
  ) {
    return 'AI temporarily unavailable. Please try again later.';
  }
  return 'AI temporarily unavailable. Please try again.';
}
