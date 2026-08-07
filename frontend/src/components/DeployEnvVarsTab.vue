<template>
  <div>
    <n-space v-for="(row, idx) in props.modelValue" :key="idx" align="center" :size="6" style="margin-bottom: 8px">
      <n-input v-model:value="row.name" :placeholder="t('workers.envVars.namePlaceholder')" style="width: 180px" />
      <n-input v-model:value="row.value" :type="row.secret ? 'password' : 'text'" :placeholder="row.secret ? (row.keep ? t('workers.envVars.keepPlaceholder') : t('workers.envVars.secretValuePlaceholder')) : t('workers.envVars.valuePlaceholder')" style="flex: 1" />
      <n-switch v-model:value="row.secret" size="small" />
      <n-text depth="3" style="font-size: 12px; width: 44px">{{ row.secret ? t('workers.envVars.secretLabel') : t('workers.envVars.plainLabel') }}</n-text>
      <n-button size="tiny" quaternary type="error" @click="removeRow(idx)">{{ t('common.delete') }}</n-button>
    </n-space>
    <n-button size="tiny" dashed @click="addRow">{{ t('workers.envVars.add') }}</n-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { DeployVarInput } from '../api/workers';

const { t } = useI18n();
const props = defineProps<{ modelValue: DeployVarInput[] }>();
const emit = defineEmits<{ 'update:modelValue': [DeployVarInput[]] }>();

function addRow() {
  emit('update:modelValue', [...props.modelValue, { name: '', value: '', secret: false }]);
}
function removeRow(idx: number) {
  const next = props.modelValue.filter((_, i) => i !== idx);
  emit('update:modelValue', next);
}
</script>
