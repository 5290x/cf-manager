import apiClient from './client';

export type RenderMode = 'screenshot' | 'content' | 'markdown' | 'pdf' | 'links';
export type BrowserEngine = 'chrome' | 'kitesurf';

export const browserRenderApi = {
  render: (url: string, mode: RenderMode = 'screenshot', accountId?: number, browser: BrowserEngine = 'chrome') =>
    apiClient.post('/browser-render', { url, mode, accountId, browser }),
  getQuota: () => apiClient.get('/quota'),
};
