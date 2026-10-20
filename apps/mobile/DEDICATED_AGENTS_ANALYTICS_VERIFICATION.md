# Dedicated Agents Analytics Event Verification

**Registry Source**: `apps/backend/src/site-events/site-event-types.ts` (PR #647 @ 5671a1fd)  
**Verified**: 2026-10-20

## ✅ All Mobile Events Match Backend Registry

Every `dedicated_ui.*` event sent by the mobile app matches the backend registry exactly.

### Agent Events (from #645)

| Mobile Function | Event Name | Registry Match |
|----------------|------------|----------------|
| `trackDedicatedOpportunitiesViewed()` | `dedicated_ui.opportunities_viewed` | ✅ Line 29 |
| `trackDedicatedOpportunityOpened()` | `dedicated_ui.opportunity_opened` | ✅ Line 30 |
| `trackDedicatedApplyTapped()` | `dedicated_ui.apply_tapped` | ✅ Line 31 |
| `trackDedicatedApplySucceeded()` | `dedicated_ui.apply_succeeded` | ✅ Line 32 |
| `trackDedicatedPhotoGateShown()` | `dedicated_ui.photo_gate_shown` | ✅ Line 33 |
| `trackDedicatedPhotoGateCameraOpened()` | `dedicated_ui.photo_gate_camera_opened` | ✅ Line 34 |
| `trackDedicatedPhotoGateGalleryOpened()` | `dedicated_ui.photo_gate_gallery_opened` | ✅ Line 35 |
| `trackDedicatedPhotoGateCompleted()` | `dedicated_ui.photo_gate_completed` | ✅ Line 36 |
| `trackDedicatedApplicationWithdrawn()` | `dedicated_ui.application_withdrawn` | ✅ Line 37 |
| `trackDedicatedMyStoresViewed()` | `dedicated_ui.my_stores_viewed` | ✅ Line 38 |
| `trackDedicatedOffTodayToggled()` | `dedicated_ui.off_today_toggled` | ✅ Line 39 |
| `trackDedicatedAgentGateShown()` | `dedicated_ui.agent_gate_shown` | ✅ Line 40 |
| `trackDedicatedAgentGateDismissed()` | `dedicated_ui.agent_gate_dismissed` | ✅ Line 41 |

### Shared Events (used by Agent flows)

| Mobile Function | Event Name | Registry Match |
|----------------|------------|----------------|
| `trackDedicatedActionConflict()` | `dedicated_ui.action_conflict` | ✅ Line 14 |

## ❌ Not Sent (Not in Registry)

The following events mentioned by the user are **NOT** in the backend registry and are **NOT** sent by the mobile app:

- `agent_gate_cta_tapped` - Not in registry, not in mobile code
- `photo_gate_cancelled` - Not in registry, not in mobile code

## Implementation Files

- **Analytics Module**: `apps/mobile/src/utils/dedicatedAgentsAnalytics.ts`
- **Hub Screen**: `apps/mobile/src/screens/agent/DedicatedHubScreen.tsx`
- **Detail Screen**: `apps/mobile/src/screens/agent/DedicatedOpportunityDetailScreen.tsx`

## Backend Registry Reference

```typescript
// apps/backend/src/site-events/site-event-types.ts
export const DEDICATED_UI_SITE_EVENT_TYPES = [
  // Shared
  'dedicated_ui.section_viewed',
  'dedicated_ui.agent_paused',
  'dedicated_ui.agent_resumed',
  'dedicated_ui.agent_removed',
  'dedicated_ui.action_conflict',  // ✅ Used
  // Admin assign flow
  'dedicated_ui.admin_assign_started',
  'dedicated_ui.admin_assign_step',
  'dedicated_ui.admin_assign_succeeded',
  'dedicated_ui.admin_assign_failed',
  // Business
  'dedicated_ui.slot_toggled',
  'dedicated_ui.pickup_time_changed',
  'dedicated_ui.posting_form_opened',
  'dedicated_ui.posting_created',
  'dedicated_ui.posting_closed',
  'dedicated_ui.posting_terms_edited',
  'dedicated_ui.applicants_viewed',
  'dedicated_ui.applicant_accepted',
  'dedicated_ui.applicant_declined',
  // Agent ✅ All used
  'dedicated_ui.opportunities_viewed',
  'dedicated_ui.opportunity_opened',
  'dedicated_ui.apply_tapped',
  'dedicated_ui.apply_succeeded',
  'dedicated_ui.photo_gate_shown',
  'dedicated_ui.photo_gate_camera_opened',
  'dedicated_ui.photo_gate_gallery_opened',
  'dedicated_ui.photo_gate_completed',
  'dedicated_ui.application_withdrawn',
  'dedicated_ui.my_stores_viewed',
  'dedicated_ui.off_today_toggled',
  'dedicated_ui.agent_gate_shown',
  'dedicated_ui.agent_gate_dismissed',
] as const;
```

## Verification Status

✅ **All mobile dedicated agent events match the backend registry exactly**  
✅ **No non-registry events are being sent**  
✅ **No changes required**
