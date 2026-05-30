import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../lib/prisma.js';
import { config } from '../lib/config.js';
import { extractTextFromFile, ensureDataDirs } from '../services/resume/parser.js';
import { tailorResumeForJob } from '../services/jobs/processor.js';
import { computeResumeDiff } from '../services/resume/diff.js';
import { exportToDocx } from '../services/resume/export.js';
import { aiQueue } from '../services/queue.js';
import * as ai from '../services/ai/tasks.js';
import { isAiEnabled } from '../services/ai/factory.js';

const router = Router();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureDataDirs(config.uploadsDir, config.resumesDir);
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'application/x-tex', 'text/x-tex', 'application/x-latex'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedMimes.includes(file.mimetype));
  },
});

router.get('/base', async (_req, res) => {
  const resumes = await prisma.baseResume.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(resumes);
});

router.post('/base', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const text = await extractTextFromFile(req.file.path, req.file.mimetype);
    const dest = path.join(config.resumesDir, req.file.filename);
    await fs.copyFile(req.file.path, dest);

    const label = (req.body.label as string) || 'Primary';
    const setActive = req.body.setActive !== 'false';

    if (setActive) {
      await prisma.baseResume.updateMany({ data: { isActive: false } });
    }

    const resume = await prisma.baseResume.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        contentText: text,
        filePath: dest,
        label,
        isActive: setActive,
      },
      update: {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        contentText: text,
        filePath: dest,
        label,
        isActive: setActive,
      },
    });
    res.json(resume);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/job/:jobId', async (req, res) => {
  const tailored = await prisma.tailoredResume.findUnique({
    where: { jobId: req.params.jobId },
  });
  const base = await prisma.baseResume.findFirst({ where: { isActive: true } });
  res.json({ tailored, baseText: base?.contentText?.slice(0, 500) });
});

router.post('/job/:jobId/tailor', async (req, res) => {
  if (!await isAiEnabled()) {
    return res.status(400).json({ error: 'AI mode is disabled. Enable AI in Settings to use this feature.' });
  }
  const jobId = req.params.jobId;
  void aiQueue.enqueue(() => tailorResumeForJob(jobId));
  res.json({ status: 'processing', message: 'Resume tailoring started' });
});

router.post('/job/:jobId/tailor/sync', async (req, res) => {
  if (!await isAiEnabled()) {
    return res.status(400).json({ error: 'AI mode is disabled. Enable AI in Settings to use this feature.' });
  }
  try {
    const text = await tailorResumeForJob(req.params.jobId);
    res.json({ contentText: text });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.put('/job/:jobId', async (req, res) => {
  const { contentText } = req.body;
  const tailored = await prisma.tailoredResume.upsert({
    where: { jobId: req.params.jobId },
    create: { jobId: req.params.jobId, contentText },
    update: { contentText },
  });
  res.json(tailored);
});

router.post('/job/:jobId/upload', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const jobId = req.params.jobId as string;
  const text = await extractTextFromFile(req.file.path, req.file.mimetype);
  const tailored = await prisma.tailoredResume.upsert({
    where: { jobId },
    create: {
      jobId,
      contentText: text,
      customFilePath: req.file.path,
    },
    update: { contentText: text, customFilePath: req.file!.path },
  });
  res.json(tailored);
});

router.get('/job/:jobId/diff', async (req, res) => {
  const base = await prisma.baseResume.findFirst({ where: { isActive: true } });
  const tailored = await prisma.tailoredResume.findUnique({ where: { jobId: req.params.jobId } });
  if (!base || !tailored) return res.status(404).json({ error: 'Resume not found' });
  const diff = computeResumeDiff(base.contentText, tailored.contentText);
  res.json({ diff });
});

router.get('/job/:jobId/download', async (req, res) => {
  const format = (typeof req.query.format === 'string' ? req.query.format : 'docx');
  const tailored = await prisma.tailoredResume.findUnique({ where: { jobId: req.params.jobId } });
  const base = await prisma.baseResume.findFirst({ where: { isActive: true } });
  const content = tailored?.contentText ?? base?.contentText;
  if (!content) return res.status(404).json({ error: 'No resume content' });

  if (format === 'docx') {
    const out = path.join(config.resumesDir, `tailored-${req.params.jobId}.docx`);
    await exportToDocx(content, out);
    return res.download(out);
  }
  res.type('text/plain').send(content);
});

router.post('/job/:jobId/cover-letter', async (req, res) => {
  if (!await isAiEnabled()) {
    return res.status(400).json({ error: 'AI mode is disabled. Enable AI in Settings to use this feature.' });
  }
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const profile = await prisma.userProfile.findUnique({ where: { id: 'default' } });
  const letter = await ai.generateCoverLetter(
    { fullName: profile?.fullName ?? '', currentRole: profile?.currentRole ?? '' },
    { title: job.title, company: job.company, description: job.description }
  );
  await prisma.coverLetter.upsert({
    where: { jobId: req.params.jobId },
    create: { jobId: req.params.jobId, content: letter },
    update: { content: letter },
  });
  res.json({ content: letter });
});

router.get('/job/:jobId/interview-prep', async (req, res) => {
  if (!await isAiEnabled()) {
    return res.status(400).json({ error: 'AI mode is disabled. Enable AI in Settings to use this feature.' });
  }
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const questions = await ai.generateInterviewQuestions(job.description);
  res.json({ questions });
});

export default router;
