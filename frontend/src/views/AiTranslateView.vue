<template>
  <div class="ai-translate-view">
    <!-- 账户和模型选择 -->
    <div class="header-controls">
      <n-select
        v-model:value="selectedAccountId"
        :options="accountOptions"
        :placeholder="t('aiTranslate.selectAccount')"
        clearable
        class="account-select"
        @update:value="onAccountChange"
      />
      <n-select
        v-model:value="selectedModel"
        :options="modelOptions"
        :placeholder="t('aiTranslate.selectModel')"
        filterable
        class="model-select"
      />
    </div>

    <!-- 翻译表单 -->
    <div class="translate-form">
      <div class="lang-selector">
        <n-select
          v-model:value="sourceLang"
          :options="sourceLangOptions"
          :placeholder="t('aiTranslate.sourceLang')"
          clearable
          class="lang-select"
        />
        <n-icon class="arrow-icon">
          <ArrowRightOutlined />
        </n-icon>
        <n-select
          v-model:value="targetLang"
          :options="targetLangOptions"
          :placeholder="t('aiTranslate.targetLang')"
          class="lang-select"
        />
      </div>

      <div class="text-areas">
        <n-input
          v-model:value="sourceText"
          type="textarea"
          :placeholder="t('aiTranslate.sourcePlaceholder')"
          :rows="6"
          :maxlength="10000"
          show-count
        />
        <n-button quaternary circle size="large" @click="swapLanguages" :disabled="!sourceText">
          <template #icon>
            <n-icon><SwapOutlined /></n-icon>
          </template>
        </n-button>
        <n-input
          v-model:value="translatedText"
          type="textarea"
          :placeholder="t('aiTranslate.resultPlaceholder')"
          :rows="6"
          readonly
          :loading="loading"
        />
      </div>

      <div class="action-bar">
        <n-space>
          <n-button
            type="primary"
            size="large"
            :disabled="!canTranslate"
            :loading="loading"
            @click="translate"
          >
            <template #icon>
              <n-icon><TranslationOutlined /></n-icon>
            </template>
            {{ t('aiTranslate.translateBtn') }}
          </n-button>
          <n-button
            secondary
            :disabled="!translatedText"
            @click="copyResult"
          >
            <template #icon>
              <n-icon><CopyOutlined /></n-icon>
            </template>
            {{ t('aiTranslate.copyBtn') }}
          </n-button>
        </n-space>
        <n-tag v-if="lastNeurons > 0" type="info" round>
          <template #icon>
            <n-icon><ThunderboltOutlined /></n-icon>
          </template>
          {{ t('aiTranslate.neuronsUsed', { count: lastNeurons }) }}
        </n-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessage } from 'naive-ui';
import {
  ArrowRightOutlined,
  SwapOutlined,
  TranslationOutlined,
  CopyOutlined,
  ThunderboltOutlined,
} from '@vicons/antd';
import apiClient from '../api/client';
import { accountStore } from '../stores/accountStore';

const { t } = useI18n();
const message = useMessage();

const selectedAccountId = ref<string | null>(null);
const selectedModel = ref<string>('');
const sourceLang = ref<string | null>(null);
const targetLang = ref<string>('en');
const sourceText = ref('');
const translatedText = ref('');
const loading = ref(false);
const lastNeurons = ref(0);

const accountOptions = computed(() => {
  return accountStore.accounts
    .filter((a: any) => a.ai_enabled)
    .map((a: any) => ({ label: a.name, value: a.id }));
});

const modelOptions = computed(() => {
  const models = [
    { label: 'M2M100 1.2B (Multi-language)', value: '@cf/meta/m2m100-1.2b' },
    { label: 'IndicTrans2 EN-Indic 1B', value: '@cf/ai4bharat/indictrans2-en-indic-1B' },
  ];
  return models;
});

const sourceLangOptions = computed(() => {
  return [
    { label: t('aiTranslate.auto'), value: null },
    { label: 'English', value: 'English' },
    { label: '中文', value: 'Chinese' },
    { label: '日本語', value: 'Japanese' },
    { label: '한국어', value: 'Korean' },
    { label: 'Français', value: 'French' },
    { label: 'Deutsch', value: 'German' },
    { label: 'Español', value: 'Spanish' },
    { label: 'Português', value: 'Portuguese' },
    { label: 'Русский', value: 'Russian' },
    { label: 'Italiano', value: 'Italian' },
  ];
});

const targetLangOptions = computed(() => {
  return [
    { label: 'English', value: 'English' },
    { label: '中文', value: 'Chinese' },
    { label: '日本語', value: 'Japanese' },
    { label: '한국어', value: 'Korean' },
    { label: 'Français', value: 'French' },
    { label: 'Deutsch', value: 'German' },
    { label: 'Español', value: 'Spanish' },
    { label: 'Português', value: 'Portuguese' },
    { label: 'Русский', value: 'Russian' },
    { label: 'Italiano', value: 'Italian' },
  ];
});

const canTranslate = computed(() => {
  return !!selectedModel.value && !!sourceText.value.trim() && !!targetLang.value;
});

onMounted(() => {
  if (accountStore.accounts.length === 0) {
    accountStore.fetchAccounts();
  }
});

async function translate() {
  if (!canTranslate.value) return;

  loading.value = true;
  lastNeurons.value = 0;

  try {
    const headers: Record<string, string> = {};
    if (selectedAccountId.value) {
      headers['X-Account-ID'] = selectedAccountId.value;
    }

    const response = await apiClient.post('/v1/translations', {
      model: selectedModel.value,
      text: sourceText.value,
      source_lang: sourceLang.value || undefined,
      target_lang: targetLang.value,
    }, { headers });

    const result = response.data?.data?.[0];
    if (result?.translated_text) {
      translatedText.value = result.translated_text;
      lastNeurons.value = result.neurons || 0;
    } else {
      message.error(t('aiTranslate.translateError'));
    }
  } catch (err: any) {
    console.error('Translation error:', err);
    message.error(err.errorMessage || t('aiTranslate.translateError'));
  } finally {
    loading.value = false;
  }
}

function swapLanguages() {
  const temp = sourceLang.value;
  sourceLang.value = targetLang;
  targetLang.value = temp || 'en';

  const tempText = sourceText.value;
  sourceText.value = translatedText.value;
  translatedText.value = tempText;
}

function copyResult() {
  if (!translatedText.value) return;
  navigator.clipboard.writeText(translatedText.value).then(() => {
    message.success(t('aiTranslate.copySuccess'));
  });
}

function onAccountChange() {
  // 可以在这里重置模型选择等
}
</script>

<style scoped>
.ai-translate-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.account-select,
.model-select {
  width: 200px;
}

.translate-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lang-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lang-select {
  flex: 1;
}

.arrow-icon {
  font-size: 20px;
  color: var(--text-color-3);
}

.text-areas {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.text-areas > :first-child,
.text-areas > :last-child {
  flex: 1;
}

.text-areas > :nth-child(2) {
  align-self: center;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>