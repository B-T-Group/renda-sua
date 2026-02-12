# Rendasua Delivery App Roadmap

## Overview

This roadmap outlines the path to make Rendasua a top-tier delivery app ready for production. The application already has a solid foundation: full order lifecycle, mobile payments (MyPVit, MTN MoMo), email notifications, agent location tracking, multi-role dashboards (Client, Business, Agent, Admin), ratings, i18n (EN/FR), PWA support, and E2E tests. The roadmap addresses critical gaps and enhancements in four phases.

---

## Phase 1: Launch Blockers

Items that should be in place before a production launch.

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 1.1 | Live tracking map for clients | Real-time map showing agent location during delivery | Client sees map on order detail when status is picked_up/in_transit/out_for_delivery; agent location updates every 30–60s |
| 1.2 | Push notifications (Web Push) | Browser push for order status changes | Clients receive push for out_for_delivery and delivered; agents for assigned; subscriptions stored and sent via backend |
| 1.3 | SMS notifications | Critical events via SMS (Twilio or similar) | Optional SMS for order_created, order_assigned, out_for_delivery, delivered; gated by config |
| 1.4 | Backend rate limiting | Throttle API by IP/endpoint | Global limit; stricter limits on auth, payment, order mutations; X-RateLimit-* headers returned |

**Status:**  
- [x] 1.1 Live tracking map  
- [x] 1.2 Push notifications  
- [x] 1.3 SMS notifications  
- [x] 1.4 Backend rate limiting  

---

## Phase 2: Trust and Operations

Build trust and operational visibility after launch.

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 2.1 | Business analytics dashboard | Metrics and charts for businesses | Sales by period, order funnel, top items, revenue, delivery performance; route /business/analytics |
| 2.2 | Support / dispute ticket system | Structured way to report issues | support_tickets table; create/list/update tickets; "Report issue" on order; admin resolution workflow |
| 2.3 | Real-time order updates in UI | Live order status without refresh | ManageOrderPage and order lists use GraphQL subscriptions; "live" indicator |
| 2.4 | Observability and monitoring | Frontend and backend visibility | GA4 (or equivalent) on frontend; enhanced /health; Sentry (or similar); metrics; documented alerts |

**Status:**  
- [x] 2.1 Business analytics  
- [x] 2.2 Support tickets  
- [x] 2.3 Real-time subscriptions  
- [x] 2.4 Observability  

---

## Phase 3: Growth

Features to drive retention and conversion.

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 3.1 | Notification preferences | User control over channels | user_notification_preferences table; UI to toggle email/SMS/push per event type |
| 3.2 | Reorder / favorites | Easy repeat orders | "Reorder" from past orders; saved addresses; optional saved cart or wishlist |
| 3.3 | Promotions and coupons | Discounts and campaigns | Coupon codes; discount rules (fixed/percentage); promo analytics |
| 3.4 | Search and discovery | Better findability | Improved search (fuzzy, filters); sort by popularity, rating, newest |

**Status:**  
- [ ] 3.1 Notification preferences  
- [ ] 3.2 Reorder / favorites  
- [ ] 3.3 Promotions  
- [ ] 3.4 Search improvements  

---

## Phase 4: Scale

Differentiation and scale.

| # | Deliverable | Description | Acceptance Criteria |
|---|-------------|-------------|---------------------|
| 4.1 | Native mobile apps | iOS/Android apps | React Native or similar; app store presence; push via FCM/APNs |
| 4.2 | In-app chat with agent | Communication during delivery | Chat thread per order; real-time messages; visible to client and agent |
| 4.3 | Advanced campaigns | Marketing and retention | Targeted campaigns; A/B tests; lifecycle messaging |

**Status:**  
- [ ] 4.1 Native apps  
- [ ] 4.2 Agent chat  
- [ ] 4.3 Advanced campaigns  

---

## Implementation Order

| Priority | Phase | Item | Rationale |
|----------|--------|------|------------|
| 1 | 1 | Live tracking map | Core expectation for delivery apps |
| 2 | 1 | Push notifications | High-impact, low-friction alerts |
| 3 | 1 | SMS notifications | Critical in many markets |
| 4 | 1 | Rate limiting | Security and stability |
| 5 | 2 | Business analytics | Value for business users |
| 6 | 2 | Support tickets | Trust and dispute handling |
| 7 | 2 | Real-time updates | Better UX and perceived reliability |
| 8 | 2 | Observability | Operate and improve with data |
| 9+ | 3–4 | Growth and scale | After Phases 1–2 are stable |

---

## Status Tracking

Use the checkboxes in each phase above to track completion. Update this section when major milestones are done.

- **Phase 1 completed:** When all Phase 1 checkboxes are checked.  
- **Phase 2 completed:** When all Phase 2 checkboxes are checked.  
- **Phase 3 / 4:** Same for Phase 3 and Phase 4.

Last updated: (update when you change status)
