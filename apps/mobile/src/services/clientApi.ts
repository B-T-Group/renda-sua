/**
 * REST API calls for the client persona.
 */

import { api } from './apiClient';
import type { ActionsNeededDto } from '../types/actions';

export const clientApi = {
  dashboard: {
    getActions: (): Promise<{ success: boolean; data: ActionsNeededDto }> =>
      api.get<{ success: boolean; data: ActionsNeededDto }>('/dashboard/actions'),
  },
};
