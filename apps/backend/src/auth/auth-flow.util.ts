export const AUTH_REQUEST_FAILED_CODE = 'AUTH_REQUEST_FAILED';

export function isAuthFlowV2(flowVersion?: number): boolean {
  return flowVersion === 2;
}
