<template>
  <div class="page-view">
    <!-- 顶部操作栏 -->
    <n-space justify="space-between" align="center" :wrap="true" style="margin-bottom: 12px">
      <n-h2 style="margin: 0">{{ t('dns.title') }}</n-h2>
      <n-space>
        <n-button size="small" @click="dnsStore.fetchDomains()" :loading="dnsStore.loading">{{ t('common.refresh') }}</n-button>
        <n-button size="small" type="primary" @click="showAddDomainModal = true">{{ t('dns.addDomain') }}</n-button>
      </n-space>
    </n-space>

    <n-space align="center" style="margin-bottom: 12px" :wrap="true">
      <n-select
        v-model:value="selectedAccount"
        :options="accountOptions"
        :placeholder="t('dns.selectAccount')"
        style="width: 200px; max-width: 50vw"
        size="small"
        @update:value="onAccountChange"
      />
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('dns.searchDomain')"
        clearable
        size="small"
        style="width: 200px"
      />
    </n-space>

    <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
      <!-- 左侧域名列表 -->
      <n-gi span="24 m:7">
        <n-card size="small" style="height: 100%">
          <template #header>
            <n-space align="center" justify="space-between" style="width: 100%">
              <span>{{ t('dns.domainList') }}</span>
              <n-text v-if="selectedDomains.size > 0" depth="3" style="font-size: 12px">
                {{ t('dns.selectedCount', { count: selectedDomains.size }) }}
              </n-text>
            </n-space>
          </template>
          <template #header-extra>
            <n-button
              v-if="selectedDomains.size > 0"
              size="tiny"
              type="error"
              @click="handleBatchDelete"
            >
              {{ t('dns.deleteSelected', { count: selectedDomains.size }) }}
            </n-button>
          </template>

          <n-spin :show="dnsStore.loading">
            <!-- 所有账户模式：分组折叠 -->
            <template v-if="selectedAccount === '__all__'">
              <n-collapse v-if="groupedDomains.length > 0" :default-expanded-names="expandedGroups">
                <n-collapse-item
                  v-for="group in groupedDomains"
                  :key="group.accountName"
                  :name="group.accountName"
                >
                  <template #header>
                    <n-space align="center" :size="4">
                      <span>{{ group.accountName }}</span>
                      <n-text depth="3" style="font-size: 12px">({{ group.domains.length }})</n-text>
                    </n-space>
                  </template>
                  <n-list hoverable clickable>
                    <n-list-item
                      v-for="d in group.domains"
                      :key="d.name"
                      @click="selectDomain(d.name)"
                      :style="{ background: dnsStore.currentDomain === d.name ? 'var(--n-color-hover)' : '' }"
                    >
                      <div style="display: flex; align-items: flex-start; gap: 8px; width: 100%">
                        <n-checkbox
                          v-if="!isDemoDomain(d)"
                          :checked="selectedDomains.has(d.name)"
                          @update:checked="(v: boolean) => toggleDomainSelect(d.name, v)"
                          @click.stop
                        />
                        <div style="flex: 1; min-width: 0">
                          <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ d.name }}</div>
                          <n-space align="center" :size="4" style="margin-top: 2px">
                            <span :style="{ color: statusColor(d.status), fontSize: '11px' }">●</span>
                            <n-text depth="3" style="font-size: 11px">{{ statusLabel(d.status) }}</n-text>
                            <n-text depth="3" style="font-size: 11px">· {{ d.accountName }}</n-text>
                          </n-space>
                        </div>
                      </div>
                    </n-list-item>
                  </n-list>
                </n-collapse-item>
              </n-collapse>
            </template>

            <!-- 单账户模式：平铺列表 -->
            <template v-else>
              <n-list v-if="filteredDomains.length > 0" hoverable clickable>
                <n-list-item
                  v-for="d in filteredDomains"
                  :key="d.name"
                  @click="selectDomain(d.name)"
                  :style="{ background: dnsStore.currentDomain === d.name ? 'var(--n-color-hover)' : '' }"
                >
                  <div style="display: flex; align-items: flex-start; gap: 8px; width: 100%">
                    <n-checkbox
                      v-if="!isDemoDomain(d)"
                      :checked="selectedDomains.has(d.name)"
                      @update:checked="(v: boolean) => toggleDomainSelect(d.name, v)"
                      @click.stop
                    />
                    <div style="flex: 1; min-width: 0">
                      <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ d.name }}</div>
                      <n-space align="center" :size="4" style="margin-top: 2px">
                        <span :style="{ color: statusColor(d.status), fontSize: '11px' }">●</span>
                        <n-text depth="3" style="font-size: 11px">{{ statusLabel(d.status) }}</n-text>
                      </n-space>
                    </div>
                  </div>
                </n-list-item>
              </n-list>
            </template>

            <n-empty v-if="!dnsStore.loading && filteredDomains.length === 0" :description="t('dns.noDomain')" style="margin: 20px 0">
              <template #extra>
                <n-button size="small" type="primary" @click="showAddDomainModal = true">{{ t('dns.addDomainBtn') }}</n-button>
              </template>
            </n-empty>
          </n-spin>
        </n-card>
      </n-gi>

      <!-- 右侧详情面板 -->
      <n-gi span="24 m:17">
        <n-card v-if="dnsStore.currentDomain" size="small">
          <template #header>
            <n-space align="center">
              <span>{{ dnsStore.currentDomain }}</span>
              <n-text v-if="currentDomainInfo" depth="3" style="font-size: 12px">· {{ currentDomainInfo.accountName }}</n-text>
            </n-space>
          </template>

          <n-tabs v-model:value="activeTab" type="line" @update:value="onTabChange">
            <!-- Tab 1: DNS 记录 -->
            <n-tab-pane name="records" :tab="t('dns.records')">
              <n-space justify="end" style="margin-bottom: 12px">
                <n-button size="small" type="primary" @click="showAddRecordModal = true">{{ t('dns.addRecord') }}</n-button>
              </n-space>
              <n-data-table
                :columns="recordColumns"
                :data="dnsStore.records"
                :loading="dnsStore.loading"
                size="small"
                :bordered="false"
                :scroll-x="680"
                :pagination="{ pageSize: 20 }"
              />
            </n-tab-pane>

            <!-- Tab 2: Zone 设置 -->
            <n-tab-pane name="settings" :tab="t('dns.zoneSettings')">
              <n-spin :show="dnsStore.settingsLoading">
                <n-form label-placement="left" label-width="140" :disabled="dnsStore.settingsLoading">
                  <n-divider>{{ t('dns.sslTls') }}</n-divider>
                  <n-form-item :label="t('dns.sslMode')">
                    <n-select v-model:value="zoneForm.ssl" :options="sslOptions" />
                  </n-form-item>
                  <n-form-item :label="t('dns.alwaysHttps')">
                    <n-switch v-model:value="zoneForm.always_use_https" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>
                  <n-form-item :label="t('dns.autoHttpsRewrite')">
                    <n-switch v-model:value="zoneForm.automatic_https_rewrites" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>
                  <n-form-item :label="t('dns.securityLevel')">
                    <n-select v-model:value="zoneForm.security_level" :options="securityOptions" />
                  </n-form-item>

                  <n-divider>{{ t('dns.performance') }}</n-divider>
                  <n-form-item :label="t('dns.autoMinify')">
                    <n-space>
                      <n-checkbox v-model:checked="minifyJs">JS</n-checkbox>
                      <n-checkbox v-model:checked="minifyCss">CSS</n-checkbox>
                      <n-checkbox v-model:checked="minifyHtml">HTML</n-checkbox>
                    </n-space>
                  </n-form-item>
                  <n-form-item :label="t('dns.brotli')">
                    <n-switch v-model:value="zoneForm.brotli" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>
                  <n-form-item :label="t('dns.zeroRtt')">
                    <n-switch v-model:value="zoneForm.zero_rtt" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>

                  <n-space justify="end">
                    <n-button type="primary" :loading="savingSettings" @click="handleSaveSettings">{{ t('dns.saveSettings') }}</n-button>
                  </n-space>
                </n-form>
              </n-spin>
            </n-tab-pane>

            <!-- Tab 3: 缓存与状态 -->
            <n-tab-pane name="cache" :tab="t('dns.cacheAndStatus')">
              <n-form label-placement="left" label-width="140">
                <n-divider>{{ t('dns.cacheSettings') }}</n-divider>
                <n-form-item :label="t('dns.cacheLevel')">
                  <n-select v-model:value="zoneForm.cache_level" :options="cacheLevelOptions" />
                </n-form-item>
                <n-form-item :label="t('dns.browserCacheTtl')">
                  <n-select v-model:value="zoneForm.browser_cache_ttl" :options="browserTtlOptions" />
                </n-form-item>
                <n-form-item :label="t('dns.devMode')">
                  <n-switch v-model:value="zoneForm.development_mode" :checked-value="'on'" :unchecked-value="'off'" />
                  <n-text depth="3" style="margin-left: 12px; font-size: 12px">{{ t('dns.devModeHint') }}</n-text>
                </n-form-item>

                <n-divider>{{ t('dns.purgeCache') }}</n-divider>
                <n-form-item :label="t('dns.purgeMethod')">
                  <n-space vertical style="width: 100%">
                    <n-popconfirm @positive-click="handlePurgeAll">
                      <template #trigger>
                        <n-button size="small" type="warning">{{ t('dns.purgeAll') }}</n-button>
                      </template>
                      {{ t('dns.purgeAllConfirm') }}
                    </n-popconfirm>
                    <n-button size="small" @click="showUrlPurge = !showUrlPurge">{{ showUrlPurge ? t('dns.collapse') : t('dns.purgeByUrl') }}</n-button>
                    <template v-if="showUrlPurge">
                      <n-input
                        v-model:value="purgeUrls"
                        type="textarea"
                        :placeholder="t('dns.purgeUrlPlaceholder')"
                        :rows="4"
                      />
                      <n-button size="small" type="primary" :loading="purging" @click="handlePurgeUrls">{{ t('dns.purgeSpecifiedUrl') }}</n-button>
                    </template>
                  </n-space>
                </n-form-item>

                <n-divider>{{ t('dns.zoneStatus') }}</n-divider>
                <n-form-item :label="t('dns.currentStatus')">
                  <n-space align="center">
                    <span :style="{ color: statusColor(currentDomainInfo?.status), fontSize: '14px' }">●</span>
                    <span>{{ statusLabel(currentDomainInfo?.status) }}</span>
                  </n-space>
                </n-form-item>
                <n-form-item label=" ">
                  <n-popconfirm @positive-click="handleToggleZoneStatus">
                    <template #trigger>
                      <n-button
                        size="small"
                        :type="currentDomainInfo?.status === 'paused' ? 'success' : 'error'"
                        :loading="togglingStatus"
                      >
                        {{ currentDomainInfo?.status === 'paused' ? t('dns.activateZone') : t('dns.pauseZone') }}
                      </n-button>
                    </template>
                    <template v-if="currentDomainInfo?.status === 'paused'">
                      {{ t('dns.activateConfirm') }}
                    </template>
                    <template v-else>
                      {{ t('dns.pauseWarning') }}
                    </template>
                  </n-popconfirm>
                </n-form-item>
              </n-form>
            </n-tab-pane>
          </n-tabs>
        </n-card>

        <n-card v-else size="small">
          <n-empty :description="t('dns.selectFromLeft')" style="margin: 40px 0" />
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 添加 DNS 记录 Modal -->
    <n-modal v-model:show="showAddRecordModal" preset="dialog" :title="t('dns.addRecordModalTitle')" style="width: 520px; max-width: 95vw">
      <n-form ref="recordFormRef" :model="newRecord" :rules="recordRules" label-placement="left" label-width="80">
        <n-form-item :label="t('dns.recordType')" path="type">
          <n-select v-model:value="newRecord.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item :label="t('dns.recordName')" path="name">
          <n-input v-model:value="newRecord.name" :placeholder="t('dns.recordNamePlaceholder')" />
        </n-form-item>
        <n-form-item v-if="newRecord.type === 'MX'" :label="t('dns.priority')">
          <n-input-number v-model:value="newRecord.priority" :min="0" :max="65535" />
        </n-form-item>
        <n-form-item :label="t('dns.recordContent')" path="content">
          <n-input v-model:value="newRecord.content" :placeholder="t('dns.recordContentPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('dns.ttl')">
          <n-input-number v-model:value="newRecord.ttl" :min="60" :max="86400" />
        </n-form-item>
        <n-form-item :label="t('dns.proxied')">
          <n-switch v-model:value="newRecord.proxied" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddRecordModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="addingRecord" @click="handleAddRecord">{{ t('common.add') }}</n-button>
      </template>
    </n-modal>

    <!-- 批量添加域名 Modal -->
    <n-modal v-model:show="showAddDomainModal" preset="dialog" :title="t('dns.addDomainModalTitle')" style="width: 520px; max-width: 95vw">
      <n-form :model="newDomain" label-placement="left" label-width="80">
        <n-form-item :label="t('dns.targetAccount')">
          <n-select
            v-model:value="newDomain.account_id"
            :options="availableAccounts"
            :placeholder="t('dns.selectAccount')"
            filterable
          />
        </n-form-item>
        <n-form-item :label="t('dns.zoneType')">
          <n-select v-model:value="newDomain.type" :options="zoneTypeOptions" />
        </n-form-item>
        <n-form-item :label="t('dns.domainListLabel')">
          <n-input
            v-model:value="newDomain.names"
            type="textarea"
            :placeholder="t('dns.domainListPlaceholder')"
            :rows="6"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddDomainModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="creatingDomains" @click="handleCreateDomains">{{ t('common.create') }}</n-button>
      </template>
    </n-modal>

    <!-- 创建结果 Modal -->
    <n-modal v-model:show="showResultModal" preset="dialog" :title="t('dns.resultModalTitle')" style="width: 520px; max-width: 95vw">
      <div v-if="createResult">
        <div v-for="r in createResult.results" :key="r.name" style="margin-bottom: 12px; padding: 8px; border-radius: 4px; background: var(--n-color-modal);">
          <n-space align="center" :size="8">
            <span>{{ r.success ? '✅' : '❌' }}</span>
            <span style="font-weight: 500">{{ r.name }}</span>
          </n-space>
          <div v-if="r.success && r.name_servers?.length" style="margin-top: 4px; padding-left: 24px">
            <n-text depth="3" style="font-size: 12px">NS:</n-text>
            <div v-for="ns in r.name_servers" :key="ns" style="font-size: 12px; font-family: monospace">{{ ns }}</div>
            <n-button size="tiny" @click="copyNS(r.name_servers)">{{ t('dns.copyNs') }}</n-button>
          </div>
          <div v-if="!r.success && r.error" style="margin-top: 4px; padding-left: 24px">
            <n-text type="error" style="font-size: 12px">{{ t('dns.reason') }} {{ r.error }}</n-text>
          </div>
        </div>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">{{ t('dns.resultSummary', { total: createResult.total, succeeded: createResult.succeeded, failed: createResult.failed }) }}</n-text>
      </div>
      <template #action>
        <n-button @click="showResultModal = false">{{ t('common.close') }}</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, onMounted, watch, reactive } from 'vue';
