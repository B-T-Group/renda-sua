# Order Cancellation with Reasons Feature

## Overview

This feature implements a beautiful, user-friendly order cancellation flow with persona-specific cancellation reasons. When a client or business wants to cancel an order, they are presented with a modal that displays relevant cancellation reasons based on their role, allowing them to select a reason before cancelling.

## 🎯 Key Features

### 1. **Persona-Based Cancellation Reasons**

- **Client Reasons** (11 reasons):

  - Changed my mind
  - Found a better price elsewhere
  - Item no longer needed
  - Ordered by mistake
  - Delivery taking too long
  - Delivery fee too expensive
  - Having payment issues
  - Business not responding
  - Item description was incorrect
  - Concerns about item quality
  - Other reason (shared)

- **Business Reasons** (8 reasons):
  - Item is out of stock
  - Cannot fulfill order
  - Pricing error in listing
  - Business temporarily closed
  - Item damaged or defective
  - Cannot reach customer
  - Delivery area not available
  - Other reason (shared)

### 2. **Beautiful UI/UX**

- **Mobile-Responsive**: Full-screen on mobile, centered dialog on desktop
- **Visual Feedback**:
  - Selected reason is highlighted with primary color
  - Smooth transitions and hover effects
  - Loading states with skeleton loaders
  - Success confirmation with auto-close
- **Order Context**: Shows order number and business name
- **Clear Instructions**: Context-aware descriptions for each persona

### 3. **"Other" Reason Handling**

- When "Other" is selected, a text field appears for custom input
- The reason is sent as `other: ${custom_reason}`
- Submit button is disabled until text is provided

### 4. **Error Handling**

- Loading states for fetching reasons
- Error states with retry options
- Form validation (must select a reason)
- Network error handling with user-friendly messages

## 📁 File Structure

```
apps/frontend/src/
├── hooks/
│   ├── useCancellationReasons.ts     # Hook to fetch cancellation reasons
│   └── index.ts                       # Export hook
├── components/
│   ├── dialogs/
│   │   └── CancellationReasonModal.tsx  # Main cancellation modal component
│   └── orders/
│       ├── ClientActions.tsx          # Updated with cancel modal integration
│       └── BusinessActions.tsx        # Updated with cancel modal integration
└── CANCELLATION_FEATURE.md           # This file
```

## 🔧 Technical Implementation

### Hook: `useCancellationReasons`

```typescript
export const useCancellationReasons = (persona: 'client' | 'business') => {
  // Fetches cancellation reasons from Hasura GraphQL
  // Filters by persona using the persona array column
  // Returns: { reasons, loading, error }
};
```

### Component: `CancellationReasonModal`

```typescript
interface CancellationReasonModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderData;
  persona: 'client' | 'business';
  onSuccess?: () => void;
  onError?: (message: string) => void;
}
```

**Key Features**:

- Fetches reasons on mount based on persona
- Radio button selection with visual feedback
- Expandable text field for "other" reason
- Submits cancellation with reason in `notes` field
- Auto-closes on success with notification

### Integration: `ClientActions` & `BusinessActions`

**Before**:

```typescript
// Client directly called cancelOrder API
const handleCancelOrder = async () => {
  await cancelOrder({ orderId: order.id });
};
```

**After**:

```typescript
// Opens modal for reason selection
const handleCancelClick = () => {
  setCancelModalOpen(true);
};

<CancellationReasonModal
  open={cancelModalOpen}
  onClose={() => setCancelModalOpen(false)}
  order={order}
  persona="client" // or "business"
  onSuccess={handleCancelSuccess}
  onError={handleCancelError}
/>;
```

## 🎨 UX Improvements

### 1. **Visual Hierarchy**

- Warning icon and color scheme to indicate serious action
- Order information displayed prominently
- Clear separation between instructions and action area

### 2. **Progressive Disclosure**

- "Other" text field only appears when selected
- Skeleton loaders during data fetch
- Success state before auto-close

### 3. **Accessibility**

