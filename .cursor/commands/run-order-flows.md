# Run order flows (dev API)

Drive one or more core orders on the **dev** API until each order is complete, then print a report.

## Follow the skill

Read and follow:

`.cursor/skills/run-order-flows/SKILL.md`

Use [reference.md](../skills/run-order-flows/reference.md) for request bodies and step lists.

## Ask first

Before any API call, call **AskQuestion** (single select):

| id | label |
|----|--------|
| `food` | Food order (cooked, delivery) |
| `pay_after_confirm` | Item order — pay after the store confirms |
| `pay_at_delivery` | Item order — pay at delivery |
| `pay_at_pickup` | Item order — pay at pickup |
| `all` | All four |

`all` runs food, then pay-after-confirm, then pay-at-delivery, then pay-at-pickup.

If the user already named a flow in the same message, use that and skip the question.

## Execute

Sign in once, run each selected flow to `complete`, restore any flags you changed, and print one report. Dev only. Do not cancel orders.
