import { createHash } from 'crypto';

export type OtpSendLimitCode =
  | 'OTP_SEND_RATE_LIMITED'
  | 'OTP_RESEND_COOLDOWN';

export interface OtpSendLimiterInput {
  destination: string;
  identifier: string;
  ip?: string | null;
  isChannelSwitch?: boolean;
}

export interface OtpSendTiming {
  codeExpiresAt: string;
  resendAvailableAt: string;
}

export interface OtpSendViolation {
  code: OtpSendLimitCode;
  error: string;
  retryAfterSeconds: number;
  resendAvailableAt: string;
}

export function normalizeOtpDestination(
  value: string,
  kind: 'email' | 'phone'
): string {
  const trimmed = String(value || '').trim();
  return kind === 'email' ? trimmed.toLowerCase() : trimmed;
}

export function buildOtpIdentifier(params: {
  email?: string | null;
  phone?: string | null;
}): string {
  const parts: string[] = [];
  const email = normalizeOtpDestination(String(params.email || ''), 'email');
  const phone = normalizeOtpDestination(String(params.phone || ''), 'phone');
  if (email) parts.push(`email:${email}`);
  if (phone) parts.push(`phone:${phone}`);
  return parts.sort().join('|') || 'unknown';
}

export function hashOtpDestination(destination: string): string {
  return createHash('sha256').update(destination).digest('hex').slice(0, 16);
}

export function pruneSendTimestamps(
  timestamps: number[],
  windowMs: number,
  now = Date.now()
): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((ts) => ts > cutoff);
}

export function countInWindow(
  timestamps: number[],
  windowMs: number,
  now = Date.now()
): number {
  return pruneSendTimestamps(timestamps, windowMs, now).length;
}
