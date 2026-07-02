# Address Deletion Safeguards Implementation Summary

## Overview
Implemented comprehensive address deletion safeguards across backend, web, and mobile applications to enforce the invariant that each active persona (Client, Agent, Business) must retain at least one active address, and primary addresses cannot be deleted without selecting a replacement.

## Backend Changes (NestJS)

### 1. **addresses.service.ts** - Enhanced Deletion Validation
- **deleteAddress()**: Added safeguards to reject deletion when:
  - Address is the only address for the persona (HTTP 409 with code `ADDRESS_MINIMUM_REQUIRED`)
  - Address is the primary address (HTTP 409 with code `ADDRESS_PRIMARY_DELETE_FORBIDDEN`)
  
- **updateAddress()**: Added validation to prevent demoting primary address without a replacement:
  - When `is_primary` is set to `false` on the current primary address, checks if other addresses exist
  - Rejects with HTTP 409 and code `ADDRESS_PRIMARY_REPLACEMENT_REQUIRED` if no alternatives exist

### 2. **addresses.controller.ts** - API Documentation
- Updated `@Delete(':id')` endpoint documentation with new 409 Conflict response schema
- Updated `@Patch(':id')` endpoint documentation with `ADDRESS_PRIMARY_REPLACEMENT_REQUIRED` error code
- Documented all three error codes with clear descriptions

### 3. **business-items.service.ts** - Location Deletion Safeguards
- **deleteBusinessLocation()**: New method implementing equivalent safeguards for business locations:
  - Rejects deletion of the only location (HTTP 409 with code `ADDRESS_MINIMUM_REQUIRED`)
  - Rejects deletion of the primary location (HTTP 409 with code `ADDRESS_PRIMARY_DELETE_FORBIDDEN`)
  - Soft-deletes location by setting `is_active: false`

### 4. **business-items.controller.ts** - Location Deletion Endpoint
- **@Delete('locations/:locationId')**: New guarded endpoint with:
  - Proper access control via `BusinessItemsAccessService`
  - Comprehensive Swagger documentation
  - 409 Conflict response schema matching address deletion errors

## Web Frontend Changes (React + Material-UI)

### 1. **addressDeletionPolicy.ts** - Shared Utility
- `checkAddressDeletionEligibility()`: Validates if an address can be deleted
- `mapAddressErrorCodeToMessage()`: Maps backend error codes to localized messages
- `extractErrorCode()`: Safely extracts error codes from API responses
- Type-safe error handling with proper TypeScript interfaces

### 2. **AddressManager.tsx** - Enhanced Component
- Imported deletion policy utilities
- Updated delete button to:
  - Check eligibility before showing confirmation dialog
  - Display tooltip with reason when deletion is disabled
  - Disable button when address cannot be deleted
- Enhanced error handling to map backend codes to localized messages
- Added `Tooltip` import from Material-UI

### 3. **useAddressManager.ts** - Hook Enhancement
- Updated `AddressDeleteResponse` interface to include optional `code` field
- Preserves backend error codes for client-side error mapping

### 4. **Translation Files** - English & French
- **en.json**: Added `addresses.errors` section with:
  - `minimumRequired`: "Cannot delete the only address..."
  - `primaryDeleteForbidden`: "Cannot delete the primary address..."
  - `primaryReplacementRequired`: "Cannot demote the primary address..."
  - `unknown`: Generic error message

- **fr.json**: Added equivalent French translations

## Mobile Changes (React Native + Expo)

### 1. **apiClient.ts** - Structured Error Handling
- Updated `extractApiErrorBody()` to return object with `message` and `code` fields
- Modified `apiRequest()` to preserve error codes in thrown errors
- Error objects now include `code` and `status` properties for client-side handling

### 2. **addressDeletionPolicy.ts** - Mobile Utility
- Mirrors web implementation with React Native compatibility
- `checkAddressDeletionEligibility()`: Validates address deletion eligibility
- `mapAddressErrorCodeToMessage()`: Maps codes to localized messages
- `extractErrorCode()`: Safely extracts codes from error objects
- Type-safe with proper TypeScript interfaces

