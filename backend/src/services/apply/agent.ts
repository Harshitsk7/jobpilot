import { Page } from 'playwright';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../lib/config.js';
import { getBrowser, loadSession, getCredentials, detectCaptcha, waitForCaptchaSolve } from '../scraper/base.js';
import { applyQueue, randomDelay } from '../queue.js';
import { logActivity, notify } from '../activity.js';
import * as ai from '../ai/tasks.js';
import { isAiEnabled } from '../ai/factory.js';

export interface ApplyProgress {
  jobId: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'manual';
  error?: string;
}

const applyProgressStore = new Map<string, { progress: ApplyProgress[]; createdAt: number }>();

export function getApplyProgress(id: string): ApplyProgress[] {
  return applyProgressStore.get(id)?.progress ?? [];
}

export async function applyToJob(jobId: string): Promise<{ status: string; message: string }> {
  return applyQueue.enqueue(() => applyToJobInternal(jobId));
}

async function applyToJobInternal(jobId: string): Promise<{ status: string; message: string }> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const profile = await prisma.userProfile.findUnique({ where: { id: 'default' } });
  const tailored = await prisma.tailoredResume.findUnique({ where: { jobId } });
  const base = await prisma.baseResume.findFirst({ where: { isActive: true } });

  const existingApp = await prisma.application.findFirst({
    where: { jobId, status: 'success' },
  });
  if (existingApp) {
    return { status: 'skipped', message: 'Already applied to this job' };
  }

  if (!profile?.email) {
    return { status: 'failed', message: 'Complete your profile in Settings first' };
  }

  await randomDelay(config.applyDelayMinMs, config.applyDelayMaxMs);

  const browser = await getBrowser();
  const context = await browser.newContext();
  let result: { status: string; message: string } = { status: 'failed', message: 'Unknown' };

  try {
    await loadSession(context, job.platform as 'linkedin' | 'naukri');
    const page = await context.newPage();
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    if (await detectCaptcha(page)) {
      await notify('CAPTCHA detected', `Solve in the browser window to continue — ${job.title}`, 'warning', jobId);
      const solved = await waitForCaptchaSolve(page, 120000);
      if (solved) {
        await notify('CAPTCHA solved', 'Continuing application...', 'success', jobId);
        result = await attemptAutoApply(page, job, profile, tailored, base);
      } else {
        result = {
          status: 'manual',
          message: 'CAPTCHA timeout — complete manually in browser',
        };
      }
    } else {
      result = await attemptAutoApply(page, job, profile, tailored, base);
    }
  } catch (err) {
    result = {
      status: 'failed',
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await context.close();
  }

  await prisma.application.create({
    data: {
      jobId,
      platform: job.platform,
      status: result.status,
      resumeUsed: tailored?.contentText?.slice(0, 200) ?? base?.fileName,
      errorMessage: result.status !== 'success' ? result.message : null,
    },
  });

  if (result.status === 'success') {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'applied' } });
    await notify('Application submitted', `${job.title} at ${job.company}`, 'success', jobId);
  } else if (result.status === 'manual') {
    await notify('Manual intervention needed', job.title, 'warning', jobId);
  } else {
    await notify('Application failed', result.message, 'error', jobId);
  }

  await logActivity('apply', `Applied to ${job.title}: ${result.status}`, { jobId, ...result });
  return result;
}

async function attemptAutoApply(
  page: Page,
  job: { title: string; company: string; platform: string },
  profile: {
    fullName: string;
    email: string;
    phone: string;
    yearsExperience: number;
    currentRole: string;
    skills: string;
  },
  tailored: { contentText: string; customFilePath: string | null } | null,
  base: { filePath: string } | null
): Promise<{ status: string; message: string }> {
  if (job.platform === 'linkedin') {
    return attemptLinkedInEasyApply(page, profile, tailored, base);
  }
  return attemptGenericApply(page, profile, tailored, base);
}

