import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

export type Locale = 'zh-CN' | 'en';

const STORAGE_KEY = 'app_locale';

function getDefaultLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en') return stored;
  } catch { /* ignore */ }
  // 根据浏览器语言自动判断
  const lang = navigator.language || (navigator as any).userLanguage || '';
  return lang.startsWith('zh') ? 'zh-CN' : 'en';
}

export function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch { /* ignore */ }
}

const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en': en,
  },
});

export default i18n;
