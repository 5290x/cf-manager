<template>
  <div>
    <n-alert v-if="isMultiAccount" type="info" :show-icon="true" style="margin-bottom: 8px; font-size: 12px">
      {{ t('workers.resources.multiAccountHint') }}
    </n-alert>
    <n-space v-for="(row, idx) in props.modelValue" :key="idx" align="center" :size="6" style="margin-bottom: 8px">
      <n-input v-model:value="row.name" :placeholder="t('workers.resources.bindingNamePlaceholder')" style="width: 160px" />
      <template v-if="isMultiAccount">
        <n-input v-model:value="row.resourceName" :placeholder="t('workers.resources.resourceNameMultiPlaceholder')" style="flex: 1" />
      </template>
      <template v-else>
        <n-select v-model:value="row.existingId" :options="resourceOptions" filterable :placeholder="t('workers.resources.selectPlaceholder')" style="flex: 1" :loading="loading" @update:value="onSelect(row, $event)" />
        <n-input v-if="row.mode === 'auto'" v-model:value="row.resourceName" :placeholder="t('workers.resources.resourceNameAutoPlaceholder')" style="flex: 1" />
      </template>
      <n-button size="tiny" quaternary type="error" @click="removeRow(idx)">{{ t('common.delete') }}</n-button>
    </n-space>
    <n-button size="tiny" dashed @click="addRow">{{ t('workers.resources.add') }}</n-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DeployBindingInput } from '../api/workers';
import { workersApi } from '../api/workers';

const { t } = useI18n();
const props = defineProps<{ modelValue: DeployBindingInput[]; resourceType: 'kv' | 'd1' | 'r2'; accountIds: number[] }>();
const emit = defineEmits<{ 'update:modelValue': [DeployBindingInput[]] }>();

const existingResources = ref<any[]>([]);
const loading = ref(false);
const isMultiAccount = computed(() => props.accountIds.length > 1);

const resourceOptions = computed(() => [
  { label: t('workers.resources.autoCreate'), value: '__auto__' },
  ...existingResources.value.map((r: any) => ({ label: r.title || r.name || r.id, value: r.id || r.uuid || r.name })),
]);

async function loadResources() {
  if (isMultiAccount.value || !props.accountIds.length) return;
  const accountId = props.accountIds[0];
  loading.value = true;
  try {
    if (props.resourceType === 'kv') { const { data } = await workersApi.getKvNamespaces(accountId); existingResources.value = data as any[]; }
    else if (props.resourceType === 'd1') { const { data } = await workersApi.getD1Databases(accountId); existingResources.value = data as any[]; }
    else { const { data } = await workersApi.getR2Buckets(accountId, { _silent: true }); existingResources.value = (data?.buckets || data) as any[]; }
  } catch { existingResources.value = []; }
  finally { loading.value = false; }
}

function onSelect(row: DeployBindingInput, val: string) {
  if (val === '__auto__') { row.mode = 'auto'; row.existingId = undefined; }
  else { row.mode = 'existing'; row.existingId = val; }
}

function addRow() { emit('update:modelValue', [...props.modelValue, { type: props.resourceType, name: '', mode: 'auto' } as DeployBindingInput]); }
function removeRow(idx: number) { emit('update:modelValue', props.modelValue.filter((_, i) => i !== idx)); }

watch(() => [props.resourceType, props.accountIds.join(','), isMultiAccount.value], loadResources, { immediate: true });
</script>
