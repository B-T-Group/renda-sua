# Auth flow v2 (362b) — interim Auth0 tokens

After OTP verify for **unknown** identifiers, Auth0 tokens are stored on
`signup_attempts.completion_result` while the user completes `/auth/signup/finish`.

- Tokens are **cleared** (`completion_result.tokens` set to `null`) after a successful finish.
- Expired `pending` / `otp_verified` attempts are cleaned with `completion_result: null`.
- Known-user login flows keep tokens only in the session / mobile response (Redis flow mapping holds no tokens).

We did not move interim tokens to Redis to avoid a second store and keep finish idempotency on the attempt row.
