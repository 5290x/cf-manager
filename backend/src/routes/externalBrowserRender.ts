import { Router } from 'express';
import { handleBrowserRender } from '../services/browserRenderHandler';
import { getBrowserRenderStatus } from '../services/browserRateLimiter';

const router = Router();

router.post('/render', async (req, res, next) => {
  try {
    const { url, mode, browser, accountId } = req.body;
    const { status, body } = await handleBrowserRender({ url, mode, browser, accountId });
    res.status(status).json(body);
  } catch (err) { next(err); }
});

router.get('/status', (_req, res) => {
  res.json(getBrowserRenderStatus());
});

export default router;
