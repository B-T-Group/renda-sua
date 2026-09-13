export type OtpChannel = 'email' | 'sms';

export function maskEmailForOtp(email: string | null | undefined): string | undefined {
  const value = String(email || '').trim().toLowerCase();
  if (!value || !value.includes('@')) return undefined;
  const [local, domain] = value.split('@');
  if (!local || !domain) return undefined;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function maskPhoneForOtp(
  phone: string | null | undefined
): string | undefined {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••••${digits.slice(-4)}`;
}

export function buildAvailableOtpChannels(input: {
  email?: string | null;
  phoneNumber?: string | null;
}): OtpChannel[] {
  const channels: OtpChannel[] = [];
  if (String(input.email || '').trim()) channels.push('email');
  if (String(input.phoneNumber || '').trim()) channels.push('sms');
  return channels;
}
