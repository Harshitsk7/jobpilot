import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const router = Router();

const profileUpdateSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  currentLocation: z.string().optional(),
  willingToRelocate: z.boolean().optional(),
  yearsExperience: z.number().optional(),
  currentRole: z.string().optional(),
  currentCompany: z.string().optional(),
  education: z.string().optional(),
  skills: z.string().optional(),
  preferredSalaryMin: z.number().nullable().optional(),
  preferredSalaryMax: z.number().nullable().optional(),
  preferredJobTypes: z.string().optional(),
  preferredLocations: z.string().optional(),
  aiEnabled: z.boolean().optional(),
}).strict();

router.get('/', async (_req, res) => {
  let profile = await prisma.userProfile.findUnique({ where: { id: 'default' } });
  if (!profile) {
    profile = await prisma.userProfile.create({ data: { id: 'default' } });
  }
  res.json(profile);
});

router.put('/', async (req, res) => {
  try {
    const data = profileUpdateSchema.parse(req.body);
    const profile = await prisma.userProfile.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid profile data' });
  }
});

export default router;
