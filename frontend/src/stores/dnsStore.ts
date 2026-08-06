import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dnsApi } from '../api/dns';

export const useDnsStore = defineStore('dns', () => {
  const domains = ref<any[]>([]);
  const records = ref<any[]>([]);
  const currentDomain = ref('');
  const loading = ref(false);
  const zoneSettings = ref<Record<string, any>>({});
  const settingsLoading = ref(false);

  async function fetchDomains() {
    loading.value = true;
    try {
      const { data } = await dnsApi.getDomains();
      domains.value = data;
    } catch {
      domains.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchRecords(domain: string) {
    loading.value = true;
    currentDomain.value = domain;
    try {
      const { data } = await dnsApi.getRecords(domain);
      records.value = data;
    } catch {
      records.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function createDomains(data: { names: string[]; account_id: number; type: 'full' | 'partial' }) {
    const { data: result } = await dnsApi.createDomains(data);
    await fetchDomains();
    return result;
  }

  async function deleteDomains(domains: string[]) {
    const { data: result } = await dnsApi.deleteDomains(domains);
    await fetchDomains();
    return result;
  }

  async function fetchZoneSettings(domain: string) {
    settingsLoading.value = true;
    try {
      const { data } = await dnsApi.getSettings(domain);
      zoneSettings.value = data;
    } catch {
      zoneSettings.value = {};
    } finally {
      settingsLoading.value = false;
    }
  }

  async function updateZoneSettings(domain: string, settings: Record<string, any>) {
    const { data } = await dnsApi.updateSettings(domain, settings);
    return data;
  }

  async function purgeZoneCache(domain: string, options: { purge_everything?: boolean; files?: string[] }) {
    const { data } = await dnsApi.purgeCache(domain, options);
    return data;
  }

  async function updateZoneStatus(domain: string, paused: boolean) {
    await dnsApi.updateStatus(domain, paused);
    // 更新本地域名列表中的状态
    const d = domains.value.find((x: any) => (typeof x === 'string' ? x : x.name) === domain);
    if (d && typeof d === 'object') {
      d.status = paused ? 'paused' : 'active';
    }
  }

  return {
    domains, records, currentDomain, loading,
    zoneSettings, settingsLoading,
    fetchDomains, fetchRecords,
    createDomains, deleteDomains,
    fetchZoneSettings, updateZoneSettings, purgeZoneCache, updateZoneStatus,
  };
});
