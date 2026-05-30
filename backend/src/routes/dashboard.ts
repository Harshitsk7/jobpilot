import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import * as ai from '../services/ai/tasks.js';
import { isAiEnabled } from '../services/ai/factory.js';

const router = Router();

function getDateFilter(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

router.get('/stats', async (req, res) => {
  const range = (req.query.range as string) ?? 'all';
  const dateFilter = getDateFilter(range);

  const where = dateFilter ? { createdAt: { gte: dateFilter } } : {};
  const appWhere = dateFilter ? { appliedAt: { gte: dateFilter } } : {};

  const [total, applied, reviewing, interview, rejected, bookmarked] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.count({ where: { ...where, status: 'applied' } }),
    prisma.job.count({ where: { ...where, status: 'reviewing' } }),
    prisma.job.count({ where: { ...where, status: 'interview' } }),
    prisma.job.count({ where: { ...where, status: 'rejected' } }),
    prisma.job.count({ where: { ...where, isBookmarked: true } }),
  ]);

  const byPlatform = await prisma.job.groupBy({
    by: ['platform'],
    where,
    _count: true,
  });

  const scoreBuckets = await prisma.job.findMany({
    where: { ...where, matchScore: { not: null } },
    select: { matchScore: true },
  });

  const distribution = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
  let scoreSum = 0;
  for (const j of scoreBuckets) {
    const s = j.matchScore ?? 0;
    scoreSum += s;
    if (s <= 25) distribution['0-25']++;
    else if (s <= 50) distribution['26-50']++;
    else if (s <= 75) distribution['51-75']++;
    else distribution['76-100']++;
  }
  const avgMatchScore = scoreBuckets.length > 0 ? Math.round(scoreSum / scoreBuckets.length) : null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const addedThisWeek = await prisma.job.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  const recentApps = await prisma.application.findMany({
    where: dateFilter ? { appliedAt: { gte: dateFilter } } : { appliedAt: { gte: sevenDaysAgo } },
    select: { appliedAt: true, status: true },
  });

  const dailyApps: Record<string, number> = {};
  const dailyAppliedArr: number[] = [];
  const dailyInterviewsArr: number[] = [];
  const dailyAppliedMap: Record<string, number> = {};
  const dailyInterviewMap: Record<string, number> = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyApps[key] = 0;
    dailyAppliedMap[key] = 0;
    dailyInterviewMap[key] = 0;
  }

  for (const a of recentApps) {
    const key = a.appliedAt.toISOString().slice(0, 10);
    if (dailyApps[key] !== undefined) dailyApps[key]++;
    if (dailyAppliedMap[key] !== undefined && a.status === 'success') dailyAppliedMap[key]++;
  }

  const recentInterviews = await prisma.job.findMany({
    where: { status: 'interview', updatedAt: { gte: sevenDaysAgo } },
    select: { updatedAt: true },
  });
  for (const j of recentInterviews) {
    const key = j.updatedAt.toISOString().slice(0, 10);
    if (dailyInterviewMap[key] !== undefined) dailyInterviewMap[key]++;
  }

  const keys = Object.keys(dailyAppliedMap).sort();
  const maxApplied = Math.max(...keys.map(k => dailyAppliedMap[k]), 1);
  const maxInterview = Math.max(...keys.map(k => dailyInterviewMap[k]), 1);
  for (const k of keys) {
    dailyAppliedArr.push(Math.round((dailyAppliedMap[k] / maxApplied) * 100));
    dailyInterviewsArr.push(Math.round((dailyInterviewMap[k] / maxInterview) * 100));
  }

  res.json({
    total,
    applied,
    reviewing,
    interview,
    rejected,
    bookmarked,
    inProgress: reviewing,
    byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count])),
    matchDistribution: distribution,
    dailyApplications: dailyApps,
    avgMatchScore,
    addedThisWeek,
    dailyApplied: dailyAppliedArr,
    dailyInterviews: dailyInterviewsArr,
  });
});

router.get('/activity', async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? '50', 10);
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(logs);
});

router.get('/notifications', async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const notifications = await prisma.notification.findMany({
    where: unreadOnly ? { read: false } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.patch('/notifications/:id/read', async (req, res) => {
  await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  res.json({ success: true });
});

router.patch('/notifications/read-all', async (_req, res) => {
  await prisma.notification.updateMany({ data: { read: true } });
  res.json({ success: true });
});

router.get('/export/csv', async (_req, res) => {
  const apps = await prisma.application.findMany({
    include: { job: true },
    orderBy: { appliedAt: 'desc' },
  });
  const header = 'Date,Job Title,Company,Platform,Status,Error\n';
  const rows = apps
    .map(
      (a) =>
        `${a.appliedAt.toISOString()},${escapeCsv(a.job.title)},${escapeCsv(a.job.company)},${a.platform},${a.status},${escapeCsv(a.errorMessage ?? '')}`
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
  res.send(header + rows);
});

router.get('/skill-gaps', async (_req, res) => {
  if (!await isAiEnabled()) return res.json({ gaps: [] });
  const base = await prisma.baseResume.findFirst({ where: { isActive: true } });
  const jobs = await prisma.job.findMany({ take: 20, select: { description: true } });
  if (!base) return res.json({ gaps: [] });
  const gaps = await ai.analyzeSkillGaps(
    base.contentText.slice(0, 3000),
    jobs.map((j) => j.description)
  );
  res.json({ gaps });
});

router.post('/reset', async (req, res) => {
  if (!req.body.confirm) {
    return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }.' });
  }
  await prisma.application.deleteMany();
  await prisma.tailoredResume.deleteMany();
  await prisma.coverLetter.deleteMany();
  await prisma.job.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  res.json({ success: true, message: 'Job data reset. Profile and credentials preserved.' });
});

function escapeCsv(s: string): string {
  let val = s.replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(val)) val = `\t${val}`;
  if (val.includes(',') || val.includes('"')) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

export default router;
