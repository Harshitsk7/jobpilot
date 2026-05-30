import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../services/encryption.js';
import { testLinkedInConnection } from '../services/scraper/linkedin.js';
import { testNaukriConnection } from '../services/scraper/naukri.js';
import { loginViaBrowser } from '../services/scraper/base.js';

const router = Router();

const credSchema = z.object({
  platform: z.enum(['linkedin', 'naukri']),
  username: z.string().min(1),
  password: z.string().min(1),
});

router.get('/', async (_req, res) => {
  const creds = await prisma.platformCredential.findMany();
  res.json(
    creds.map((c) => ({
      platform: c.platform,
      status: c.status,
      lastTestedAt: c.lastTestedAt,
      lastError: c.lastError,
      hasCredentials:
        !!c.encryptedData && c.encryptedData.length > 10 && c.encryptedData !== 'pending',
    }))
  );
});

router.post('/', async (req, res) => {
  try {
    const { platform, username, password } = credSchema.parse(req.body);
    const encryptedData = encrypt(JSON.stringify({ username, password }));
    await prisma.platformCredential.upsert({
      where: { platform },
      create: { platform, encryptedData, status: 'disconnected' },
      update: { encryptedData, status: 'disconnected', lastError: null },
    });
    res.json({ success: true, platform });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/test/:platform', async (req, res) => {
  const platform = req.params.platform;
  try {
    if (platform === 'linkedin') {
      const result = await testLinkedInConnection();
      return res.json(result);
    }
    if (platform === 'naukri') {
      const result = await testNaukriConnection();
      return res.json(result);
    }
    res.status(400).json({ error: 'Invalid platform' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Connection test failed' });
  }
});

router.post('/browser-login/:platform', async (req, res) => {
  const platform = req.params.platform as 'linkedin' | 'naukri';
  if (platform !== 'linkedin' && platform !== 'naukri') {
    return res.status(400).json({ error: 'Invalid platform' });
  }
  try {
    const result = await loginViaBrowser(platform);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/:platform', async (req, res) => {
  const platform = req.params.platform;
  if (platform !== 'linkedin' && platform !== 'naukri') {
    return res.status(400).json({ error: 'Invalid platform' });
  }
  await prisma.platformCredential.deleteMany({ where: { platform } });
  res.json({ success: true });
});

export default router;
