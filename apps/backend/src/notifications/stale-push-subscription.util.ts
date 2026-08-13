/** Web Push 404/410 means the browser unsubscribed or the endpoint expired. */
export function isExpiredWebPushError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

/** Expo DeviceNotRegistered means the token is no longer valid for that device. */
export function isExpiredExpoPushError(errorCode: string | undefined): boolean {
  return errorCode === 'DeviceNotRegistered';
}
