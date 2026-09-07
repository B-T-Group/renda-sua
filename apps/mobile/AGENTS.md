# AGENTS.md

## Cursor Cloud specific instructions

This repo (`agent-mobile`, "Rendasua Agent") is an **Expo SDK 55 / React Native 0.83 /
TypeScript** mobile app. It is a **thin client** — there is no backend in this repo. It
talks to remote services (Auth0, a NestJS REST API, Hasura GraphQL, Stripe). The default
environment is **prod** (`app.config.ts` `MANUAL_ENV=null` → prod; runtime env is chosen by
`src/config/auth0.ts` / `src/config/envSwitch.ts`). See `README.md` and `docs/AGENT_SERVICES.md`.

Package manager is **Yarn Classic (v1)**, pinned via `packageManager`. Dependencies are
refreshed automatically by the startup update script (`yarn install --frozen-lockfile`), so
you normally don't need to install anything manually.

### Running the app (cloud VM)

- Use the **web target** to test in the cloud VM (no device/simulator is available):
  `yarn web` (runs `expo start --web`, serves on `http://localhost:8081`).
- The first web bundle is large and takes ~10–20s to compile the first time you load the
  page (Metro shows a progress bar; the browser may show a blank screen until it finishes).
  You can pre-warm it with `curl "http://localhost:8081/index.bundle?platform=web&dev=true&hot=false"`.
- Native targets (`yarn ios` / `yarn android` / `expo run:*`) need a simulator/device and a
  dev-client build; they do **not** work in the cloud VM. Expo Go is not usable for the
  Stripe native module either.

### Web target caveats (native-only features)

These flows are native-only and will NOT work on the web target: Stripe PaymentSheet
(`@stripe/stripe-react-native`), push notifications (`expo-notifications`), background
location / agent GPS sharing (`expo-location`), maps, and **saved-account biometric unlock**
(`expo-local-authentication` / `expo-secure-store`). On web, users sign in with OTP only.

### Tests / lint / build

- Tests: `yarn test` (Vitest, node env, `src/**/*.test.ts`). This is the **only** CI gate
  (`.github/workflows/mobile-ci.yml` runs `yarn install --frozen-lockfile` + `yarn test`).
- There is **no `lint` or `typecheck` npm script** and no ESLint config. Running
  `npx tsc --noEmit` currently reports **pre-existing** type errors in the repo, so it is not
  a clean gate — do not treat those errors as introduced by your change.
- Production builds go through EAS (`eas build`, see `eas.json`) and require an `EXPO_TOKEN`;
  they are not part of local dev.

### Env switching

Env defaults to prod. Switch at runtime via Developer Options (About → 7 taps on the version;
persisted to AsyncStorage), or override URLs at build time with `EXPO_PUBLIC_API_URL` /
`EXPO_PUBLIC_HASURA_URL` (restart the bundler after changing). `yarn web:local` points the API
at `http://localhost:3000/api`.

### Multi-account biometric auth (native)

- Refresh tokens are stored in **`expo-secure-store`** only; account metadata lives in
  AsyncStorage (`SavedAccountService`, env-scoped: `dev` / `prod` / `local`).
- **`SessionService`** orchestrates OTP login completion, saved-account sign-in, account
  switching, and logout (keep vs remove).
- Adding `expo-secure-store` / `expo-local-authentication` requires a **new native dev-client /
  EAS build** (OTA alone is insufficient for the first release of this feature).
