import { Router } from 'express';
import { config } from '../config';
import { clearCache } from '../services/accountRouter';
import { clearClientCache } from '../services/cfFactory';
import { getProxyUrl, setProxyUrl, isProxyEnabled, setProxyEnabled, testProxyConnection, getResinConfig, setResinConfig, testResinConnection } from '../services/proxyService';
import { VERSION, GIT_COMMIT } from '../version';

const router = Router();

router.get('/', (_req, res) => {
  const resin = getResinConfig();
  res.json({
    encryption_key_configured: !!config.encryptionKey,
    api_secret_configured: !!config.apiSecret,
    demo_account_ids: config.demoAccountIds || '',
    db_path: config.dbPath,
    proxy_url: getProxyUrl(),
    proxy_enabled: isProxyEnabled(),
    resin_enabled: resin.enabled,
    resin_url: resin.url,
    resin_token: resin.token ? '***' : '',
    resin_platform: resin.platform,
    platform: 'node-backend',
    version: VERSION,
    git_commit: GIT_COMMIT,
  });
});

router.post('/cache/clear', (_req, res) => {
  clearCache();
  clearClientCache();
  res.json({ success: true, message: 'All caches cleared (zones, quota, SDK clients)' });
});

router.put('/proxy', (req, res) => {
  const { proxy_url, proxy_enabled } = req.body;
  if (proxy_url !== undefined) {
    if (typeof proxy_url !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'proxy_url must be a string' } });
      return;
    }
    setProxyUrl(proxy_url);
  }
  if (proxy_enabled !== undefined) {
    setProxyEnabled(!!proxy_enabled);
  }
  clearClientCache();
  res.json({ success: true, proxy_url: getProxyUrl(), proxy_enabled: isProxyEnabled() });
});

router.post('/proxy/test', async (req, res) => {
  const { proxy_url } = req.body;
  const url = typeof proxy_url === 'string' ? proxy_url : getProxyUrl();
  if (!url) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No proxy URL to test' } });
    return;
  }
  try {
    const result = await testProxyConnection(url);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(502).json({ error: { code: 'PROXY_TEST_FAILED', message: err.message || 'Proxy test failed' } });
  }
});

// ---- Resin 代理池 ----

router.put('/resin', (req, res) => {
  const { enabled, url, token, platform } = req.body;
  const cfg: any = {};
  if (enabled !== undefined) cfg.enabled = !!enabled;
  if (url !== undefined) cfg.url = typeof url === 'string' ? url : '';
  if (token !== undefined) cfg.token = typeof token === 'string' ? token : '';
  if (platform !== undefined) cfg.platform = typeof platform === 'string' ? platform : 'Default';
  setResinConfig(cfg);
  clearClientCache();
  const updated = getResinConfig();
  res.json({ success: true, ...updated, token: updated.token ? '***' : '' });
});

router.post('/resin/test', async (_req, res) => {
  try {
    const result = await testResinConnection();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(502).json({ error: { code: 'RESIN_TEST_FAILED', message: err.message || 'Resin test failed' } });
  }
});

export default router;
