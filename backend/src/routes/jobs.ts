import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { upsertJobs } from '../services/jobs/processor.js';
import { getExpandedKeywords } from '../services/jobs/keyword-expansion.js';
import { searchLinkedInJobs, searchLinkedInFeedJobs } from '../services/scraper/linkedin.js';
import { searchNaukriJobs } from '../services/scraper/naukri.js';
import { notify, logActivity } from '../services/activity.js';

const router = Router();

function safeParseJson(val: string | null): unknown[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

const fetchSchema = z.object({
  title: z.string().min(1),
  keywords: z.string().optional(),
  location: z.string().optional(),
  experienceLevel: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  jobType: z.string().optional(),
  datePosted: z.string().optional(),
  platforms: z.array(z.enum(['linkedin', 'naukri'])).default(['linkedin', 'naukri']),
  includeFeedPosts: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  const {
    page = '1',
    limit = '20',
    sort = 'matchScore',
    order = 'desc',
    platform,
    status,
    bookmarked,
    minScore,
    search,
    applyType,
  } = req.query;

  const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
  const take = parseInt(limit as string, 10);

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (status) where.status = status;
  if (bookmarked === 'true') where.isBookmarked = true;
  if (minScore) where.matchScore = { gte: parseInt(minScore as string, 10) };
  if (applyType) where.applyType = applyType;
  if (search) {
    where.OR = [
      { title: { contains: search as string } },
      { company: { contains: search as string } },
    ];
  }

  const orderBy: Record<string, string> = {};
  const sortField = sort as string;
  if (['matchScore', 'postedDate', 'createdAt', 'title'].includes(sortField)) {
    orderBy[sortField] = order === 'asc' ? 'asc' : 'desc';
  } else {
    orderBy.matchScore = 'desc';
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({ where, orderBy, skip, take, include: { tailoredResume: true } }),
    prisma.job.count({ where }),
  ]);

  res.json({
    jobs: jobs.map((j) => ({
      ...j,
      matchRationale: safeParseJson(j.matchRationale),
      aiProcessing: j.aiSummary === 'Generating...',
    })),
    total,
    page: parseInt(page as string, 10),
    totalPages: Math.ceil(total / take),
  });
});

router.get('/:id', async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { tailoredResume: true, coverLetter: true, applications: true },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    ...job,
    matchRationale: safeParseJson(job.matchRationale),
  });
});

router.patch('/:id', async (req, res) => {
  const { status, isBookmarked } = req.body;
  const validStatuses = ['not_applied', 'reviewing', 'applied', 'interview', 'rejected'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(typeof isBookmarked === 'boolean' && { isBookmarked }),
    },
  });
  res.json(job);
});

router.post('/fetch', async (req, res) => {
  try {
    const params = fetchSchema.parse(req.body);
    const searchQuery = await prisma.searchQuery.create({
      data: {
        title: params.title,
        keywords: params.keywords,
        location: params.location,
        experienceLevel: params.experienceLevel,
        salaryMin: params.salaryMin,
        salaryMax: params.salaryMax,
        jobType: params.jobType,
        datePosted: params.datePosted,
        platforms: params.platforms.join(','),
      },
    });

    const searchParams = {
      title: params.title,
      keywords: params.keywords,
      location: params.location,
      experienceLevel: params.experienceLevel,
      jobType: params.jobType,
      datePosted: params.datePosted,
    };

    const allJobs: import('../services/jobs/processor.js').RawJob[] = [];
    const errors: string[] = [];

    const expandedKeywords = getExpandedKeywords(params.title);
    console.log(`[Fetch] Expanding "${params.title}" into ${expandedKeywords.length} search terms: ${expandedKeywords.join(', ')}`);

    const keywordResults = await Promise.allSettled(
      expandedKeywords.map(async (keyword) => {
        const variantParams = { ...searchParams, title: keyword };
        const platformPromises: Promise<import('../services/jobs/processor.js').RawJob[]>[] = [];

        if (params.platforms.includes('linkedin')) {
          platformPromises.push(
            searchLinkedInJobs(variantParams).catch((e) => {
              errors.push(`LinkedIn (${keyword}): ${e instanceof Error ? e.message : String(e)}`);
              return [];
            })
          );
        }
        if (params.platforms.includes('naukri')) {
          platformPromises.push(
            searchNaukriJobs(variantParams).catch((e) => {
              errors.push(`Naukri (${keyword}): ${e instanceof Error ? e.message : String(e)}`);
              return [];
            })
          );
        }

        const results = await Promise.all(platformPromises);
        return results.flat();
      })
    );

    for (const result of keywordResults) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      }
    }

    if (params.platforms.includes('linkedin') && params.includeFeedPosts) {
      try {
        const feedJobs = await searchLinkedInFeedJobs(searchParams);
        allJobs.push(...feedJobs);
        if (feedJobs.length > 0) {
          console.log(`[Feed] Found ${feedJobs.length} jobs from LinkedIn feed posts`);
        }
      } catch (e) {
        console.log(`[Feed] LinkedIn feed scraping failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const added = await upsertJobs(allJobs, searchQuery.id);
    await notify('Jobs fetched', `${added} new jobs from ${params.platforms.join(', ')}`, 'success');

    res.json({
      added,
      total: allJobs.length,
      errors,
      searchQueryId: searchQuery.id,
      expandedKeywords: expandedKeywords.length > 1 ? expandedKeywords : undefined,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/:id/bookmark', async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Not found' });
  const updated = await prisma.job.update({
    where: { id: req.params.id },
    data: { isBookmarked: !job.isBookmarked },
  });
  res.json(updated);
});

export default router;
