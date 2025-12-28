import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWebhook, executeNotification } from './actions';

describe('ActionExecutor', () => {
  describe('executeWebhook', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should successfully execute a webhook', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const details = {
        url: 'https://example.com/webhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test' }),
      };

      const result = await executeWebhook(details);
      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://example.com/webhook', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test' }),
      }));
    });

    it('should handle webhook failure', async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        status: 404,
      });

      const details = { url: 'https://example.com/404' };
      const result = await executeWebhook(details);
      expect(result.success).toBe(false);
      expect(result.message).toContain('404');
    });

    it('should handle fetch exception', async () => {
      (fetch as any).mockRejectedValue(new Error('Network Error'));

      const details = { url: 'https://example.com/error' };
      const result = await executeWebhook(details);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network Error');
    });
  });

  describe('executeNotification', () => {
    const setupNotificationMock = (permission: NotificationPermission = 'granted') => {
      const MockNotification = vi.fn().mockImplementation(function(title, options) {
        return { title, options };
      });
      (MockNotification as any).permission = permission;
      (MockNotification as any).requestPermission = vi.fn().mockResolvedValue(permission);
      vi.stubGlobal('Notification', MockNotification);
      return MockNotification;
    };

    it('should fail if Notifications are not supported', async () => {
      vi.stubGlobal('Notification', undefined);
      
      const details = { title: 'Test' };
      const result = await executeNotification(details);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
    });

    it('should handle notification exception', async () => {
      const MockNotification = vi.fn().mockImplementation(function() {
        throw new Error('Notification Error');
      });
      (MockNotification as any).permission = 'granted';
      (MockNotification as any).requestPermission = vi.fn().mockResolvedValue('granted');
      vi.stubGlobal('Notification', MockNotification);

      const details = { title: 'Test' };
      const result = await executeNotification(details);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Notification Error');
    });

    it('should show a notification if permission is granted', async () => {
      const MockNotification = setupNotificationMock('granted');
      const details = { title: 'Test Notification', body: 'Hello World' };
      const result = await executeNotification(details);
      
      expect(result.success).toBe(true);
      expect(MockNotification).toHaveBeenCalledWith('Test Notification', expect.objectContaining({
        body: 'Hello World',
      }));
    });

    it('should fail if notification permission is denied', async () => {
      setupNotificationMock('denied');
      const details = { title: 'Test' };
      const result = await executeNotification(details);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('denied');
    });
  });
});