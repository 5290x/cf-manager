import { Account } from '../db/models';
import { cfFetch } from './cfApi';

export interface ManualVarInput { name: string; value: string; secret: boolean; keep?: boolean }
export interface ManualBindingInput {
  type: 'kv' | 'd1' | 'r2' | 'ai' | 'durable_object' | 'service' | 'queue';
  name: string;
  resourceName?: string;
  mode?: 'auto' | 'existing';
  existingId?: string;
  className?: string;
  scriptName?: string;
  service?: string;
  environment?: string;
  queueName?: string;
}

export function isValidBindingName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

export function varsToBindings(vars: ManualVarInput[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const v of vars || []) {
    if (!v.name || !isValidBindingName(v.name)) continue;
    // keep 的 secret：不生成 binding（与 backend 对称，避免空值覆盖）
    if (v.secret && v.keep) continue;
    out.push(v.secret
      ? { type: 'secret_text', name: v.name, text: v.value }
      : { type: 'plain_text', name: v.name, text: v.value });
  }
  return out;
}

export async function resolveManualBindings(account: Account, encryptionKey: string, inputs: ManualBindingInput[]): Promise<Record<string, unknown>[]> {
  const accountId = account.account_id;
  const out: Record<string, unknown>[] = [];
  for (const b of inputs || []) {
    if (!b.name || !isValidBindingName(b.name)) throw new Error(`非法绑定名: ${b.name || '(空)'}`);
    switch (b.type) {
      case 'kv': {
        if (b.mode === 'existing') {
          if (!b.existingId) throw new Error(`KV 绑定 ${b.name} 缺少 existingId`);
          out.push({ type: 'kv_namespace', name: b.name, namespace_id: b.existingId });
          break;
        }
        if (!b.resourceName) throw new Error(`KV 绑定 ${b.name} 缺少资源名`);
        const list = await cfFetch<{ result: any[] }>(account, `/accounts/${accountId}/storage/kv/namespaces`, encryptionKey);
        let ns = (list.result || []).find((n: any) => n.title === b.resourceName);
        if (!ns) {
          const created = await cfFetch<any>(account, `/accounts/${accountId}/storage/kv/namespaces`, encryptionKey, { method: 'POST', body: JSON.stringify({ title: b.resourceName }) });
          ns = created.result;
        }
        out.push({ type: 'kv_namespace', name: b.name, namespace_id: ns.id });
        break;
      }
      case 'd1': {
        if (b.mode === 'existing') {
          if (!b.existingId) throw new Error(`D1 绑定 ${b.name} 缺少 existingId`);
          out.push({ type: 'd1', name: b.name, id: b.existingId });
          break;
        }
        if (!b.resourceName) throw new Error(`D1 绑定 ${b.name} 缺少资源名`);
        const list = await cfFetch<{ result: any[] }>(account, `/accounts/${accountId}/d1/database`, encryptionKey);
        let db = (list.result || []).find((d: any) => d.name === b.resourceName);
        if (!db) {
          const created = await cfFetch<any>(account, `/accounts/${accountId}/d1/database`, encryptionKey, { method: 'POST', body: JSON.stringify({ name: b.resourceName }) });
          db = created.result;
        }
        out.push({ type: 'd1', name: b.name, id: db.uuid });
        break;
      }
      case 'r2': {
        if (b.mode === 'existing') {
          if (!b.existingId) throw new Error(`R2 绑定 ${b.name} 缺少 existingId`);
          out.push({ type: 'r2_bucket', name: b.name, bucket_name: b.existingId });
          break;
        }
        if (!b.resourceName) throw new Error(`R2 绑定 ${b.name} 缺少资源名`);
        const list = await cfFetch<{ result: { buckets: any[] } }>(account, `/accounts/${accountId}/r2/buckets`, encryptionKey);
        let bucket = (list.result?.buckets || []).find((bk: any) => bk.name === b.resourceName);
        if (!bucket) {
          const created = await cfFetch<any>(account, `/accounts/${accountId}/r2/buckets`, encryptionKey, { method: 'POST', body: JSON.stringify({ name: b.resourceName }) });
          bucket = created.result;
        }
        out.push({ type: 'r2_bucket', name: b.name, bucket_name: bucket.name });
        break;
      }
      case 'ai':
        out.push({ type: 'ai', name: b.name }); break;
      case 'durable_object':
        if (!b.className) throw new Error(`DO 绑定 ${b.name} 缺少类名`);
        out.push({ type: 'durable_object_namespace', name: b.name, class_name: b.className, script_name: b.scriptName || undefined }); break;
      case 'service':
        if (!b.service) throw new Error(`Service 绑定 ${b.name} 缺少目标服务名`);
        out.push({ type: 'service', name: b.name, service: b.service, environment: b.environment || 'production' }); break;
      case 'queue':
        if (!b.queueName) throw new Error(`Queue 绑定 ${b.name} 缺少队列名`);
        out.push({ type: 'queue', name: b.name, queue_name: b.queueName }); break;
    }
  }
  return out;
}

// 与 backend 相同的 Pages deployment_configs 构建（字段格式：kv_namespaces/d1_databases/r2_buckets 是对象 map）
export function buildPagesConfigsFromInput(vars: ManualVarInput[], resolved: Record<string, unknown>[]): { production: any; preview: any } | undefined {
  const prod: any = { compatibility_date: '2024-11-01' };
  const prev: any = { compatibility_date: '2024-11-01' };
  for (const v of vars || []) {
    if (!v.name || !isValidBindingName(v.name)) continue;
    // keep 的 secret 值不可读，跳过写入（与 varsToBindings 一致）
    if (v.secret && v.keep) continue;
    if (!prod.env_vars) { prod.env_vars = {}; prev.env_vars = {}; }
    prod.env_vars[v.name] = { value: v.value, type: v.secret ? 'secret_text' : 'plain_text' };
    prev.env_vars[v.name] = { value: v.value, type: v.secret ? 'secret_text' : 'plain_text' };
  }
  for (const b of resolved as Array<Record<string, any>>) {
    if (b.type === 'kv_namespace') { if (!prod.kv_namespaces) { prod.kv_namespaces = {}; prev.kv_namespaces = {}; } prod.kv_namespaces[b.name] = { namespace_id: (b as any).namespace_id }; prev.kv_namespaces[b.name] = { namespace_id: (b as any).namespace_id }; }
    else if (b.type === 'd1') { if (!prod.d1_databases) { prod.d1_databases = {}; prev.d1_databases = {}; } prod.d1_databases[b.name] = { id: (b as any).id }; prev.d1_databases[b.name] = { id: (b as any).id }; }
    else if (b.type === 'r2_bucket') { if (!prod.r2_buckets) { prod.r2_buckets = {}; prev.r2_buckets = {}; } prod.r2_buckets[b.name] = { name: (b as any).bucket_name }; prev.r2_buckets[b.name] = { name: (b as any).bucket_name }; }
    else if (b.type === 'ai') { prod.ai = { binding: b.name }; prev.ai = { binding: b.name }; }
  }
  const hasConfigs = Object.keys(prod).length > 1;
  return hasConfigs ? { production: prod, preview: prev } : undefined;
}