### 3. **ProfileScreen.tsx** - Enhanced Address Management
- Imported deletion policy utilities
- Updated `handleDeleteAddress()` to:
  - Check deletion eligibility before showing confirmation
  - Display localized error message if deletion is not allowed
  - Map backend error codes to user-friendly messages
  - Handle both pre-deletion validation and post-deletion API errors

### 4. **Translation Files** - English & French
- **en.json**: Added `addresses.errors` section with same keys as web
- **fr.json**: Added equivalent French translations

## Error Codes & HTTP Status

### HTTP 409 Conflict Responses

| Code | Scenario | Message |
|------|----------|---------|
| `ADDRESS_MINIMUM_REQUIRED` | Only address for persona | "Cannot delete the only address. Each persona must have at least one address." |
| `ADDRESS_PRIMARY_DELETE_FORBIDDEN` | Primary address deletion | "Cannot delete the primary address. Please set another address as primary first." |
| `ADDRESS_PRIMARY_REPLACEMENT_REQUIRED` | Primary demotion without replacement | "Cannot demote the primary address without another address to promote." |

## Validation Flow

### Address Deletion
1. **Frontend Pre-validation** (Web/Mobile):
   - Check if address is only one → disable delete button with tooltip
   - Check if address is primary → disable delete button with tooltip

2. **Backend Validation** (NestJS):
   - Verify address ownership
   - Check if only address → reject with 409
   - Check if primary → reject with 409
   - Soft-delete address (set status to 'deleted')

3. **Error Handling**:
   - Backend returns structured error with `code` field
   - Frontend extracts code and maps to localized message
   - User sees friendly, translated error message

### Primary Address Update
1. **Frontend** (Web/Mobile):
   - Allow unchecking primary only if other addresses exist
   - Show tooltip if cannot demote

2. **Backend**:
   - If setting `is_primary: false` on current primary
   - Check if other addresses exist
   - Reject with 409 if no alternatives

## Testing Checklist

### Backend Tests
- [ ] Only address rejected for each persona (client, agent, business)
- [ ] Primary address rejected when multiple exist
- [ ] Non-primary address deleted successfully
- [ ] Foreign address retains 403 behavior
- [ ] Direct primary demotion rejected; promoting another succeeds
- [ ] Only/primary business location rejected; eligible location deleted

### Web Tests
- [ ] Delete button disabled for only address with tooltip
- [ ] Delete button disabled for primary address with tooltip
- [ ] Backend error codes mapped to localized messages
- [ ] Snackbar displays localized error on API failure
- [ ] Location deletion uses REST endpoint (not direct Hasura)

### Mobile Tests
- [ ] Delete button disabled for only address
- [ ] Delete button disabled for primary address
- [ ] Backend error codes preserved through API client
- [ ] Alert displays localized error message
- [ ] Error codes extracted and mapped correctly

### Manual Verification
- [ ] Test with Client persona (English & French)
- [ ] Test with Agent persona (English & French)
- [ ] Test with Business persona (English & French)
- [ ] Verify persona switching preserves safeguards
- [ ] Verify cross-platform consistency

## Files Modified

### Backend
- `apps/backend/src/addresses/addresses.service.ts`
- `apps/backend/src/addresses/addresses.controller.ts`
- `apps/backend/src/business-items/business-items.service.ts`
- `apps/backend/src/business-items/business-items.controller.ts`

### Web Frontend
- `apps/frontend/src/utils/addressDeletionPolicy.ts` (new)
- `apps/frontend/src/components/common/AddressManager.tsx`
- `apps/frontend/src/hooks/useAddressManager.ts`
- `apps/frontend/public/locales/en.json`
- `apps/frontend/public/locales/fr.json`

### Mobile
- `src/services/apiClient.ts`
- `src/utils/addressDeletionPolicy.ts` (new)
- `src/screens/shared/ProfileScreen.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/fr.json`

## Build Status
- ✅ Backend builds successfully (`nx build backend`)
- ✅ Web frontend linting passes (2 warnings fixed)
- ✅ Mobile TypeScript validation passes for new files

## Notes
- All changes maintain backward compatibility
- No database migrations required
- No changes to public API success responses
- Error codes are stable and documented
- Translations support both English and French
- Cross-platform consistency maintained
