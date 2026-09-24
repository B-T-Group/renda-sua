# Auth funnel site events (UX section 6)

Web and server events for measuring auth gates, OTP delivery, and session migration. Keep **`auth_web_inapp_gates`** off in client flags for a **2-week baseline** before comparing gate-on vs gate-off funnels.

## Client events

| Event | When |
| --- | --- |
| `auth_gate_shown` | User hits an auth gate (before Auth0 universal login redirect) |
| `auth_gate_dismissed` | Login method dialog or OTP page closed without completing |
| `auth_intent_completed` | Auth0 redirect callback after a stashed gate |
| `auth_session_observed` | Once per load for signed-in users (includes `legacy_auth0_session_present`) |

## Server events (`source: server`)

| Event | When |
| --- | --- |
| `auth_code_sent` | OTP send succeeded (login/signup) |
| `auth_code_send_failed` | OTP send failed (`fail_reason`, e.g. `rate_limited` on 429) |
| `auth_code_failed` | OTP verification failed |
| `auth_locked` | Lockout / max attempts |
| `auth_code_verified` | OTP verified (`is_new_account` on signup) |

## Metadata

- **`auth_*` events**: allowlisted keys only (no email, phone, codes, or `loginHint`).
- **All events**: backend strips values that look like email, phone (≥7 digits), or short numeric codes under sensitive keys.
