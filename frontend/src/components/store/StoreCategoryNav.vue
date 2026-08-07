<template>
  <div class="category-nav">
    <n-tabs
      type="segment"
      :value="selectedType ?? 'all'"
      @update:value="onTypeChange"
      size="small"
    >
      <n-tab name="all">{{ t('storeCategoryNav.all', { count: total }) }}</n-tab>
      <n-tab v-for="tc in types" :key="tc.value" :name="tc.value">
        {{ tc.label }} ({{ tc.count }})
      </n-tab>
    </n-tabs>

    <n-space v-if="tags.length" class="tag-cloud" size="small" wrap>
      <n-tag
        v-for="tag in tags"
        :key="tag"
        size="small"
        round
        checkable
        :checked="selectedTags.includes(tag)"
        @update:checked="() => onTagToggle(tag)"
      >
        {{ tag }}
      </n-tag>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface TypeCount {
  value: 'worker' | 'pages' | 'hybrid';
  label: string;
  count: number;
}

const props = defineProps<{
  types: TypeCount[];
  selectedType: string | null;
  tags: string[];
  selectedTags: string[];
}>();

const emit = defineEmits<{
  (e: 'update:selectedType', value: string | null): void;
  (e: 'toggle-tag', tag: string): void;
}>();

const total = computed(() => props.types.reduce((sum, tc) => sum + tc.count, 0));

function onTypeChange(value: string) {
  emit('update:selectedType', value === 'all' ? null : value);
}

function onTagToggle(tag: string) {
  emit('toggle-tag', tag);
}
</script>

<style scoped>
.category-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.tag-cloud {
  padding: 0 2px;
}
</style>