async function attemptLinkedInEasyApply(
  page: Page,
  profile: {
    fullName: string;
    email: string;
    phone: string;
    yearsExperience: number;
    currentRole: string;
    skills: string;
  },
  tailored: { contentText: string; customFilePath: string | null } | null,
  base: { filePath: string } | null
): Promise<{ status: string; message: string }> {
  await page.waitForTimeout(2000);

  // Find and click Easy Apply button
  const easyApplyBtn = await page.$([
    'button.jobs-apply-button',
    '.jobs-s-apply button',
    'button:has-text("Easy Apply")',
    'button[aria-label*="Easy Apply"]',
  ].join(', '));

  if (!easyApplyBtn) {
    // Try generic apply button
    const applyBtn = await page.$('button:has-text("Apply"), a:has-text("Apply"), #apply-button');
    if (applyBtn) {
      await applyBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
      return { status: 'manual', message: 'Apply button clicked — complete in browser' };
    }
    return { status: 'manual', message: 'Could not find apply button — complete manually' };
  }

  await easyApplyBtn.click();
  await page.waitForTimeout(2000);

  // Navigate through the multi-step Easy Apply modal
  const maxSteps = 10;
  for (let step = 0; step < maxSteps; step++) {
    // Check for submit button first (final step)
    const submitBtn = await page.$([
      'button[aria-label*="Submit application"]',
      'button:has-text("Submit application")',
      'button[aria-label*="Submit"]',
      'footer button.artdeco-button--primary:has-text("Submit")',
    ].join(', '));

    if (submitBtn) {
      // Upload resume if there's a file input on the final page
      await uploadResumeIfNeeded(page, tailored, base);
      await fillFormFields(page, profile);
      await submitBtn.click().catch(() => {});
      await page.waitForTimeout(2000);

      // Check for confirmation
      const confirmation = await page.$([
        'h2:has-text("application was sent")',
        'h2:has-text("Application sent")',
        ':has-text("Your application was sent")',
        '.artdeco-modal:has-text("Application sent")',
        'h3:has-text("submitted")',
      ].join(', '));

      if (confirmation) {
        // Dismiss the confirmation dialog
        const dismissBtn = await page.$('button[aria-label="Dismiss"], button:has-text("Done")');
        if (dismissBtn) await dismissBtn.click().catch(() => {});
        return { status: 'success', message: 'Easy Apply submitted successfully' };
      }
      return { status: 'success', message: 'Easy Apply submit clicked' };
    }

    // Fill form fields on the current step
    await uploadResumeIfNeeded(page, tailored, base);
    await fillFormFields(page, profile);

    // Look for the Next/Review/Continue button
    const nextBtn = await page.$([
      'footer button.artdeco-button--primary',
      'button[aria-label*="Continue"]',
      'button[aria-label*="Next"]',
      'button[aria-label*="Review"]',
      'button:has-text("Next")',
      'button:has-text("Review")',
      'button:has-text("Continue")',
    ].join(', '));

    if (nextBtn) {
      const btnText = await nextBtn.innerText().catch(() => '');
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(1500);

      // Check if an error/validation prevented moving forward
      const errorMsg = await page.$('.artdeco-inline-feedback--error, .fb-dash-form-element__error');
      if (errorMsg) {
        const errorText = await errorMsg.innerText().catch(() => 'Validation error');
        return { status: 'manual', message: `Easy Apply blocked at step ${step + 1}: ${errorText}` };
      }

      if (btnText.toLowerCase().includes('review')) {
        // On review page — look for submit
        await page.waitForTimeout(1000);
        continue;
      }
    } else {
      // No next or submit button found — stuck
      return { status: 'manual', message: `Easy Apply opened but stuck at step ${step + 1} — complete manually` };
    }
  }

  return { status: 'manual', message: 'Easy Apply — too many steps, complete manually' };
}