import { NButton, NSwitch, NTag, NText, NCheckbox, useMessage, useDialog } from 'naive-ui';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useDnsStore } from '../stores/dnsStore';
import { dnsApi } from '../api/dns';
import { accountsApi } from '../api/accounts';
import { loadDemoAccounts, isDemoAccount } from '../utils/demoAccounts';

const { t } = useI18n();
const dnsStore = useDnsStore();
const message = useMessage();
const dialog = useDialog();

// ===== 账户过滤 =====
const selectedAccount = ref<string>('');
const searchQuery = ref('');
const accountOptions = ref<{ label: string; value: string }[]>([]);
const availableAccounts = ref<{ label: string; value: number }[]>([]);

const STORAGE_KEY = 'dns_selected_account';
function loadSavedAccount(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function saveAccount(val: string) {
  try { localStorage.setItem(STORAGE_KEY, val); } catch { /* ignore */ }
}

// ===== 域名列表 =====
const selectedDomains = ref<Set<string>>(new Set());
const expandedGroups = ref<string[]>([]);

const allDomains = computed(() =>
  dnsStore.domains.map((d: any) =>
    typeof d === 'string' ? { name: d, status: '', accountName: '', cfAccountId: 0 } : d
  )
);

const filteredDomains = computed(() => {
  let list = allDomains.value;
  // 账户筛选：选中具体账户时按账户名过滤
  if (selectedAccount.value && selectedAccount.value !== '__all__') {
    const opt = accountOptions.value.find(o => o.value === selectedAccount.value);
    if (opt) {
      list = list.filter((d: any) => d.accountName === opt.label);
    }
  }
  // 域名搜索过滤
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((d: any) => d.name?.toLowerCase().includes(q));
  }
  return list;
});

