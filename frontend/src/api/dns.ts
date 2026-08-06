import apiClient from './client';

export const dnsApi = {
  // 现有方法
  getDomains: () => apiClient.get('/dns/domains'),
  getRecords: (domain: string) => apiClient.get(`/dns/domains/${domain}/records`),
  createRecord: (domain: string, data: any) => apiClient.post(`/dns/domains/${domain}/records`, data),
  updateRecord: (domain: string, id: string, data: any) => apiClient.put(`/dns/domains/${domain}/records/${id}`, data),
  deleteRecord: (domain: string, id: string) => apiClient.delete(`/dns/domains/${domain}/records/${id}`),
  getSettings: (domain: string) => apiClient.get(`/dns/domains/${domain}/settings`),
  updateProxy: (domain: string, recordId: string, proxied: boolean) => apiClient.patch(`/dns/domains/${domain}/proxy`, { record_id: recordId, proxied }),

  // Zone 管理
  createDomains: (data: { names: string[]; account_id: number; type: 'full' | 'partial' }) =>
    apiClient.post('/dns/domains', data),
  deleteDomains: (domains: string[]) =>
    apiClient.delete('/dns/domains', { data: { domains } }),
  updateSettings: (domain: string, settings: Record<string, any>) =>
    apiClient.patch(`/dns/domains/${domain}/settings`, settings),
  purgeCache: (domain: string, data: { purge_everything?: boolean; files?: string[] }) =>
    apiClient.post(`/dns/domains/${domain}/purge-cache`, data),
  updateStatus: (domain: string, paused: boolean) =>
    apiClient.patch(`/dns/domains/${domain}/status`, { paused }),
};
