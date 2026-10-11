import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from './apiClient';
import {
  checkRestockAlertsEnabled,
  getRestockPreferences,
  patchRestockPreferences,
  setItemAlert,
  getLikesWithAlerts,
} from './restockAlertsApi';

vi.mock('./apiClient');

describe('restockAlertsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRestockAlertsEnabled', () => {
    it('should return enabled status', async () => {
      const mockResponse = { success: true, data: { enabled: true } };
      vi.spyOn(apiClient.api, 'get').mockResolvedValue(mockResponse);

      const result = await checkRestockAlertsEnabled();

      expect(result).toBe(true);
      expect(apiClient.api.get).toHaveBeenCalledWith('/restock-alerts/status');
    });

    it('should return false when disabled', async () => {
      const mockResponse = { success: true, data: { enabled: false } };
      vi.spyOn(apiClient.api, 'get').mockResolvedValue(mockResponse);

      const result = await checkRestockAlertsEnabled();

      expect(result).toBe(false);
    });
  });

  describe('getRestockPreferences', () => {
    it('should fetch preferences', async () => {
      const mockPrefs = { push: true, whatsapp: false, sms: false };
      const mockResponse = { success: true, data: mockPrefs };
      vi.spyOn(apiClient.api, 'get').mockResolvedValue(mockResponse);

      const result = await getRestockPreferences();

      expect(result).toEqual(mockPrefs);
      expect(apiClient.api.get).toHaveBeenCalledWith('/restock-alerts/preferences');
    });
  });

  describe('patchRestockPreferences', () => {
    it('should update preferences', async () => {
      const patch = { whatsapp: true };
      const mockUpdated = { push: true, whatsapp: true, sms: false };
      const mockResponse = { success: true, data: mockUpdated };
      vi.spyOn(apiClient.api, 'patch').mockResolvedValue(mockResponse);

      const result = await patchRestockPreferences(patch);

      expect(result).toEqual(mockUpdated);
      expect(apiClient.api.patch).toHaveBeenCalledWith(
        '/restock-alerts/preferences',
        patch
      );
    });
  });

  describe('setItemAlert', () => {
    it('should enable alert for item', async () => {
      const itemId = 'item-123';
      const mockResponse = { success: true, data: { enabled: true } };
      vi.spyOn(apiClient.api, 'put').mockResolvedValue(mockResponse);

      const result = await setItemAlert(itemId, true);

      expect(result).toEqual({ enabled: true });
      expect(apiClient.api.put).toHaveBeenCalledWith(
        `/restock-alerts/items/${itemId}`,
        { enabled: true }
      );
    });

    it('should disable alert for item', async () => {
      const itemId = 'item-456';
      const mockResponse = { success: true, data: { enabled: false } };
      vi.spyOn(apiClient.api, 'put').mockResolvedValue(mockResponse);

      const result = await setItemAlert(itemId, false);

      expect(result).toEqual({ enabled: false });
      expect(apiClient.api.put).toHaveBeenCalledWith(
        `/restock-alerts/items/${itemId}`,
        { enabled: false }
      );
    });
  });

  describe('getLikesWithAlerts', () => {
    it('should fetch all likes with default params', async () => {
      const mockData = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
      };
      const mockResponse = { success: true, data: mockData };
      vi.spyOn(apiClient.api, 'get').mockResolvedValue(mockResponse);

      const result = await getLikesWithAlerts();

      expect(result).toEqual(mockData);
      expect(apiClient.api.get).toHaveBeenCalledWith(
        '/restock-alerts/likes?filter=all&page=1&limit=20'
      );
    });

    it('should fetch back_in_stock likes with custom pagination', async () => {
      const mockData = {
        items: [],
        total: 5,
        page: 2,
        limit: 10,
        total_pages: 1,
      };
      const mockResponse = { success: true, data: mockData };
      vi.spyOn(apiClient.api, 'get').mockResolvedValue(mockResponse);

      const result = await getLikesWithAlerts('back_in_stock', 2, 10);

      expect(result).toEqual(mockData);
      expect(apiClient.api.get).toHaveBeenCalledWith(
        '/restock-alerts/likes?filter=back_in_stock&page=2&limit=10'
      );
    });
  });
});
