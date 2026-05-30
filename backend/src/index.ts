import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { config } from './lib/config.js';
import { ensureDataDirs } from './services/resume/parser.js';
import { prisma } from './lib/prisma.js';

import credentialsRouter from './routes/credentials.js';
import jobsRouter from './routes/jobs.js';
import resumeRouter from './routes/resume.js';
import profileRouter from './routes/profile.js';
import applyRouter from './routes/apply.js';
import dashboardRouter from './routes/dashboard.js';
import aiRouter from './routes/ai.js';
import atsRouter from './routes/ats.js';
import { getLLMProvider, isAiEnabled } from './services/ai/factory.js';
import { closeBrowser } from './services/scraper/base.js';

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001'] }));
app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const heavyLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });

app.use('/api', apiLimiter);
app.use('/api/jobs/fetch', heavyLimiter);
app.use('/api/apply', heavyLimiter);
app.use('/api/ats', heavyLimiter);
app.use('/api/dashboard/reset', heavyLimiter);

app.get('/api/health', async (_req, res) => {
  const llm = getLLMProvider();
  const aiEnabled = await isAiEnabled();
  res.json({
    status: 'ok',
    disclaimer:
      'JobPilot AI is for personal use only. You are responsible for complying with LinkedIn and Naukri Terms of Service.',
    llmConfigured: llm.isConfigured(),
    aiEnabled,
    hasEncryption: config.encryptionSecret.length >= 32,
  });
});

app.use('/api/credentials', credentialsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/resume', resumeRouter);
app.use('/api/profile', profileRouter);
app.use('/api/apply', applyRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ats', atsRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

async function bootstrap() {
  await ensureDataDirs(config.dataDir, config.resumesDir, config.uploadsDir, config.sessionsDir);

  await prisma.userProfile.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  for (const platform of ['linkedin', 'naukri']) {
    const exists = await prisma.platformCredential.findUnique({ where: { platform } });
    if (!exists) {
      await prisma.platformCredential.create({
        data: { platform, encryptedData: 'pending', status: 'disconnected' },
      }).catch(() => {});
    }
  }

  app.listen(config.port, () => {
    console.log(`JobPilot API running on http://localhost:${config.port}`);
    const llm = getLLMProvider();
    if (!llm.isConfigured()) {
      console.warn(`⚠ LLM provider "${config.llmProvider}" not configured — AI features disabled`);
    } else {
      console.log(`✓ LLM provider: ${llm.name} (model: ${config.llmProvider === 'anthropic' ? config.claudeModel : config.copilotModel})`);
    }
    if (config.encryptionSecret.length < 32) {
      console.warn('⚠ ENCRYPTION_SECRET must be 32+ chars for credential storage');
    }
  });
}

bootstrap().catch(console.error);

process.on('SIGINT', async () => {
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
});