const groupedDomains = computed(() => {
  let list = allDomains.value;
  // 账户筛选：选中具体账户时仅保留该账户的域名
  if (selectedAccount.value && selectedAccount.value !== '__all__') {
    const opt = accountOptions.value.find(o => o.value === selectedAccount.value);
    if (opt) {
      list = list.filter((d: any) => d.accountName === opt.label);
    }
  }
  // 域名搜索过滤
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((d: any) => d.name?.toLowerCase().includes(q));
  }
  const groups: Record<string, any[]> = {};
  for (const d of list) {
    const key = d.accountName || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }
  return Object.entries(groups).map(([accountName, domains]) => ({ accountName, domains }));
});

const currentDomainInfo = computed(() =>
  allDomains.value.find((d: any) => d.name === dnsStore.currentDomain)
);

function isDemoDomain(d: any): boolean {
  return d.cfAccountId ? isDemoAccount(d.cfAccountId) : false;
}

function statusColor(status?: string): string {
  switch (status) {
    case 'active': return 'var(--n-success-color, #18a058)';
    case 'pending': return 'var(--n-warning-color, #f0a020)';
    case 'paused': return 'var(--n-text-color-disabled, #999)';
    case 'moved': return 'var(--n-error-color, #d03050)';
    case 'initializing': return 'var(--n-info-color, #2080f0)';
    default: return 'var(--n-text-color-disabled, #999)';
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'active': return t('dns.statusActive');
    case 'pending': return t('dns.statusPending');
    case 'paused': return t('dns.statusPaused');
    case 'moved': return t('dns.statusMoved');
    case 'initializing': return t('dns.statusInitializing');
    default: return status || t('common.unknown');
  }
}

