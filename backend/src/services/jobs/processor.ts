import { prisma } from '../../lib/prisma.js';
import { aiQueue } from '../queue.js';
import * as ai from '../ai/tasks.js';
import { isAiEnabled } from '../ai/factory.js';
import { logActivity, notify } from '../activity.js';
import { normalizeDedupeKey } from '../resume/parser.js';

export interface RawJob {
  externalId?: string;
  platform: 'linkedin' | 'naukri';
  title: string;
  company: string;
  companyLogo?: string;
  location?: string;
  salary?: string;
  jobType?: string;
  experienceLevel?: string;
  applyType?: 'easy_apply' | 'external' | 'unknown';
  postedDate?: Date;
  url: string;
  description: string;
}

export async function upsertJobs(rawJobs: RawJob[], searchQueryId?: string): Promise<number> {
  let added = 0;
  const baseResume = await prisma.baseResume.findFirst({ where: { isActive: true } });

  for (const raw of rawJobs) {
    const dedupeKey = normalizeDedupeKey(raw.title, raw.company);
    const existing = await prisma.job.findFirst({ where: { dedupeKey } });

    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          description: raw.description || existing.description,
          salary: raw.salary ?? existing.salary,
          url: raw.url,
          applyType: raw.applyType ?? existing.applyType,
        },
      });
      continue;
    }

    const job = await prisma.job.create({
      data: {
        externalId: raw.externalId,
        platform: raw.platform,
        title: raw.title,
        company: raw.company,
        companyLogo: raw.companyLogo,
        location: raw.location,
        salary: raw.salary,
        jobType: raw.jobType,
        experienceLevel: raw.experienceLevel,
        postedDate: raw.postedDate,
        url: raw.url,
        description: raw.description,
        dedupeKey,
        searchQueryId,
        applyType: raw.applyType ?? 'unknown',
        aiSummary: null,
        matchScore: null,
      },
    });
    added++;

    if (await isAiEnabled()) {
      void aiQueue.enqueue(async () => {
        await processJobAi(job.id, raw.description, baseResume?.contentText ?? '');
      });
    }
  }

  await logActivity('fetch', `Stored ${added} new jobs (${rawJobs.length} fetched)`);
  return added;
}

async function processJobAi(jobId: string, description: string, resumeText: string): Promise<void> {
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: { aiSummary: 'Generating...' },
    });

    const [summary, match] = await Promise.all([
      ai.summarizeJob(description).catch(() => 'Summary unavailable'),
      resumeText
        ? ai.scoreMatch(resumeText, description).catch(() => ({
            score: 0,
            rationale: ['Upload a base resume for match scoring'],
          }))
        : Promise.resolve({ score: 0, rationale: ['No base resume uploaded'] }),
    ]);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        aiSummary: summary,
        matchScore: match.score,
        matchRationale: JSON.stringify(match.rationale),
      },
    });

    await notify('AI analysis complete', `Job insights ready`, 'success', jobId);
  } catch (err) {
    await logActivity('error', 'AI processing failed', {
      jobId,
      error: String(err),
    });
  }
}

export async function tailorResumeForJob(jobId: string): Promise<string> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const base = await prisma.baseResume.findFirst({ where: { isActive: true } });
  if (!base) throw new Error('Upload a base resume first');

  await prisma.tailoredResume.upsert({
    where: { jobId },
    create: { jobId, contentText: '', aiProcessing: true },
    update: { aiProcessing: true },
  });

  const tailored = await ai.tailorResume(base.contentText, job.description);

  await prisma.tailoredResume.upsert({
    where: { jobId },
    create: { jobId, contentText: tailored, aiProcessing: false },
    update: {
      contentText: tailored,
      aiProcessing: false,
      version: { increment: 1 },
    },
  });

  await notify('Resume tailored', `Resume ready for ${job.title}`, 'success', jobId);
  await logActivity('resume', `Tailored resume for ${job.title}`, { jobId });
  return tailored;
}
