# Rendasua — Agent Order Detail Declutter: UX / AC
Status: Locked by Samuel, 2026-10-31. Implemented on mobile (`apps/mobile`).

## Reference inventory
- `OrderDetailAgentView`: the screen being changed.
- `ActiveDeliveryView`: the persistent bottom sheet. Removed from this screen; content reused inline.
- `PersistentActiveDeliveryHeader`: hidden here (same rule as Home).
- `deliveryUrgency`: the one source for the urgency line.
- #726 Home pattern: inline active-delivery content, no persistent header, single CTA.

## Target layout (top → bottom)
1. Delivery block, inline at the top of the scroll. This is the former ActiveDeliveryView content, with the same component and data for every status.
2. Status row: one status pill and one urgency line.
3. Scrollable details: pickup/dropoff addresses, items, customer/merchant contact, payment/earnings, notes, history.
4. Sticky footer: one primary CTA. A More (⋯) overflow sits in the header.

## Acceptance criteria
1. AgentOrderDetail renders no ActiveDeliveryView bottom sheet (persistent, collapsible or modal) for any order status.
2. Delivery content appears inline as the first scroll section and looks/behaves the same before claim, during delivery (picked up / in transit) and after (delivered/cancelled, read-only where actions don't apply).
3. PersistentActiveDeliveryHeader is not shown on this screen, even when the agent has an active delivery. It still appears on screens that show it today, except Home and this screen.
4. Exactly one sticky primary CTA, and its label follows the status (e.g. Claim → Confirm pickup → Mark delivered). In terminal states with no action, the sticky footer is hidden.
5. Secondary and destructive actions live only in the More (⋯) menu: Running late, Release order, Report a problem. None of them shows as a standalone button.
6. Release (unassign/drop) and support ticket are clearly different. Release uses destructive styling and asks for confirmation. Report a problem opens the support/issue flow and does not release the order.
7. A menu item that doesn't apply to the current status is hidden, not disabled (e.g. Running late after delivery, Release after pickup if the rules forbid it). If the menu would be empty, ⋯ is hidden.
8. Exactly one status pill on the screen.
9. Exactly one urgency line from `deliveryUrgency`. Before pickup it shows the pickup-by time. After pickup it shows the deliver-by time. Overdue/at-risk styling uses deliveryUrgency's levels.
10. Remove the workflow/step indicator, the phase "next step" text and the separate time-window card wherever they only restate the pill, urgency line or CTA. Keep any unique info by moving it into details.
11. Scroll bottom padding equals the sticky CTA height plus the safe area, with no extra space left for a sheet. The last detail row is fully visible above the CTA.
12. All new and renamed strings exist in EN and FR. FR uses "vous". No hardcoded strings.
13. No regressions: the claim, pickup, deliver, running-late, release and report flows still work end to end. Analytics events keep their names (or are mapped).