function toggleDomainSelect(name: string, checked: boolean) {
  if (checked) selectedDomains.value.add(name);
  else selectedDomains.value.delete(name);
  selectedDomains.value = new Set(selectedDomains.value);
}

function selectDomain(domain: string) {
  dnsStore.fetchRecords(domain);
  activeTab.value = 'records';
}

function onAccountChange(val: string) {
  saveAccount(val);
  selectedDomains.value = new Set();
  if (val === '__all__') {
    expandedGroups.value = groupedDomains.value.map(g => g.accountName);
  }
}

// ===== Tab =====
const activeTab = ref('records');

async function onTabChange(tab: string) {
  if (tab === 'settings' && dnsStore.currentDomain) {
    await dnsStore.fetchZoneSettings(dnsStore.currentDomain);
    syncZoneForm();
  }
}

// ===== DNS 记录 =====
const showAddRecordModal = ref(false);
const addingRecord = ref(false);
const recordFormRef = ref<FormInst | null>(null);
const newRecord = ref<any>({ type: 'A', name: '', content: '', ttl: 300, proxied: true, priority: 10 });
const recordRules: FormRules = {
  type: { required: true, message: t('dns.recordTypeRequired'), trigger: 'change' },
  name: { required: true, message: t('dns.recordNameRequired'), trigger: 'blur' },
  content: { required: true, message: t('dns.recordContentRequired'), trigger: 'blur' },
};