async function uploadResumeIfNeeded(
  page: Page,
  tailored: { contentText: string; customFilePath: string | null } | null,
  base: { filePath: string } | null
): Promise<void> {
  const resumePath = tailored?.customFilePath ?? base?.filePath;
  if (!resumePath) return;

  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles(resumePath).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function fillFormFields(
  page: Page,
  profile: {
    fullName: string;
    email: string;
    phone: string;
    yearsExperience: number;
    currentRole: string;
    skills: string;
  }
): Promise<void> {
  const heuristics: Record<string, string> = {
    fullname: profile.fullName,
    name: profile.fullName,
    first_name: profile.fullName.split(' ')[0] ?? '',
    firstname: profile.fullName.split(' ')[0] ?? '',
    last_name: profile.fullName.split(' ').slice(1).join(' '),
    lastname: profile.fullName.split(' ').slice(1).join(' '),
    email: profile.email,
    phone: profile.phone,
    mobile: profile.phone,
    phonenumber: profile.phone,
    experience: String(profile.yearsExperience),
    years: String(profile.yearsExperience),
    role: profile.currentRole,
    title: profile.currentRole,
    city: '',
  };

  const inputs = await page.$$('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea');

  for (const input of inputs) {
    const currentValue = await input.inputValue().catch(() => '');
    if (currentValue) continue; // Already filled

    const name = ((await input.getAttribute('name')) ?? '').toLowerCase();
    const id = ((await input.getAttribute('id')) ?? '').toLowerCase();
    const placeholder = ((await input.getAttribute('placeholder')) ?? '').toLowerCase();
    const ariaLabel = ((await input.getAttribute('aria-label')) ?? '').toLowerCase();
    const type = (await input.getAttribute('type')) ?? 'text';

    // Match by type first
    if (type === 'email') {
      await input.fill(profile.email).catch(() => {});
      continue;
    }
    if (type === 'tel') {
      await input.fill(profile.phone).catch(() => {});
      continue;
    }

    // Match by name/id/placeholder/label heuristics
    const combined = `${name} ${id} ${placeholder} ${ariaLabel}`;
    for (const [key, value] of Object.entries(heuristics)) {
      if (value && combined.includes(key)) {
        await input.fill(value).catch(() => {});
        break;
      }
    }
  }

  // Handle select dropdowns — try to pick sensible defaults
  const selects = await page.$$('select');
  for (const select of selects) {
    const currentValue = await select.inputValue().catch(() => '');
    if (currentValue) continue;

    const options = await select.$$('option');
    if (options.length > 1) {
      // Select first non-empty option
      const secondOption = options[1];
      const value = await secondOption.getAttribute('value');
      if (value) {
        await select.selectOption(value).catch(() => {});
      }
    }
  }
}

async function attemptGenericApply(
  page: Page,
  profile: {
    fullName: string;
    email: string;
    phone: string;
    yearsExperience: number;
    currentRole: string;
    skills: string;
  },
  tailored: { contentText: string; customFilePath: string | null } | null,
  base: { filePath: string } | null
): Promise<{ status: string; message: string }> {
  await fillFormFields(page, profile);
  await uploadResumeIfNeeded(page, tailored, base);

  const applyBtn = await page.$(
    'button:has-text("Apply"), button:has-text("Submit"), button.apply-button, #apply-button, a:has-text("Apply Now")'
  );
  if (applyBtn) {
    await applyBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
    return { status: 'success', message: 'Application flow initiated' };
  }

  return { status: 'manual', message: 'Could not find apply button — complete manually' };
}

export async function applyToAllJobs(jobIds: string[]): Promise<string> {
  const id = randomUUID();
  const jobs = await prisma.job.findMany({ where: { id: { in: jobIds } } });
  const progress: ApplyProgress[] = jobs.map((j) => ({
    jobId: j.id,
    title: j.title,
    status: 'pending',
  }));
  applyProgressStore.set(id, { progress, createdAt: Date.now() });

  // Evict entries older than 1 hour
  for (const [key, val] of applyProgressStore) {
    if (Date.now() - val.createdAt > 3600_000) applyProgressStore.delete(key);
  }

  void (async () => {
    for (let i = 0; i < jobs.length; i++) {
      progress[i].status = 'running';
      try {
        const result = await applyToJob(jobs[i].id);
        if (result.status === 'skipped') progress[i].status = 'skipped';
        else if (result.status === 'success') progress[i].status = 'done';
        else if (result.status === 'manual') progress[i].status = 'manual';
        else progress[i].status = 'failed';
        progress[i].error = result.message;
      } catch (err) {
        progress[i].status = 'failed';
        progress[i].error = String(err);
      }
      await randomDelay(config.applyDelayMinMs, config.applyDelayMaxMs);
    }
    const done = progress.filter((p) => p.status === 'done').length;
    const failed = progress.filter((p) => p.status === 'failed').length;
    const skipped = progress.filter((p) => p.status === 'skipped').length;
    await notify(
      'Batch apply complete',
      `${done} applied, ${failed} failed, ${skipped} skipped`,
      failed > 0 ? 'warning' : 'success'
    );
    await logActivity('apply', 'Batch apply finished', { done, failed, skipped });
  })();

  return id;
}
