import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { applyToJob, applyToAllJobs, getApplyProgress } from '../services/apply/agent.js';

const router = Router();

router.post('/job/:jobId', async (req, res) => {
  try {
    const result = await applyToJob(req.params.jobId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/batch', async (req, res) => {
  const schema = z.object({ jobIds: z.array(z.string()).optional() });
  const { jobIds } = schema.parse(req.body);

  let ids = jobIds;
  if (!ids?.length) {
    const jobs = await prisma.job.findMany({
      where: { status: { notIn: ['applied', 'rejected'] } },
      take: 20,
    });
    ids = jobs.map((j) => j.id);
  }

  const batchId = await applyToAllJobs(ids);
  res.json({ batchId, count: ids.length });
});

router.get('/progress/:batchId', (req, res) => {
  res.json(getApplyProgress(req.params.batchId));
});

router.get('/history', async (req, res) => {
  const apps = await prisma.application.findMany({
    include: { job: true },
    orderBy: { appliedAt: 'desc' },
    take: 100,
  });
  res.json(apps);
});

router.post('/job/:jobId/mark-applied', async (req, res) => {
  await prisma.job.update({
    where: { id: req.params.jobId },
    data: { status: 'applied' },
  });
  await prisma.application.create({
    data: {
      jobId: req.params.jobId,
      platform: 'manual',
      status: 'success',
    },
  });
  res.json({ success: true });
});

export default router;