- Keyboard navigation support
- ARIA labels and roles
- Focus management
- Screen reader friendly

### 4. **Mobile Optimization**

- Full-screen on mobile devices
- Touch-friendly button sizes
- Optimized spacing for small screens

## 🔗 API Integration

### GraphQL Query

```graphql
query GetCancellationReasons($persona: String!) {
  order_cancellation_reasons(where: { persona: { _contains: [$persona] } }, order_by: { rank: asc }) {
    id
    value
    display
    rank
    persona
  }
}
```

### Backend API Call

```typescript
await cancelOrder({
  orderId: order.id,
  notes: isOther ? `other: ${customText}` : reasonDisplay,
});
```

## 🚀 Usage Examples

### Client Cancellation

```typescript
// In ClientActions.tsx
<CancellationReasonModal
  open={cancelModalOpen}
  onClose={() => setCancelModalOpen(false)}
  order={order}
  persona="client"
  onSuccess={() => {
    showNotification('Order cancelled successfully', 'success');
    refreshOrder();
  }}
  onError={(error) => {
    showNotification(error, 'error');
  }}
/>
```

### Business Cancellation

```typescript
// In BusinessActions.tsx
<CancellationReasonModal
  open={cancelModalOpen}
  onClose={() => setCancelModalOpen(false)}
  order={order}
  persona="business"
  onSuccess={() => {
    showNotification('Order cancelled successfully', 'success');
    refreshOrder();
  }}
  onError={(error) => {
    showNotification(error, 'error');
  }}
/>
```

## 📊 Database Schema

The cancellation reasons are stored in the `order_cancellation_reasons` table:

```sql
CREATE TABLE order_cancellation_reasons (
  id SERIAL PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  display TEXT NOT NULL,
  rank INTEGER NOT NULL,
  persona TEXT[] NOT NULL,  -- ['client', 'business']
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 🎯 Business Logic

### When to Show Cancel Button

**Client**:

- `pending`: ✅ Can cancel
- `confirmed`: ✅ Can cancel
- `preparing`: ❌ Too late (business has started preparing)
- `ready_for_pickup`: ❌ Too late
- Later stages: ❌ Too late

**Business**:

- `pending`: ✅ Can cancel
- `confirmed`: ✅ Can cancel
- `preparing`: ✅ Can cancel
- `ready_for_pickup`: ❌ Too late (agent involved)
- Later stages: ❌ Too late

### Reason Format in Notes Field

- **Standard Reason**: `"Changed my mind"`
- **Other Reason**: `"other: Customer changed delivery address"`

## 🔮 Future Enhancements

1. **Analytics Dashboard**

   - Track most common cancellation reasons
   - Identify trends by persona, time, business
   - Use insights to improve service

2. **Reason Prompts**

   - Show helpful tips based on selected reason
   - Offer alternatives (e.g., "Would you like to change delivery address instead?")

3. **Multi-Language Support**

   - Translate cancellation reasons
   - Localized instructions

4. **Agent Cancellations**

   - Add agent-specific cancellation reasons
   - Track delivery issues

5. **Cancellation Policies**
   - Define time-based cancellation windows
   - Show cancellation fees if applicable
   - Automated refund calculations

## 📝 Notes

- The "Other" reason (ID: 1) is shared between client and business personas
- Reasons are ordered by `rank` (ascending)
- The modal prevents accidental closures during submission
- Success state auto-closes after 1.5 seconds
- All text uses i18n translation keys for internationalization

## ✅ Testing Checklist

- [ ] Client can see client-specific reasons
- [ ] Business can see business-specific reasons
- [ ] "Other" reason shows text field
- [ ] Cannot submit without selecting reason
- [ ] Cannot submit "Other" without text
- [ ] Success notification shows
- [ ] Error handling works
- [ ] Mobile responsive design works
- [ ] Keyboard navigation works
- [ ] Loading states display correctly
- [ ] Order refreshes after cancellation

---

**Created**: October 2025  
**Last Updated**: October 2025  
**Version**: 1.0
