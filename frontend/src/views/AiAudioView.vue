<template>
  <div class="ai-audio-root">
    <!-- 左侧：控制面板 -->
    <div class="ai-audio-sidebar">
      <!-- 账户 + 模型选择 -->
      <div class="sidebar-section">
        <n-select
          v-model:value="selectedAccount"
          :options="accountOptions"
          placeholder=""
          size="small"
          class="sidebar-select"
        />
        <n-select
          v-model:value="selectedModel"
          :options="modelOptions"
          :placeholder="t('aiAudio.selectModel')"
          :loading="modelsLoading"
          size="small"
          filterable
        />
      </div>

      <!-- 语音/说话人选择 -->
      <div class="sidebar-section">
        <n-select
          v-model:value="selectedVoice"
          :options="voiceOptions"
          :placeholder="t('aiAudio.selectVoice')"
          size="small"
          filterable
        />
      </div>

      <!-- 文本输入 -->
      <div class="sidebar-section">
        <n-input
          v-model:value="inputText"
          type="textarea"
          :placeholder="t('aiAudio.textPlaceholder')"
          :rows="6"
          :disabled="generating"
          :maxlength="5000"
          show-count
        />
      </div>

      <!-- 生成按钮 -->
      <div class="sidebar-section sidebar-footer">
        <n-button type="primary" @click="generate" :loading="generating" :disabled="!canGenerate" block>
          {{ t('aiAudio.generate') }}
        </n-button>
      </div>
    </div>

    <!-- 右侧：结果展示 -->
    <div class="ai-audio-main">
      <!-- 生成中：顶部加载条 -->
      <div v-if="generating" class="ai-audio-generating-bar">
        <n-spin size="small" />
        <span style="margin-left: 8px; color: var(--app-text-muted); font-size: 13px;">{{ t('aiAudio.generating') }}</span>
      </div>

      <!-- 空状态 -->
      <div v-if="!generating && generatedAudios.length === 0" class="ai-audio-empty">
        <p style="color: var(--app-text-muted); font-size: 16px;">{{ t('aiAudio.emptyHint') }}</p>
      </div>

      <!-- 音频列表 -->
      <div v-if="generatedAudios.length > 0" class="ai-audio-list">
        <div v-for="(audio, idx) in generatedAudios" :key="idx" class="ai-audio-card">
          <div class="ai-audio-card-header">
            <span class="ai-audio-card-text" :title="audio.text">{{ audio.text }}</span>
            <div class="ai-audio-card-meta">
              <span v-if="audio.neurons" class="ai-audio-card-neurons">⚡ {{ audio.neurons }}</span>
              <span class="ai-audio-card-voice">{{ audio.voice }}</span>
            </div>
          </div>
          <div class="ai-audio-card-player">
            <audio
              :ref="el => { if (el) audioRefs[idx] = el as HTMLAudioElement }"
              :src="`data:${audio.contentType};base64,${audio.b64}`"
              controls
              style="width: 100%;"
            />
          </div>
          <div class="ai-audio-card-actions">
            <n-button size="tiny" quaternary @click="downloadAudio(audio)">{{ t('aiAudio.download') }}</n-button>
            <n-button size="tiny" quaternary @click="reuseText(audio)">{{ t('aiAudio.reuse') }}</n-button>
            <n-button size="tiny" quaternary type="error" @click="removeAudio(idx)">{{ t('common.delete') }}</n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { accountsApi } from '../api/accounts';

const { t } = useI18n();
const message = useMessage();

interface GeneratedAudio {
  b64: string;
  text: string;
  model: string;
  voice: string;
  neurons?: number;
  contentType: string;
}

const selectedAccount = ref('auto');
const accountOptions = ref<{ label: string; value: string }[]>([]);
const selectedModel = ref('');
const modelOptions = ref<{ label: string; value: string }[]>([]);
const modelsLoading = ref(false);
const inputText = ref('');
const selectedVoice = ref('luna');
const generating = ref(false);
const generatedAudios = ref<GeneratedAudio[]>([]);
const audioRefs = ref<HTMLAudioElement[]>([]);

// CF TTS 支持的说话人列表
const CF_TTS_SPEAKERS = [
  'amalthea', 'andromeda', 'apollo', 'arcas', 'aries', 'asteria', 'athena', 'atlas',
  'aurora', 'callista', 'cora', 'cordelia', 'delia', 'draco', 'electra', 'harmonia',
  'helena', 'hera', 'hermes', 'hyperion', 'iris', 'janus', 'juno', 'jupiter',
  'luna', 'mars', 'minerva', 'neptune', 'odysseus', 'ophelia', 'orion', 'orpheus',
  'pandora', 'phoebe', 'pluto', 'saturn', 'thalia', 'theia', 'vesta', 'zeus',
];

// OpenAI 兼容语音映射
const VOICE_MAP: Record<string, string> = {
  alloy: 'luna', echo: 'mars', fable: 'athena', onyx: 'apollo', nova: 'aurora', shimmer: 'iris',
};

