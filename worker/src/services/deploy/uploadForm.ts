import type { CfWorkerInit, CfModuleType } from './types';

// 模块类型 → MIME 映射（对齐 wrangler moduleTypeMimeType）
const MODULE_MIME: Record<CfModuleType, string> = {
  'esm': 'application/javascript+module',
  'commonjs': 'application/javascript',
  'compiled-wasm': 'application/wasm',
  'text': 'text/plain',
  'buffer': 'application/octet-stream',
};

export interface MultipartBody {
  body: Uint8Array;
  contentType: string;
}

// 将 string / Uint8Array 安全转换为独立 Uint8Array（拷贝，不共享底层内存）
function toUint8Array(content: string | Uint8Array): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  // 必须拷贝，避免 Uint8Array 视图共享底层 ArrayBuffer 导致 content-length 不匹配
  const copy = new Uint8Array(content.byteLength);
  copy.set(content);
  return copy;
}

/**
 * 手动构建 multipart/form-data body（Worker 版）。
 *
 * 不使用 FormData + undici 自动序列化，因为 undici 在计算 multipart Content-Length 时
 * 可能与实际 body 不一致（尤其当 Blob 部分由 ArrayBuffer 支撑时），
 * 导致 Cloudflare API 返回截断响应 → UND_ERR_RES_CONTENT_LENGTH_MISMATCH。
 *
 * 手动构建可精确控制每个 part 的字节，concat 后 Content-Length 完全确定。
 */
export function createWorkerUploadForm(
  worker: CfWorkerInit,
  bindings: Record<string, unknown>[] | undefined,
): MultipartBody {
  const boundary = '----formdata-cf-manager-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const CRLF = '\r\n';

  // 1. 构建 metadata
  const metadataBindings = bindings || [];
  const metadata: Record<string, unknown> = {
    main_module: worker.main.name,
    compatibility_date: worker.compatibility_date,
    bindings: metadataBindings,
  };
  // 仅在非空时发送 compatibility_flags（对标 wrangler：空数组不发送）
  if (worker.compatibility_flags?.length) metadata.compatibility_flags = worker.compatibility_flags;

  if (worker.migrations?.length) metadata.migrations = worker.migrations;
  if (worker.keepVars) metadata.keep_vars = true;
  if (worker.keepSecrets) metadata.keep_secrets = true;
  // keep_bindings: CF API 期望 []string（要保留的绑定类型列表），不是 boolean
  if (worker.keepBindings) {
    metadata.keep_bindings = [
      'kv_namespace', 'd1', 'r2_bucket',
      'service', 'queue', 'durable_object_namespace',
      'ai', 'assets', 'secret_text', 'plain_text',
    ];
  }
  if (worker.placement) metadata.placement = worker.placement;
  if (worker.tail_consumers?.length) metadata.tail_consumers = worker.tail_consumers;
  if (worker.limits) metadata.limits = worker.limits;
  if (worker.logpush !== undefined) metadata.logpush = worker.logpush;
  if (worker.assets) metadata.assets = worker.assets;
  if (worker.observability) metadata.observability = worker.observability;

  // 辅助：将字符串推入 parts
  const pushStr = (s: string) => parts.push(encoder.encode(s));

  // 2. 添加 metadata part
  pushStr(`--${boundary}${CRLF}`);
  pushStr(`Content-Disposition: form-data; name="metadata"${CRLF}`);
  pushStr(`Content-Type: application/json${CRLF}${CRLF}`);
  parts.push(encoder.encode(JSON.stringify(metadata)));

  // 3. 添加主模块
  const mainContent = toUint8Array(worker.main.content);
  pushStr(`${CRLF}--${boundary}${CRLF}`);
  pushStr(`Content-Disposition: form-data; name="${worker.main.name}"; filename="${worker.main.name}"${CRLF}`);
  pushStr(`Content-Type: ${MODULE_MIME[worker.main.type]}${CRLF}${CRLF}`);
  parts.push(mainContent);

  // 4. 添加附加模块
  for (const mod of worker.modules) {
    const content = toUint8Array(mod.content);
    pushStr(`${CRLF}--${boundary}${CRLF}`);
    pushStr(`Content-Disposition: form-data; name="${mod.name}"; filename="${mod.name}"${CRLF}`);
    pushStr(`Content-Type: ${MODULE_MIME[mod.type]}${CRLF}${CRLF}`);
    parts.push(content);
  }

  // 5. 添加 source maps
  for (const sm of worker.sourceMaps) {
    const content = toUint8Array(sm.content);
    pushStr(`${CRLF}--${boundary}${CRLF}`);
    pushStr(`Content-Disposition: form-data; name="${sm.name}"; filename="${sm.name}"${CRLF}`);
    pushStr(`Content-Type: application/json${CRLF}${CRLF}`);
    parts.push(content);
  }

  // 6. 结束边界
  pushStr(`${CRLF}--${boundary}--${CRLF}`);

  // 拼接所有 parts 为一个连续的 Uint8Array
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    body.set(p, offset);
    offset += p.length;
  }

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}