const typeOptions = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR'].map(t => ({ label: t, value: t }));

async function handleAddRecord() {
  if (!dnsStore.currentDomain) return;
  try {
    await recordFormRef.value?.validate();
  } catch {
    return;
  }
  addingRecord.value = true;
  try {
    await dnsApi.createRecord(dnsStore.currentDomain, newRecord.value);
    message.success(t('dns.msg.recordAdded'));
    showAddRecordModal.value = false;
    newRecord.value = { type: 'A', name: '', content: '', ttl: 300, proxied: true, priority: 10 };
    dnsStore.fetchRecords(dnsStore.currentDomain);
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.addFailed'));
  } finally {
    addingRecord.value = false;
  }
}

async function handleDeleteRecord(row: any) {
  if (!dnsStore.currentDomain) return;
  try {
    await dnsApi.deleteRecord(dnsStore.currentDomain, row.id);
    message.success(t('dns.msg.recordDeleted'));
    dnsStore.fetchRecords(dnsStore.currentDomain);
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.deleteFailed'));
  }
}

async function handleProxyToggle(row: any, proxied: boolean) {
  if (!dnsStore.currentDomain) return;
  try {
    await dnsApi.updateProxy(dnsStore.currentDomain, row.id, proxied);
    row.proxied = proxied;
    message.success(t('dns.msg.proxyUpdated'));
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.updateFailed'));
  }
}