const voiceOptions = computed(() => {
  // OpenAI 标准语音 + CF 原生说话人
  const openaiVoices = [
    { label: `alloy → ${VOICE_MAP['alloy']}`, value: 'alloy' },
    { label: `echo → ${VOICE_MAP['echo']}`, value: 'echo' },
    { label: `fable → ${VOICE_MAP['fable']}`, value: 'fable' },
    { label: `onyx → ${VOICE_MAP['onyx']}`, value: 'onyx' },
    { label: `nova → ${VOICE_MAP['nova']}`, value: 'nova' },
    { label: `shimmer → ${VOICE_MAP['shimmer']}`, value: 'shimmer' },
  ];
  const cfSpeakers = CF_TTS_SPEAKERS
    .filter(s => !Object.values(VOICE_MAP).includes(s))
    .map(s => ({ label: s, value: s }));
  return [...openaiVoices, ...cfSpeakers];
});

const canGenerate = computed(() => {
  return !!selectedModel.value && !!inputText.value.trim();
});

async function fetchAccounts() {
  try {
    const { data } = await accountsApi.getAll();
    const accounts = (data.accounts || []).filter((a: any) => a.is_active && (a.enabled_features || '').includes('ai')).map((a: any) => ({
      label: a.name,
      value: a.account_id || String(a.id),
    }));
    accountOptions.value = [
      { label: '🤖 ' + t('ai.autoAssign'), value: 'auto' },
      ...accounts,
    ];
  } catch {
    accountOptions.value = [{ label: '🤖 ' + t('ai.autoAssign'), value: 'auto' }];
  }
}

async function fetchModels() {
  modelsLoading.value = true;
  try {
    const token = localStorage.getItem('api_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch('/api/v1/models?task=text-to-speech', { headers });
    if (resp.ok) {
      const data = await resp.json();
      const models = (data.data || []).map((m: any) => ({
        label: (m.id || m.name || '').replace(/^@cf\//, ''),
        value: m.id || m.name,
      }));
      modelOptions.value = models;
      if (models.length && !models.find((o: any) => o.value === selectedModel.value)) {
        selectedModel.value = models[0].value;
      }
    }
  } catch {
    // silent
  } finally {
    modelsLoading.value = false;
  }
}

async function generate() {
  if (!canGenerate.value) return;

  generating.value = true;
  const currentText = inputText.value;

  try {
    const token = localStorage.getItem('api_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body = {
      model: selectedModel.value,
      input: currentText,
      voice: selectedVoice.value,
    };

    const response = await fetch('/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        ...headers,
        ...(selectedAccount.value && selectedAccount.value !== 'auto' ? { 'X-Account-ID': selectedAccount.value } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message
          || errorJson.errors?.[0]?.message
          || errorJson.message
          || errorText;
      } catch { /* not JSON */ }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    // 兼容 responseWrapper 包装格式和原始格式
    const audioData = data.success ? data.data : data;
    const audioBase64 = audioData?.data?.[0]?.audio;
    if (!audioBase64) {
      throw new Error('No audio in response');
    }

    generatedAudios.value.unshift({
      b64: audioBase64,
      text: currentText,
      model: selectedModel.value,
      voice: selectedVoice.value,
      neurons: audioData?.data?.[0]?.neurons,
      contentType: audioData?.data?.[0]?.content_type || 'audio/mpeg',
    });

    message.success(t('aiAudio.generateSuccess'));
  } catch (e: any) {
    message.error(e?.message || t('aiAudio.generateFailed'));
  } finally {
    generating.value = false;
  }
}

function downloadAudio(audio: GeneratedAudio) {
  if (!audio) return;
  const ext = audio.contentType.includes('wav') ? 'wav' : 'mp3';
  const link = document.createElement('a');
  link.href = `data:${audio.contentType};base64,${audio.b64}`;
  link.download = `ai-audio-${Date.now()}.${ext}`;
  link.click();
}

function reuseText(audio: GeneratedAudio) {
  inputText.value = audio.text;
  selectedModel.value = audio.model;
  selectedVoice.value = audio.voice;
}

function removeAudio(idx: number) {
  generatedAudios.value.splice(idx, 1);
}

onMounted(() => {
  fetchAccounts();
  fetchModels();
});
</script>

<style scoped>
.ai-audio-root {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.ai-audio-sidebar {
  width: 340px;
  min-width: 340px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--app-border);
  overflow-y: auto;
  padding: 12px;
  gap: 12px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-select {
  margin-bottom: 4px;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 8px;
}

.ai-audio-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  position: relative;
}

.ai-audio-generating-bar {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--n-color-tag);
  border-bottom: 1px solid var(--app-border);
  z-index: 10;
}

.ai-audio-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}

.ai-audio-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 800px;
  margin: 0 auto;
}

.ai-audio-card {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--n-color-modal);
}

.ai-audio-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.ai-audio-card-text {
  flex: 1;
  font-size: 13px;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ai-audio-card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.ai-audio-card-neurons {
  font-size: 12px;
  color: var(--app-text-muted);
  background: var(--n-color-tag);
  padding: 2px 6px;
  border-radius: 4px;
}

.ai-audio-card-voice {
  font-size: 11px;
  color: var(--app-text-muted);
}

.ai-audio-card-player {
  margin: 8px 0;
}

.ai-audio-card-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .ai-audio-root {
    flex-direction: column;
  }
  .ai-audio-sidebar {
    width: 100%;
    min-width: 100%;
    max-height: 50vh;
    border-right: none;
    border-bottom: 1px solid var(--app-border);
  }
}
</style>
