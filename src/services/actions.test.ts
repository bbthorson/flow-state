import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeWebhook, executeNotification, templateTrusted } from './actions';

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
});describe('templateTrusted', () => {
  it('resolves secrets', () => {
    expect(templateTrusted('https://x.test/{{secrets.token}}', { secrets: { token: 'abc' } })).toEqual({
      ok: true,
      value: 'https://x.test/abc',
    });
  });

  it('refuses trigger data', () => {
    expect(templateTrusted('https://{{host}}/hook', { host: 'evil.test' })).toEqual({
      ok: false,
      placeholder: 'host',
    });
  });
});

describe('executeWebhook — trusted templating', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not let trigger data choose the URL', async () => {
    const result = await executeWebhook({ url: 'https://{{host}}/hook' }, { host: 'evil.test' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/URL can't use \{\{host\}\}/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let trigger data into headers', async () => {
    const result = await executeWebhook(
      { url: 'https://ok.test', headers: { Authorization: 'Bearer {{token}}' } },
      { token: 'attacker' },
    );
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('templates headers per value, so quotes in data cannot break out', async () => {
    await executeWebhook(
      { url: 'https://ok.test/{{secrets.path}}', headers: { 'X-Key': '{{secrets.key}}' }, body: '{"level":"{{level}}"}' },
      { level: '0.2', secrets: { path: 'p', key: 'k"v' } },
    );
    expect(fetchMock).toHaveBeenCalledWith('https://ok.test/p', {
      method: 'POST',
      headers: { 'X-Key': 'k"v' },
      body: '{"level":"0.2"}',
    });
  });
});
