import i18n from '../i18n';

export interface Resource {
  resource: string;
  count: number;
  limit: number;
  exhausted?: boolean; // true = 已耗尽
}

export const resourceOrder = ['workers_requests', 'ai_neurons', 'browser_render_seconds'] as const;

export function resourceLabel(resource: string): string {
  const t = i18n.global.t;
  const map: Record<string, string> = {
    workers_requests: t('compactCard.workersRequests'),
    ai_neurons: t('compactCard.aiNeurons'),
    browser_render_seconds: t('compactCard.browserRender'),
  };
  return map[resource] || resource;
}

export function calcPercentage(r: Resource): number {
  if (!r.limit) return 0;
  return Math.min(100, Math.round(((r.count || 0) / (r.limit || 1)) * 100));
}

export function formatValue(r: Resource): string {
  const t = i18n.global.t;
  if (r.resource === 'browser_render_seconds') {
    const m = Math.floor(r.count / 60);
    const s = Math.round(r.count % 60);
    const lm = Math.floor(r.limit / 60);
    const ls = Math.round(r.limit % 60);
    return `${m > 0 ? t('compactCard.minFmt', { m }) : ''}${t('compactCard.secFmt', { s })} / ${t('compactCard.minFmt', { m: lm })}${ls > 0 ? t('compactCard.secFmt', { s: ls }) : ''}`;
  }
  return `${(r.count || 0).toLocaleString()} / ${(r.limit || 0).toLocaleString()}`;
}
