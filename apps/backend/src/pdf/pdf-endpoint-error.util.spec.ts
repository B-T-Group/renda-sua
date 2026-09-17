import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import {
  PDF_STORE_FAILED_MESSAGE,
  PDF_UNAVAILABLE_MESSAGE,
  httpExceptionFromPdfEndpointError,
  httpExceptionFromPdfStoreError,
} from './pdf-endpoint-error.util';

function axiosError(status?: number, code?: string) {
  return {
    isAxiosError: true,
    message: status
      ? `Request failed with status code ${status}`
      : 'Network Error',
    response: status ? { status, data: { error: 'denied' } } : undefined,
    code,
  };
}

describe('httpExceptionFromPdfEndpointError', () => {
  it('maps PDFEndpoint 403 to 503 instead of leaking AxiosError', () => {
    const exception = httpExceptionFromPdfEndpointError(axiosError(403));

    expect(exception).toBeInstanceOf(HttpException);
    expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(exception.message).toBe(PDF_UNAVAILABLE_MESSAGE);
    expect(axios.isAxiosError(exception)).toBe(false);
  });

  it('maps 401 to 503 and 429 to 429', () => {
    expect(httpExceptionFromPdfEndpointError(axiosError(401)).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE
    );
    expect(httpExceptionFromPdfEndpointError(axiosError(429)).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS
    );
  });

  it('maps 400 to 400 and 5xx to 502', () => {
    expect(httpExceptionFromPdfEndpointError(axiosError(400)).getStatus()).toBe(
      HttpStatus.BAD_REQUEST
    );
    expect(httpExceptionFromPdfEndpointError(axiosError(500)).getStatus()).toBe(
      HttpStatus.BAD_GATEWAY
    );
  });

  it('maps timeouts to 408 and rethrows HttpException', () => {
    const timeout = httpExceptionFromPdfEndpointError(
      axiosError(undefined, 'ECONNABORTED')
    );
    expect(timeout.getStatus()).toBe(HttpStatus.REQUEST_TIMEOUT);
    const original = new HttpException('already mapped', HttpStatus.BAD_REQUEST);
    expect(httpExceptionFromPdfEndpointError(original)).toBe(original);
  });

  it('uses the store message for S3 upload failures', () => {
    const exception = httpExceptionFromPdfStoreError(axiosError(403));
    expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(exception.message).toBe(PDF_STORE_FAILED_MESSAGE);
  });
});
