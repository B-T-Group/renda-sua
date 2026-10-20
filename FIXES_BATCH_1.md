# Comprehensive Fixes Batch 1

## Files to modify:
1. apps/mobile/src/navigation/types.ts - Add AgentRootStackParamList export
2. apps/mobile/src/i18n/locales/en.json - Add missing keys
3. apps/mobile/src/i18n/locales/fr.json - Add missing keys
4. apps/mobile/src/screens/agent/DedicatedOpportunityDetailScreen.tsx - Fix apply flow, refetch, source param
5. apps/mobile/src/screens/agent/DedicatedHubScreen.tsx - Fix is_internal, remove commercial_focus/no_agent
6. apps/mobile/src/utils/dedicatedAgentsAnalytics.ts - Fix opportunity_opened to send source
7. apps/mobile/src/hooks/useProfilePhotoUpload.ts - Better error handling
8. apps/mobile/src/services/profilePhotoApi.ts - Map errors correctly
9. apps/mobile/src/utils/dedicatedAgentsErrors.ts - Remove commercial_focus/no_agent

## Changes needed per file documented below