const currentDomainIsDemo = computed(() => {
  const d = currentDomainInfo.value;
  return d ? isDemoDomain(d) : false;
});

const recordColumns: DataTableColumns<any> = [
  { title: t('dns.recordType'), key: 'type', width: 80, render: (row) => h(NTag, { size: 'small', type: 'info' }, { default: () => row.type }) },
  { title: t('dns.recordName'), key: 'name', width: 180, ellipsis: { tooltip: true } },
  { title: t('dns.recordContent'), key: 'content', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('dns.ttl'), key: 'ttl', width: 80, render: (row) => row.ttl === 1 ? t('dns.ttlAuto') : String(row.ttl) },
  {
    title: t('dns.proxied'), key: 'proxied', width: 80,
    render: (row) => h(NSwitch, { value: row.proxied, onUpdateValue: (v: boolean) => handleProxyToggle(row, v), size: 'small' }),
  },
  {
    title: t('common.actions'), key: 'actions', width: 120,
    render: (row) => currentDomainIsDemo.value ? null : h('div', { style: 'display: flex; gap: 4px' }, [
      h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleEditRecord(row) }, { default: () => t('common.edit') }),
      h(NButton, {
        size: 'tiny', type: 'error', quaternary: true,
        onClick: () => {
          dialog.warning({
            title: t('dns.msg.deleteConfirm'),
            content: t('dns.msg.deleteRecordConfirm', { type: row.type, name: row.name, content: row.content }),
            positiveText: t('common.delete'),
            negativeText: t('common.cancel'),
            onPositiveClick: () => handleDeleteRecord(row),
          });
        }
      }, { default: () => t('common.delete') }),
    ]),
  },
];

function handleEditRecord(row: any) {
  newRecord.value = { ...row, priority: row.priority || 10 };
  showAddRecordModal.value = true;
}

// ===== Zone 设置 =====
const savingSettings = ref(false);
const zoneForm = reactive<Record<string, any>>({});
const minifyJs = ref(false);
const minifyCss = ref(false);
const minifyHtml = ref(false);

