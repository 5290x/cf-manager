import type { Account } from '../db/models';
import { cfFetch, cfFetchRaw } from './cfApi';
import { computeStaticAssetHash, extractZipFiles, uint8ToBase64 } from './staticAssets';

// 递归展开 error.cause 链，拼出完整原因。fetch 失败时顶层 message 常为 "fetch failed"，
// 真正原因（ECONNRESET / ETIMEDOUT / ENOTFOUND / certificate ...）藏在 err.cause 里。
export function describeError(err: any): string {
  const parts: string[] = [];
  let cur: any = err;
  const seen = new Set<any>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const seg = [cur.code, cur.message].filter(Boolean).join(' ');
    if (seg && !parts.includes(seg)) parts.push(seg);
    cur = cur.cause;
  }
  return parts.join(' <- ') || String(err);
}



// 推断多模块入口文件名（对称于 backend resolveMainModule）
function resolveMainModule(modules: Array<{ path: string; buffer: Uint8Array }> | null, explicit?: string): string {
  if (explicit) return explicit;
  if (!modules || modules.length === 0) return 'worker.js';
  const conf = modules.find(m => /^wrangler\.(toml|jsonc|json)$/i.test(m.path));
  if (conf) {
    const txt = new TextDecoder().decode(conf.buffer);
    const m = txt.match(/^\s*main\s*=\s*"([^"]+)"/m) || txt.match(/"main"\s*:\s*"([^"]+)"/m);
    if (m) return m[1].replace(/^\.\//, '');
  }
  if (modules.length === 1) return modules[0].path;
  const candidates = ['worker.js', 'index.js', 'index.mjs', 'worker.mjs', 'index.cjs', 'worker.cjs'];
  for (const c of candidates) {
    if (modules.some(m => m.path === c)) return c;
  }
  const root = modules.find(m => /^[^/\\]+\.(m?js|cjs)$/i.test(m.path));
  if (root) return root.path;
  return 'worker.js';
}

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// 构造 Workers Assets manifest：路径以 "/" 开头，hash 与 backend workerService.computeStaticAssetHash 一致。
export async function buildAssetsManifest(
  files: Array<{ path: string; buffer: Uint8Array }>,
): Promise<Record<string, { hash: string; size: number }>> {
  const manifest: Record<string, { hash: string; size: number }> = {};
  for (const f of files) {
    const key = '/' + f.path.replace(/\\/g, '/').replace(/^\/+/, '');
    manifest[key] = { hash: await computeStaticAssetHash(f.buffer, f.path), size: f.buffer.length };
  }
  return manifest;
}

// 三阶段上传之：manifest 会话 → base64 multipart 逐文件上传 → 取 completion jwt。
async function deployWorkerAssets(
  account: Account, encryptionKey: string, scriptName: string,
  files: Array<{ path: string; buffer: Uint8Array }>,
): Promise<{ jwt: string }> {
  const accountId = account.account_id;
  const sessionResp: any = await cfFetch(account, `/accounts/${accountId}/workers/scripts/${scriptName}/assets-upload-session`, encryptionKey, {
    method: 'POST', body: JSON.stringify({ manifest: await buildAssetsManifest(files) }),
  });
  const uploadJwt: string = sessionResp?.result?.jwt;
  if (!uploadJwt) throw new Error(`assets-upload-session failed: ${JSON.stringify(sessionResp)}`);

  const upForm = new FormData();
  for (const f of files) {
    const hash = await computeStaticAssetHash(f.buffer, f.path);
    upForm.append(hash, new Blob([uint8ToBase64(f.buffer)], { type: 'application/octet-stream' }), hash);
  }
  const upResp = await fetch(`${CF_API_BASE}/accounts/${accountId}/workers/assets/upload?base64=true`, {
    method: 'POST', headers: { Authorization: `Bearer ${uploadJwt}` }, body: upForm,
  });
  if (!upResp.ok) { const txt = await upResp.text(); throw new Error(`assets upload failed: ${upResp.status} ${txt}`); }
  const upJson = await upResp.json() as any;
  const completionJwt: string = upJson.jwt ?? upJson.result?.jwt;
  if (!completionJwt) throw new Error(`assets upload missing jwt: ${JSON.stringify(upJson)}`);
  return { jwt: completionJwt };
}

// 对称于 backend workerService.deployWorker：PUT worker.js（或 packageZip 多模块）+ 可选 assets（三阶段注入 ASSETS 绑定）。
export async function deployWorker(
  account: Account, encryptionKey: string, name: string, content: Uint8Array,
  options?: { bindings?: any[]; env?: Record<string, string>; assets?: any; assetsBuffer?: Uint8Array; packageZip?: Uint8Array; mainModule?: string },
): Promise<void> {
  const accountId = account.account_id;
  // 多模块：若提供 packageZip，本地解压为多个模块文件（与 wrangler 行为一致）。
  const moduleParts = options?.packageZip ? await extractZipFiles(options.packageZip) : null;
  const mainModule = resolveMainModule(moduleParts, options?.mainModule);
  const metadata: Record<string, unknown> = {
    main_module: moduleParts && moduleParts.length > 0 ? mainModule : 'worker.js',
    compatibility_date: '2024-01-01',
    bindings: options?.bindings || [],
  };
  if (options?.env) {
    metadata.bindings = [
      ...(options.bindings || []),
      ...Object.entries(options.env).map(([k, v]) => ({ type: 'plain_text', name: k, text: v })),
    ];
  }
  if (options?.assets) {
    let assetContent: Uint8Array;
    if (options.assetsBuffer) {
      assetContent = options.assetsBuffer;
    } else {
      const r = await fetch(options.assets.source.url);
      assetContent = new Uint8Array(await r.arrayBuffer());
    }
    const assetFiles = options.assets.source.kind === 'raw'
      ? [{ path: options.assets.source.url.split('/').pop() || 'asset', buffer: assetContent }]
      : await extractZipFiles(assetContent);
    const { jwt } = await deployWorkerAssets(account, encryptionKey, name, assetFiles);
    metadata.assets = { jwt, config: options.assets.config || undefined };
    metadata.bindings = [...(metadata.bindings as any[]), { name: options.assets.binding || 'ASSETS', type: 'assets' }];
  }
  // 多模块 zip（如 React Router on Workers）解压出的每个文件都要作为 Worker 模块上传：
  // index.js 入口会 import assets/*.js 等代码分片，必须随脚本一起上传，否则 CF 报 "No such module"。
  // 静态资源（assets 绑定）由上面的 deployWorkerAssets 单独上传，是两条独立通道，不要在此排除 assets/。
  const moduleFiles = moduleParts;

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  if (moduleFiles && moduleFiles.length > 0) {
    if (!moduleFiles.some(m => m.path === mainModule)) {
      throw new Error(`main_module "${mainModule}" 未在 zip 模块中找到（已包含: ${moduleFiles.map(m => m.path).join(', ')}）`);
    }
    for (const m of moduleFiles) {
      const isJs = /\.(m?js|cjs)$/i.test(m.path);
      form.append(m.path, new Blob([m.buffer], { type: isJs ? 'application/javascript+module' : 'application/octet-stream' }), m.path);
    }
  } else {
    form.append('worker.js', new Blob([content], { type: 'application/javascript+module' }), 'worker.js');
  }
  let resp: any;
  try {
    resp = await cfFetchRaw(account, `/accounts/${accountId}/workers/scripts/${name}`, encryptionKey, { method: 'PUT', body: form });
  } catch (err: any) {
    throw new Error(`worker-script-upload failed: ${describeError(err)}`);
  }
  if (!resp.ok) { const errBody = await resp.text(); throw new Error(`Worker 部署失败 (${resp.status}): ${errBody}`); }
  // 启用 workers.dev 子域，使 Worker 立即可访问（与 backend deployWorker 行为一致）
  try {
    await cfFetch(account, `/accounts/${accountId}/workers/scripts/${name}/subdomain`, encryptionKey, {
      method: 'POST', body: JSON.stringify({ enabled: true, previews_enabled: true }),
    });
  } catch (_) { /* soft fail */ }
}
