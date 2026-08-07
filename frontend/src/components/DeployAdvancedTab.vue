<template>
  <div>
    <n-space align="center" :size="8" style="margin-bottom: 12px">
      <n-switch v-model:value="aiEnabled" size="small" />
      <n-text style="font-size: 13px">{{ t('workers.advanced.aiLabel') }}</n-text>
    </n-space>
    <template v-if="!props.isPages">
      <n-space v-for="(row, idx) in rows" :key="idx" align="center" :size="6" style="margin-bottom: 8px">
        <n-select v-model:value="row.type" :options="typeOptions" style="width: 150px" />
        <n-input v-model:value="row.name" :placeholder="t('workers.advanced.bindingNamePlaceholder')" style="width: 150px" />
        <n-input v-if="row.type === 'durable_object'" v-model:value="row.className" :placeholder="t('workers.advanced.classNamePlaceholder')" style="flex: 1" />
        <n-input v-else-if="row.type === 'service'" v-model:value="row.service" :placeholder="t('workers.advanced.servicePlaceholder')" style="flex: 1" />
        <n-input v-else-if="row.type === 'queue'" v-model:value="row.queueName" :placeholder="t('workers.advanced.queuePlaceholder')" style="flex: 1" />
        <n-button size="tiny" quaternary type="error" @click="removeRow(idx)">{{ t('common.delete') }}</n-button>
      </n-space>
      <n-button size="tiny" dashed @click="addRow">{{ t('workers.advanced.add') }}</n-button>
    </template>
    <n-text v-else depth="3" style="font-size: 12px">{{ t('workers.advanced.pagesHint') }}</n-text>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DeployBindingInput } from '../api/workers';

const { t } = useI18n();
const props = defineProps<{ modelValue: DeployBindingInput[]; isPages: boolean; aiEnabled: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [DeployBindingInput[]]; 'update:aiEnabled': [boolean] }>();
const aiEnabled = computed({ get: () => props.aiEnabled, set: (v) => emit('update:aiEnabled', v) });
const typeOptions = computed(() => [
  { label: t('workers.advanced.durableObject'), value: 'durable_object' },
  { label: t('workers.advanced.serviceBinding'), value: 'service' },
  { label: t('workers.advanced.queue'), value: 'queue' },
]);
const rows = computed(() => props.modelValue);
function addRow() { emit('update:modelValue', [...props.modelValue, { type: 'durable_object', name: '' } as DeployBindingInput]); }
function removeRow(idx: number) { emit('update:modelValue', props.modelValue.filter((_, i) => i !== idx)); }
watch(() => props.isPages, (isPages) => {
  if (isPages) emit('update:modelValue', props.modelValue.filter(r => r.type === 'ai'));
});
</script>
