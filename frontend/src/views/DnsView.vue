<template>
  <div class="page-view">
    <!-- 顶部操作栏 -->
    <n-space justify="space-between" align="center" :wrap="true" style="margin-bottom: 12px">
      <n-h2 style="margin: 0">DNS 管理</n-h2>
      <n-space>
        <n-button size="small" @click="dnsStore.fetchDomains()" :loading="dnsStore.loading">刷新</n-button>
        <n-button size="small" type="primary" @click="showAddDomainModal = true">+ 添加域名</n-button>
      </n-space>
    </n-space>

    <n-space align="center" style="margin-bottom: 12px" :wrap="true">
      <n-select
        v-model:value="selectedAccount"
        :options="accountOptions"
        placeholder="选择账户"
        style="width: 200px; max-width: 50vw"
        size="small"
        @update:value="onAccountChange"
      />
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索域名..."
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
              <span>域名列表</span>
              <n-text v-if="selectedDomains.size > 0" depth="3" style="font-size: 12px">
                已选 {{ selectedDomains.size }}
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
              删除选中 ({{ selectedDomains.size }})
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

            <n-empty v-if="!dnsStore.loading && filteredDomains.length === 0" description="暂无域名" style="margin: 20px 0">
              <template #extra>
                <n-button size="small" type="primary" @click="showAddDomainModal = true">添加域名</n-button>
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
            <n-tab-pane name="records" tab="DNS 记录">
              <n-space justify="end" style="margin-bottom: 12px">
                <n-button size="small" type="primary" @click="showAddRecordModal = true">添加记录</n-button>
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
            <n-tab-pane name="settings" tab="Zone 设置">
              <n-spin :show="dnsStore.settingsLoading">
                <n-form label-placement="left" label-width="140" :disabled="dnsStore.settingsLoading">
                  <n-divider>SSL/TLS</n-divider>
                  <n-form-item label="SSL/TLS 模式">
                    <n-select v-model:value="zoneForm.ssl" :options="sslOptions" />
                  </n-form-item>
                  <n-form-item label="Always HTTPS">
                    <n-switch v-model:value="zoneForm.always_use_https" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>
                  <n-form-item label="自动 HTTPS 重写">
                    <n-switch v-model:value="zoneForm.automatic_https_rewrites" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>
                  <n-form-item label="安全等级">
                    <n-select v-model:value="zoneForm.security_level" :options="securityOptions" />
                  </n-form-item>

                  <n-divider>性能</n-divider>
                  <n-form-item label="Auto Minify">
                    <n-space>
                      <n-checkbox v-model:checked="minifyJs">JS</n-checkbox>
                      <n-checkbox v-model:checked="minifyCss">CSS</n-checkbox>
                      <n-checkbox v-model:checked="minifyHtml">HTML</n-checkbox>
                    </n-space>
                  </n-form-item>
                  <n-form-item label="Brotli 压缩">
                    <n-switch v-model:value="zoneForm.brotli" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>
                  <n-form-item label="0-RTT">
                    <n-switch v-model:value="zoneForm.zero_rtt" :checked-value="'on'" :unchecked-value="'off'" />
                  </n-form-item>

                  <n-space justify="end">
                    <n-button type="primary" :loading="savingSettings" @click="handleSaveSettings">保存设置</n-button>
                  </n-space>
                </n-form>
              </n-spin>
            </n-tab-pane>

            <!-- Tab 3: 缓存与状态 -->
            <n-tab-pane name="cache" tab="缓存与状态">
              <n-form label-placement="left" label-width="140">
                <n-divider>缓存设置</n-divider>
                <n-form-item label="缓存级别">
                  <n-select v-model:value="zoneForm.cache_level" :options="cacheLevelOptions" />
                </n-form-item>
                <n-form-item label="浏览器缓存 TTL">
                  <n-select v-model:value="zoneForm.browser_cache_ttl" :options="browserTtlOptions" />
                </n-form-item>
                <n-form-item label="开发模式">
                  <n-switch v-model:value="zoneForm.development_mode" :checked-value="'on'" :unchecked-value="'off'" />
                  <n-text depth="3" style="margin-left: 12px; font-size: 12px">开启后 3 小时后自动关闭</n-text>
                </n-form-item>

                <n-divider>清除缓存</n-divider>
                <n-form-item label="清除方式">
                  <n-space vertical style="width: 100%">
                    <n-popconfirm @positive-click="handlePurgeAll">
                      <template #trigger>
                        <n-button size="small" type="warning">清除全部缓存</n-button>
                      </template>
                      确定清除该 Zone 的所有缓存？
                    </n-popconfirm>
                    <n-button size="small" @click="showUrlPurge = !showUrlPurge">{{ showUrlPurge ? '收起' : '按 URL 清除' }}</n-button>
                    <template v-if="showUrlPurge">
                      <n-input
                        v-model:value="purgeUrls"
                        type="textarea"
                        placeholder="每行一个 URL，如：https://example.com/css/app.css"
                        :rows="4"
                      />
                      <n-button size="small" type="primary" :loading="purging" @click="handlePurgeUrls">清除指定 URL</n-button>
                    </template>
                  </n-space>
                </n-form-item>

                <n-divider>Zone 状态</n-divider>
                <n-form-item label="当前状态">
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
                        {{ currentDomainInfo?.status === 'paused' ? '激活 Zone' : '暂停 Zone' }}
                      </n-button>
                    </template>
                    <template v-if="currentDomainInfo?.status === 'paused'">
                      确定激活该 Zone？
                    </template>
                    <template v-else>
                      ⚠️ 暂停后所有 CF 功能将停止（CDN、WAF、SSL 等），DNS 仍正常解析。确定暂停？
                    </template>
                  </n-popconfirm>
                </n-form-item>
              </n-form>
            </n-tab-pane>
          </n-tabs>
        </n-card>

        <n-card v-else size="small">
          <n-empty description="请从左侧选择一个域名" style="margin: 40px 0" />
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 添加 DNS 记录 Modal -->
    <n-modal v-model:show="showAddRecordModal" preset="dialog" title="添加 DNS 记录" style="width: 520px; max-width: 95vw">
      <n-form ref="recordFormRef" :model="newRecord" :rules="recordRules" label-placement="left" label-width="80">
        <n-form-item label="类型" path="type">
          <n-select v-model:value="newRecord.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="名称" path="name">
          <n-input v-model:value="newRecord.name" placeholder="例: www 或 @ 或 *" />
        </n-form-item>
        <n-form-item v-if="newRecord.type === 'MX'" label="优先级">
          <n-input-number v-model:value="newRecord.priority" :min="0" :max="65535" />
        </n-form-item>
        <n-form-item label="内容" path="content">
          <n-input v-model:value="newRecord.content" placeholder="IP 地址或域名" />
        </n-form-item>
        <n-form-item label="TTL">
          <n-input-number v-model:value="newRecord.ttl" :min="60" :max="86400" />
        </n-form-item>
        <n-form-item label="代理">
          <n-switch v-model:value="newRecord.proxied" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddRecordModal = false">取消</n-button>
        <n-button type="primary" :loading="addingRecord" @click="handleAddRecord">添加</n-button>
      </template>
    </n-modal>

    <!-- 批量添加域名 Modal -->
    <n-modal v-model:show="showAddDomainModal" preset="dialog" title="添加域名" style="width: 520px; max-width: 95vw">
      <n-form :model="newDomain" label-placement="left" label-width="80">
        <n-form-item label="目标账户">
          <n-select
            v-model:value="newDomain.account_id"
            :options="availableAccounts"
            placeholder="选择账户"
            filterable
          />
        </n-form-item>
        <n-form-item label="Zone 类型">
          <n-select v-model:value="newDomain.type" :options="zoneTypeOptions" />
        </n-form-item>
        <n-form-item label="域名列表">
          <n-input
            v-model:value="newDomain.names"
            type="textarea"
            placeholder="每行一个域名，如：example.com"
            :rows="6"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddDomainModal = false">取消</n-button>
        <n-button type="primary" :loading="creatingDomains" @click="handleCreateDomains">创建</n-button>
      </template>
    </n-modal>

    <!-- 创建结果 Modal -->
    <n-modal v-model:show="showResultModal" preset="dialog" title="创建结果" style="width: 520px; max-width: 95vw">
      <div v-if="createResult">
        <div v-for="r in createResult.results" :key="r.name" style="margin-bottom: 12px; padding: 8px; border-radius: 4px; background: var(--n-color-modal);">
          <n-space align="center" :size="8">
            <span>{{ r.success ? '✅' : '❌' }}</span>
            <span style="font-weight: 500">{{ r.name }}</span>
          </n-space>
          <div v-if="r.success && r.name_servers?.length" style="margin-top: 4px; padding-left: 24px">
            <n-text depth="3" style="font-size: 12px">NS:</n-text>
            <div v-for="ns in r.name_servers" :key="ns" style="font-size: 12px; font-family: monospace">{{ ns }}</div>
            <n-button size="tiny" @click="copyNS(r.name_servers)">复制 NS</n-button>
          </div>
          <div v-if="!r.success && r.error" style="margin-top: 4px; padding-left: 24px">
            <n-text type="error" style="font-size: 12px">原因: {{ r.error }}</n-text>
          </div>
        </div>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">总计: {{ createResult.total }}  成功: {{ createResult.succeeded }}  失败: {{ createResult.failed }}</n-text>
      </div>
      <template #action>
        <n-button @click="showResultModal = false">关闭</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, onMounted, watch, reactive } from 'vue';
