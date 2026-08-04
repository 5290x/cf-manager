import apiClient from './client';

export const settingsApi = {
  get: () => apiClient.get('/settings'),
  clearCache: () => apiClient.post('/settings/cache/clear'),
  testProxy: (proxyUrl: string) => apiClient.post('/settings/proxy/test', { proxy_url: proxyUrl }),
  saveResin: (cfg: { enabled?: boolean; url?: string; token?: string; platform?: string }) =>
    apiClient.put('/settings/resin', cfg),
  testResin: () => apiClient.post('/settings/resin/test'),
};
