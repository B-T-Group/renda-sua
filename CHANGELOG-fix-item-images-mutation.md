# Fix for `insert_item_images` Mutation Error

## Summary

Fixed the `insert_item_images not found in mutation_root` error that occurs when business users with non-business active personas attempt to bulk create images.

## Root Cause

The `BusinessImagesService.bulkCreateBusinessImages` method was using `HasuraUserService.executeMutation`, which requires the authenticated user's JWT to have the `business` role as their active default role. When users authenticate with a different active persona (e.g., `client` or `agent`), the mutation fails with "field 'insert_item_images' not found" because Hasura's RLS prevents non-business roles from accessing the insert mutation.

## Solution

Changed `bulkCreateBusinessImages` to use `HasuraSystemService` instead of `HasuraUserService`. This is safe and follows the existing authorization pattern because:

1. The controller already validates business ownership via `getBusinessIdOrThrow()`
2. This query ensures the authenticated user has a valid business profile
3. The service operation is performed on behalf of that validated business
4. Using system service bypasses the role check since authorization is already complete

## Changes Made

### 1. Fixed Business Images Service
- **File**: `apps/backend/src/business-images/business-images.service.ts`
- Changed `hasuraUserService.executeMutation` to `hasuraSystemService.executeMutation` in the `bulkCreateBusinessImages` method

### 2. Added Diagnostic Endpoint
- **File**: `apps/backend/src/hasura/hasura-diagnostics.controller.ts` (new)
- Created `/diagnostics/hasura/jwt-claims` endpoint to help debug JWT role issues
- Returns user's available personas and current JWT claims
- **File**: `apps/backend/src/hasura/hasura.module.ts`
- Registered the new diagnostics controller

### 3. Documentation
- **File**: `docs/troubleshooting/item-images-mutation-error.md` (new)
- Comprehensive troubleshooting guide for this issue
- Explains root cause, diagnostic steps, and resolution options
- Includes Auth0 JWT configuration requirements

## Testing Recommendations

1. Test bulk image creation with a user whose active persona is NOT `business`
2. Test with a user who has multiple personas (client + business)
3. Verify the diagnostic endpoint returns correct persona information
4. Ensure business ownership validation still works correctly

## Related Issues

This error pattern can occur with any Hasura operation where:
- The controller validates ownership using one persona
- The service attempts a mutation requiring a different persona's role
- The user's JWT doesn't have the required role in `x-hasura-allowed-roles`

## Prevention

- Use `HasuraSystemService` for operations where authorization is done at the controller level
- Use `HasuraUserService` only when relying on Hasura RLS for authorization
- Ensure Auth0 actions properly set JWT roles based on user's persona rows in the database