import { NButton, NSwitch, NTag, NText, NCheckbox, useMessage, useDialog } from 'naive-ui';
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui';
import { useDnsStore } from '../stores/dnsStore';
import { dnsApi } from '../api/dns';
import { accountsApi } from '../api/accounts';
import { loadDemoAccounts, isDemoAccount } from '../utils/demoAccounts';

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
  if (!searchQuery.value) return allDomains.value;
  const q = searchQuery.value.toLowerCase();
  return allDomains.value.filter((d: any) => d.name?.toLowerCase().includes(q));
});

const groupedDomains = computed(() => {
  const groups: Record<string, any[]> = {};
  for (const d of filteredDomains.value) {
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
    case 'active': return '活跃';
    case 'pending': return '等待';
    case 'paused': return '暂停';
    case 'moved': return '已迁移';
    case 'initializing': return '初始化';
    default: return status || '未知';
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
  type: { required: true, message: '请选择类型', trigger: 'change' },
  name: { required: true, message: '请输入名称', trigger: 'blur' },
  content: { required: true, message: '请输入内容', trigger: 'blur' },
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
    message.success('记录已添加');
    showAddRecordModal.value = false;
    newRecord.value = { type: 'A', name: '', content: '', ttl: 300, proxied: true, priority: 10 };
    dnsStore.fetchRecords(dnsStore.currentDomain);
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '添加失败');
  } finally {
    addingRecord.value = false;
  }
}

