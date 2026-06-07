# Backend module architecture

Nest modules are layered so domain code does not create constructor-time cycles. Follow these rules when adding features.

## Layers

| Layer | Examples | `@Global()` |
|-------|----------|-------------|
| Foundation | `HasuraModule`, `AccountsModule`, `AddressesModule`, `DatabaseModule`, `ConfigModule` | Yes (where noted) |
| Shared infra | `GoogleModule`, `EmbeddingsModule`, `SmsModule`, `DeliveryPinModule`, `MobilePaymentsCoreModule`, `InventoryItemsModule` | Yes — no domain imports |
| Transport | `NotificationsModule` | No (import explicitly) |
| Domain | `OrdersModule`, `RentalsModule`, `MobilePaymentsModule`, `AdminModule`, … | **No** — explicit `imports` only |

Import global foundation modules once near the top of `AppModule`.

## Rules

1. **Domain modules are not global.** Import `OrdersModule`, `RentalsModule`, etc. only where needed.
2. **Payment callbacks use a handler registry.** `MobilePaymentCallbackProcessor` must not inject `OrdersService` or `RentalsService` in its constructor. Register `OrderPaymentCallbackHandler` / `RentalPaymentCallbackHandler` from domain modules; resolve them lazily via `PaymentCallbackRegistryService`.
3. **Notifications stay transport-only.** Order-status internal webhooks live under `OrdersModule` (`OrderNotificationsInternalController`), not `NotificationsModule`.
4. **Prefer `MobilePaymentsCoreModule` for payment services.** Domain services inject `MobilePaymentsService` / `MobilePaymentsDatabaseService` from the global core module. Orchestration (controllers, callback processor, `GiveChangePayoutService`) stays in `MobilePaymentsModule`.
5. **AI generation is separate from AI HTTP.** `AiGenerationModule` exports `AiService` / `DeepseekService` without business imports. Business modules import `AiGenerationModule`; `AiModule` is the HTTP orchestration layer.
6. **Avoid `forwardRef` unless a true cycle remains.** If you add one, document why in the PR.
7. **Do not re-register shared providers** (e.g. `ConfigurationsService`) inside domain modules — import the owning module (`AdminModule`) instead.

## Verification

- `nx build backend` after module changes.
- `nx test backend --testPathPattern=app-bootstrap` — DI smoke test for `RentalsService`, `OrdersService`, and payment callback handlers.
