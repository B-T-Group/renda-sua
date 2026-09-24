/** OTP code length for web auth UI (env override; backend may change later). */
export function getAuthOtpCodeLength(): number {
  const raw = process.env.REACT_APP_AUTH_OTP_LENGTH;
  const parsed = raw ? Number.parseInt(raw, 10) : 4;
  if (!Number.isFinite(parsed) || parsed < 4 || parsed > 8) return 4;
  return parsed;
}
