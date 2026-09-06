import { api } from './apiClient';

export const merchantEngagementApi = {
  getTipsReminders: () =>
    api.get<{ success: boolean; data: { tips_reminders_enabled: boolean } }>(
      '/business/engagement/tips-reminders'
    ),
  setTipsReminders: (tips_reminders_enabled: boolean) =>
    api.patch<{ success: boolean; data: { tips_reminders_enabled: boolean } }>(
      '/business/engagement/tips-reminders',
      { tips_reminders_enabled }
    ),
};
