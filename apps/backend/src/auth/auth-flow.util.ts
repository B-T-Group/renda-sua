import {
  maskEmailForOtp,
  maskPhoneForOtp,
  type OtpChannel,
} from './otp-channel.util';

export const AUTH_REQUEST_FAILED_CODE = 'AUTH_REQUEST_FAILED';

export function isAuthFlowV2(flowVersion?: number): boolean {
  return flowVersion === 2;
}

export interface TypedIdentifierOtpOptions {
  defaultChannel: OtpChannel;
  availableChannels: OtpChannel[];
  maskedEmail?: string;
  maskedPhone?: string;
}

export function buildTypedIdentifierOtpOptions(
  email: string,
  phone: string
): TypedIdentifierOtpOptions {
  const channel: OtpChannel = email ? 'email' : 'sms';
  return {
    defaultChannel: channel,
    availableChannels: [channel],
    maskedEmail: email ? maskEmailForOtp(email) : undefined,
    maskedPhone: phone ? maskPhoneForOtp(phone) : undefined,
  };
}

export function toUniformFlowStartResult(
  flowId: string,
  email: string,
  phone: string,
  timing: { codeExpiresAt: string; resendAvailableAt: string }
) {
  const options = buildTypedIdentifierOtpOptions(email, phone);
  return {
    flowId,
    channel: options.defaultChannel,
    ...options,
    expiresAt: timing.codeExpiresAt,
    codeExpiresAt: timing.codeExpiresAt,
    resendAvailableAt: timing.resendAvailableAt,
  };
}
