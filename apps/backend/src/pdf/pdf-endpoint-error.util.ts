import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export const PDF_UNAVAILABLE_MESSAGE =
  'Could not generate the PDF. Please try again later.';

export const PDF_STORE_FAILED_MESSAGE =
  'Could not store the signed agreement. Please try again later.';

export function httpExceptionFromPdfEndpointError(
  error: unknown
): HttpException {
  return httpExceptionFromPdfAxiosError(error, PDF_UNAVAILABLE_MESSAGE);
}

export function httpExceptionFromPdfStoreError(error: unknown): HttpException {
  return httpExceptionFromPdfAxiosError(error, PDF_STORE_FAILED_MESSAGE);
}

export function httpExceptionFromPdfAxiosError(
  error: unknown,
  fallbackMessage: string
): HttpException {
  if (error instanceof HttpException) return error;
  const status = axiosStatus(error);
  return new HttpException(fallbackMessage, httpStatusForPdfAxios(status, error), {
    cause: error,
  });
}

function httpStatusForPdfAxios(
  status: number | undefined,
  error: unknown
): HttpStatus {
  if (isTimeoutError(error)) return HttpStatus.REQUEST_TIMEOUT;
  if (status === 429) return HttpStatus.TOO_MANY_REQUESTS;
  if (status === 401 || status === 403) return HttpStatus.SERVICE_UNAVAILABLE;
  if (status && status >= 400 && status < 500) return HttpStatus.BAD_REQUEST;
  if (status && status >= 500) return HttpStatus.BAD_GATEWAY;
  return HttpStatus.BAD_GATEWAY;
}

function axiosStatus(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return error.response?.status;
}

function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ECONNABORTED'
  );
}