const sslOptions = [
  { label: 'Off', value: 'off' },
  { label: 'Flexible', value: 'flexible' },
  { label: 'Full', value: 'full' },
  { label: 'Full (Strict)', value: 'full_strict' },
];
const securityOptions = [
  { label: 'Off', value: 'off' },
  { label: 'Essentially Off', value: 'essentially_off' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Under Attack', value: 'under_attack' },
];
const cacheLevelOptions = [
  { label: 'Off', value: 'off' },
  { label: 'Simplify', value: 'simplify' },
  { label: 'Aggressive', value: 'aggressive' },
];
const browserTtlOptions = [
  { label: 'Respect Existing', value: 0 },
  { label: '30s', value: 30 }, { label: '1m', value: 60 }, { label: '5m', value: 300 },
  { label: '20m', value: 1200 }, { label: '30m', value: 1800 }, { label: '1h', value: 3600 },
  { label: '2h', value: 7200 }, { label: '3h', value: 10800 }, { label: '4h', value: 14400 },
  { label: '8h', value: 28800 }, { label: '12h', value: 43200 }, { label: '16h', value: 57600 },
  { label: '1d', value: 86400 },
];

function syncZoneForm() {
  const s = dnsStore.zoneSettings;
  zoneForm.ssl = s.ssl || 'full_strict';
  zoneForm.always_use_https = s.always_use_https || 'on';
  zoneForm.automatic_https_rewrites = s.automatic_https_rewrites || 'on';
  zoneForm.security_level = s.security_level || 'medium';
  zoneForm.cache_level = s.cache_level || 'aggressive';
  zoneForm.browser_cache_ttl = s.browser_cache_ttl ?? 14400;
  zoneForm.development_mode = s.development_mode || 'off';
  zoneForm.brotli = s.brotli || 'on';
  zoneForm.zero_rtt = s.zero_rtt || 'on';
  minifyJs.value = s.minify?.js ?? true;
  minifyCss.value = s.minify?.css ?? true;
  minifyHtml.value = s.minify?.html ?? false;
}

async function handleSaveSettings() {
  if (!dnsStore.currentDomain) return;
  savingSettings.value = true;
  try {
    const settings: Record<string, any> = {
      ssl: zoneForm.ssl,
      always_use_https: zoneForm.always_use_https,
      automatic_https_rewrites: zoneForm.automatic_https_rewrites,
      security_level: zoneForm.security_level,
      cache_level: zoneForm.cache_level,
      browser_cache_ttl: zoneForm.browser_cache_ttl,
      development_mode: zoneForm.development_mode,
      brotli: zoneForm.brotli,
      zero_rtt: zoneForm.zero_rtt,
      minify: { js: minifyJs.value, css: minifyCss.value, html: minifyHtml.value },
    };
    const result = await dnsStore.updateZoneSettings(dnsStore.currentDomain, settings);
    if (result.failed?.length) {
      message.warning(t('dns.msg.settingsPartialFail', { failed: result.failed.join(', ') }));
    } else {
      message.success(t('dns.msg.settingsUpdated'));
    }
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.saveFailed'));
  } finally {
    savingSettings.value = false;
  }
}

// ===== 缓存清除 =====
const showUrlPurge = ref(false);
const purgeUrls = ref('');
const purging = ref(false);

async function handlePurgeAll() {
  if (!dnsStore.currentDomain) return;
  purging.value = true;
  try {
    await dnsStore.purgeZoneCache(dnsStore.currentDomain, { purge_everything: true });
    message.success(t('dns.msg.cachePurged'));
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.purgeFailed'));
  } finally {
    purging.value = false;
  }
}

async function handlePurgeUrls() {
  if (!dnsStore.currentDomain) return;
  const files = purgeUrls.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!files.length) {
    message.warning(t('dns.msg.urlRequired'));
    return;
  }
  purging.value = true;
  try {
    await dnsStore.purgeZoneCache(dnsStore.currentDomain, { files });
    message.success(t('dns.msg.urlPurged', { count: files.length }));
    purgeUrls.value = '';
    showUrlPurge.value = false;
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.purgeFailed'));
  } finally {
    purging.value = false;
  }
}

// ===== Zone 状态 =====
const togglingStatus = ref(false);