async function handleDeleteRecord(row: any) {
  if (!dnsStore.currentDomain) return;
  try {
    await dnsApi.deleteRecord(dnsStore.currentDomain, row.id);
    message.success('记录已删除');
    dnsStore.fetchRecords(dnsStore.currentDomain);
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '删除失败');
  }
}

async function handleProxyToggle(row: any, proxied: boolean) {
  if (!dnsStore.currentDomain) return;
  try {
    await dnsApi.updateProxy(dnsStore.currentDomain, row.id, proxied);
    row.proxied = proxied;
    message.success('代理状态已更新');
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '更新失败');
  }
}

const currentDomainIsDemo = computed(() => {
  const d = currentDomainInfo.value;
  return d ? isDemoDomain(d) : false;
});

const recordColumns: DataTableColumns<any> = [
  { title: '类型', key: 'type', width: 80, render: (row) => h(NTag, { size: 'small', type: 'info' }, { default: () => row.type }) },
  { title: '名称', key: 'name', width: 180, ellipsis: { tooltip: true } },
  { title: '内容', key: 'content', minWidth: 180, ellipsis: { tooltip: true } },
  { title: 'TTL', key: 'ttl', width: 80, render: (row) => row.ttl === 1 ? '自动' : String(row.ttl) },
  {
    title: '代理', key: 'proxied', width: 80,
    render: (row) => h(NSwitch, { value: row.proxied, onUpdateValue: (v: boolean) => handleProxyToggle(row, v), size: 'small' }),
  },
  {
    title: '操作', key: 'actions', width: 120,
    render: (row) => currentDomainIsDemo.value ? null : h('div', { style: 'display: flex; gap: 4px' }, [
      h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleEditRecord(row) }, { default: () => '编辑' }),
      h(NButton, {
        size: 'tiny', type: 'error', quaternary: true,
        onClick: () => {
          dialog.warning({
            title: '确认删除',
            content: `确定删除 ${row.type} 记录 ${row.name} → ${row.content}？`,
            positiveText: '删除',
            negativeText: '取消',
            onPositiveClick: () => handleDeleteRecord(row),
          });
        }
      }, { default: () => '删除' }),
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
      message.warning(`部分设置更新失败: ${result.failed.join(', ')}`);
    } else {
      message.success('设置已更新');
    }
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '保存失败');
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
    message.success('缓存已清除');
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '清除失败');
  } finally {
    purging.value = false;
  }
}