async function handleToggleZoneStatus() {
  if (!dnsStore.currentDomain || !currentDomainInfo.value) return;
  const isPaused = currentDomainInfo.value.status === 'paused';
  togglingStatus.value = true;
  try {
    await dnsStore.updateZoneStatus(dnsStore.currentDomain, !isPaused);
    message.success(!isPaused ? t('dns.msg.zonePaused') : t('dns.msg.zoneActivated'));
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.operationFailed'));
  } finally {
    togglingStatus.value = false;
  }
}

// ===== 批量添加域名 =====
const showAddDomainModal = ref(false);
const creatingDomains = ref(false);
const newDomain = ref<{ account_id: number | null; type: 'full' | 'partial'; names: string }>({ account_id: null, type: 'full', names: '' });
const showResultModal = ref(false);
const createResult = ref<any>(null);
const zoneTypeOptions = computed(() => [
  { label: t('dns.zoneTypeFull'), value: 'full' },
  { label: t('dns.zoneTypePartial'), value: 'partial' },
]);

async function handleCreateDomains() {
  if (!newDomain.value.account_id) {
    message.warning(t('dns.msg.accountRequired'));
    return;
  }
  const names = newDomain.value.names.split('\n').map(s => s.trim()).filter(Boolean);
  if (!names.length) {
    message.warning(t('dns.msg.domainRequired'));
    return;
  }
  const uniqueNames = [...new Set(names)];
  creatingDomains.value = true;
  try {
    const result = await dnsStore.createDomains({
      names: uniqueNames,
      account_id: newDomain.value.account_id,
      type: newDomain.value.type,
    });
    createResult.value = result;
    showResultModal.value = true;
    showAddDomainModal.value = false;
    newDomain.value = { account_id: null, type: 'full', names: '' };
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || t('dns.msg.createFailed'));
  } finally {
    creatingDomains.value = false;
  }
}

function copyNS(ns: string[]) {
  navigator.clipboard.writeText(ns.join('\n')).then(() => {
    message.success(t('dns.msg.nsCopied'));
  }).catch(() => {
    message.error(t('dns.msg.copyFailed'));
  });
}

// ===== 批量删除域名 =====
function handleBatchDelete() {
  const domains = Array.from(selectedDomains.value);
  if (!domains.length) return;
  dialog.warning({
    title: t('dns.msg.batchDeleteTitle'),
    content: t('dns.msg.batchDeleteConfirm', { count: domains.length }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const result = await dnsStore.deleteDomains(domains);
        message.success(t('dns.msg.batchDeleteComplete', { succeeded: result.succeeded, failed: result.failed }));
        selectedDomains.value = new Set();
      } catch (err: any) {
        message.error(err?.response?.data?.error?.message || t('dns.msg.deleteFailed'));
      }
    },
  });
}

// ===== 加载账户列表 =====
async function loadAccounts() {
  try {
    const { data } = await accountsApi.getAll();
    const accounts = data?.accounts || [];
    accountOptions.value = [
      { label: t('dns.allAccounts'), value: '__all__' },
      ...accounts.map((a: any) => ({ label: a.name, value: String(a.id) })),
    ];
    availableAccounts.value = accounts
      .filter((a: any) => a.account_id)
      .map((a: any) => ({ label: a.name, value: a.id }));
  } catch {
    accountOptions.value = [{ label: t('dns.allAccounts'), value: '__all__' }];
  }
}

// ===== 搜索时自动展开分组 =====
watch(searchQuery, (val) => {
  if (val && selectedAccount.value === '__all__') {
    expandedGroups.value = groupedDomains.value.map(g => g.accountName);
  }
});

// ===== 初始化 =====
onMounted(async () => {
  loadDemoAccounts();
  await loadAccounts();
  await dnsStore.fetchDomains();

  const saved = loadSavedAccount();
  if (saved && accountOptions.value.some(o => o.value === saved)) {
    selectedAccount.value = saved;
  } else if (accountOptions.value.length > 1) {
    selectedAccount.value = accountOptions.value[1].value;
  } else {
    selectedAccount.value = '__all__';
  }

  expandedGroups.value = groupedDomains.value.map(g => g.accountName);
});
</script>

<style scoped>
</style>