async function handlePurgeUrls() {
  if (!dnsStore.currentDomain) return;
  const files = purgeUrls.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!files.length) {
    message.warning('请输入至少一个 URL');
    return;
  }
  purging.value = true;
  try {
    await dnsStore.purgeZoneCache(dnsStore.currentDomain, { files });
    message.success(`已清除 ${files.length} 个 URL 的缓存`);
    purgeUrls.value = '';
    showUrlPurge.value = false;
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '清除失败');
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
    message.success(!isPaused ? 'Zone 已暂停' : 'Zone 已激活');
  } catch (err: any) {
    message.error(err?.response?.data?.error?.message || '操作失败');
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
const zoneTypeOptions = [
  { label: 'Full（完整设置，改 NS）', value: 'full' },
  { label: 'Partial（CNAME 设置）', value: 'partial' },
];

async function handleCreateDomains() {
  if (!newDomain.value.account_id) {
    message.warning('请选择目标账户');
    return;
  }
  const names = newDomain.value.names.split('\n').map(s => s.trim()).filter(Boolean);
  if (!names.length) {
    message.warning('请输入至少一个域名');
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
    message.error(err?.response?.data?.error?.message || '创建失败');
  } finally {
    creatingDomains.value = false;
  }
}

function copyNS(ns: string[]) {
  navigator.clipboard.writeText(ns.join('\n')).then(() => {
    message.success('NS 已复制到剪贴板');
  }).catch(() => {
    message.error('复制失败');
  });
}

// ===== 批量删除域名 =====
function handleBatchDelete() {
  const domains = Array.from(selectedDomains.value);
  if (!domains.length) return;
  dialog.warning({
    title: '确认批量删除',
    content: `确定删除 ${domains.length} 个域名？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await dnsStore.deleteDomains(domains);
        message.success(`删除完成: ${result.succeeded} 成功, ${result.failed} 失败`);
        selectedDomains.value = new Set();
      } catch (err: any) {
        message.error(err?.response?.data?.error?.message || '删除失败');
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
      { label: '所有账户', value: '__all__' },
      ...accounts.map((a: any) => ({ label: a.name, value: String(a.id) })),
    ];
    availableAccounts.value = accounts
      .filter((a: any) => a.account_id)
      .map((a: any) => ({ label: a.name, value: a.id }));
  } catch {
    accountOptions.value = [{ label: '所有账户', value: '__all__' }];
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
