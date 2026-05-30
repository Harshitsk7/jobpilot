import { Page } from 'playwright';
import {
  getBrowser,
  getCredentials,
  loadSession,
  saveSession,
  updateConnectionStatus,
  detectCaptcha,
  waitForCaptchaSolve,
  JobSearchParams,
} from './base.js';
import type { RawJob } from '../jobs/processor.js';

const LOGIN_URL = 'https://www.naukri.com/nlogin/login';
const SEARCH_URL = 'https://www.naukri.com/';

const EXPERIENCE_RANGE_MAP: Record<string, { min: number; max: number }> = {
  fresher: { min: 0, max: 1 },
  junior: { min: 1, max: 3 },
  mid: { min: 3, max: 5 },
  senior: { min: 5, max: 8 },
  lead: { min: 8, max: 12 },
  expert: { min: 12, max: 30 },
};

export async function testNaukriConnection(): Promise<{ ok: boolean; message: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    const hasSession = await loadSession(context, 'naukri');
    const page = await context.newPage();
    if (hasSession) {
      await page.goto('https://www.naukri.com/mnjuser/homepage', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      if (!page.url().includes('login')) {
        await updateConnectionStatus('naukri', 'connected');
        return { ok: true, message: 'Naukri connected via saved session' };
      }
    }
    const creds = await getCredentials('naukri');
    if (creds?.username && creds?.password) {
      await loginNaukri(page, creds.username, creds.password);
      await saveSession('naukri', await context.cookies());
      await updateConnectionStatus('naukri', 'connected');
      return { ok: true, message: 'Naukri connected successfully' };
    }
    return { ok: false, message: 'No valid session. Use "Login via Browser" in Settings.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateConnectionStatus('naukri', 'error', msg);
    return { ok: false, message: msg };
  } finally {
    await context.close();
  }
}

async function loginNaukri(page: Page, username: string, password: string): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="text"], input#usernameField', username);
  await page.fill('input[type="password"]', password);
  await page.click('button.loginButton, button[type="submit"]');
  await page.waitForTimeout(3000);

  if (await detectCaptcha(page)) {
    console.log('[Naukri] CAPTCHA detected — waiting up to 2 minutes for manual solve...');
    const solved = await waitForCaptchaSolve(page, 120000);
    if (!solved) {
      throw new Error('Naukri CAPTCHA timeout. Solve the CAPTCHA in the browser and retry.');
    }
    console.log('[Naukri] CAPTCHA solved, continuing...');
    await page.waitForTimeout(2000);
  }

  if (page.url().includes('login')) {
    throw new Error('Naukri login failed. Check credentials or use "Login via Browser".');
  }
}

export async function searchNaukriJobs(params: JobSearchParams): Promise<RawJob[]> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const jobs: RawJob[] = [];

  try {
    const hasSession = await loadSession(context, 'naukri');
    if (!hasSession) {
      throw new Error('Naukri not connected. Use "Login via Browser" in Settings first.');
    }
    const page = await context.newPage();

    // Verify session is still valid
    await page.goto('https://www.naukri.com/mnjuser/homepage', { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (page.url().includes('login')) {
      const creds = await getCredentials('naukri');
      if (creds?.username && creds?.password) {
        await loginNaukri(page, creds.username, creds.password);
        await saveSession('naukri', await context.cookies());
      } else {
        throw new Error('Naukri session expired. Use "Login via Browser" to re-login.');
      }
    }

    const keyword = params.keywords ?? params.title;
    const loc = params.location ?? '';
    const expRange = params.experienceLevel ? EXPERIENCE_RANGE_MAP[params.experienceLevel] : null;
    const expSuffix = expRange ? `-${expRange.min}to${expRange.max}year` : '';
    const searchUrl = `${SEARCH_URL}${encodeURIComponent(keyword)}-jobs${loc ? `-in-${encodeURIComponent(loc)}` : ''}${expSuffix}`;
    console.log(`[Naukri] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (await detectCaptcha(page)) {
      console.log('[Naukri] CAPTCHA detected on search page — waiting up to 2 minutes...');
      const solved = await waitForCaptchaSolve(page, 120000);
      if (!solved) {
        throw new Error('Naukri CAPTCHA timeout during job search. Try again later.');
      }
      console.log('[Naukri] CAPTCHA solved, continuing search...');
    }

    await page.waitForTimeout(2000);

    // Try multiple selectors for job cards
    const cardSelectors = [
      '.srp-jobtuple-wrapper',
      'article.jobTuple',
      '.cust-job-tuple',
      '[data-job-id]',
      '.jobTupleHeader',
      '.list > article',
      '.styles_jlc__main__VdwtF article',
    ];

    let cards: any[] = [];
    for (const selector of cardSelectors) {
      cards = await page.$$(selector);
      if (cards.length > 0) {
        console.log(`[Naukri] Found ${cards.length} cards with selector: ${selector}`);
        break;
      }
    }

    if (cards.length === 0) {
      console.log('[Naukri] No cards found via CSS selectors, trying JS extraction...');
      // Fallback JS extraction
      const jsJobs = await page.evaluate(() => {
        const results: Array<{ title: string; company: string; location: string; salary: string; url: string; applyType: string }> = [];
        const links = document.querySelectorAll('a[href*="job-listings"], a[href*="/job/"], a.title');
        links.forEach(link => {
          const card = link.closest('article') || link.closest('div[class*="tuple"]') || link.closest('li') || link.parentElement?.parentElement;
          if (!card) return;
          const titleText = link.textContent?.trim() || '';
          if (!titleText || titleText.length > 200) return;
          const href = (link as HTMLAnchorElement).href || '';
          const allText = card.textContent || '';
          const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 100);
          const lowerText = allText.toLowerCase();
          let applyType = 'unknown';
          if (lowerText.includes('apply on company') || lowerText.includes('company site')) {
            applyType = 'external';
          } else if (lowerText.includes('apply') || lowerText.includes('early applicant')) {
            applyType = 'easy_apply';
          }
          results.push({
            title: titleText,
            company: lines.find(l => l !== titleText && !l.includes('\u20B9') && !l.includes('Lac') && !l.includes('yrs')) || 'Unknown',
            location: lines.find(l => l !== titleText && (l.includes(',') || l.includes('India') || l.includes('Remote') || l.includes('Bangalore') || l.includes('Mumbai') || l.includes('Delhi') || l.includes('Hyderabad') || l.includes('Chennai') || l.includes('Pune') || l.includes('Kolkata') || l.includes('Noida') || l.includes('Gurgaon'))) || '',
            salary: lines.find(l => l.includes('\u20B9') || l.includes('Lac') || l.includes('LPA') || l.includes('CTC')) || '',
            url: href,
            applyType,
          });
        });
        return results;
      });

      if (jsJobs.length > 0) {
        console.log(`[Naukri] JS extraction found ${jsJobs.length} jobs`);
        for (const j of jsJobs.slice(0, 20)) {
          jobs.push({
            platform: 'naukri',
            title: j.title,
            company: j.company,
            location: j.location || undefined,
            salary: j.salary || undefined,
            url: j.url || searchUrl,
            description: `${j.title} at ${j.company}. ${j.location} ${j.salary}`.trim(),
            applyType: (j.applyType as 'easy_apply' | 'external' | 'unknown') || 'unknown',
          });
        }
      } else {
        console.log(`[Naukri] Page URL: ${page.url()}`);
        console.log(`[Naukri] Page title: ${await page.title()}`);
        const bodyInfo = await page.evaluate(() => `<article>: ${document.querySelectorAll('article').length}, <a>: ${document.querySelectorAll('a').length}, <li>: ${document.querySelectorAll('li').length}`);
        console.log(`[Naukri] Page structure: ${bodyInfo}`);
      }
    } else {
      const limit = Math.min(cards.length, 20);
      for (let i = 0; i < limit; i++) {
        try {
          const card = cards[i];

          // Title
          let title = 'Unknown';
          for (const sel of ['a.title', 'h2 a', 'a[href*="job"]', '.row1 a', 'a:first-of-type']) {
            const el = await card.$(sel);
            if (el) { title = ((await el.innerText())?.trim()) || title; break; }
          }

          // Company
          let company = 'Unknown';
          for (const sel of ['.comp-name', 'a.subTitle', '.companyInfo a', '.row2 span:first-child', '.comp-dtls-wrap a']) {
            const el = await card.$(sel);
            if (el) { company = ((await el.innerText())?.trim()) || company; break; }
          }

          // Location
          let location: string | undefined;
          for (const sel of ['.locWdth', '.loc', '.location', '.loc-wrap', '.ni-gnl']) {
            const el = await card.$(sel);
            if (el) { location = ((await el.innerText())?.trim()) || undefined; break; }
          }

          // Salary
          let salary: string | undefined;
          for (const sel of ['.salary', '.sal', '.sal-wrap', '.ni-gnl']) {
            const el = await card.$(sel);
            if (el) {
              const text = ((await el.innerText())?.trim());
              if (text && (text.includes('₹') || text.includes('Lac') || text.includes('LPA'))) {
                salary = text;
                break;
              }
            }
          }

          // URL
          let href = '';
          const linkEl = await card.$('a.title') || await card.$('h2 a') || await card.$('a[href*="job"]') || await card.$('a');
          if (linkEl) {
            href = (await linkEl.getAttribute('href')) ?? '';
          }

          // Detect apply type
          let applyType: 'easy_apply' | 'external' | 'unknown' = 'unknown';
          try {
            const cardText = await card.innerText().catch(() => '');
            const lowerText = cardText.toLowerCase();
            if (lowerText.includes('apply on company') || lowerText.includes('company site')) {
              applyType = 'external';
            } else if (lowerText.includes('apply') || lowerText.includes('early applicant')) {
              applyType = 'easy_apply';
            }
          } catch { /* skip */ }

          jobs.push({
            platform: 'naukri',
            title,
            company,
            location,
            salary,
            url: href || searchUrl,
            description: `${title} at ${company}. ${location ?? ''} ${salary ?? ''}`.trim(),
            applyType,
          });
        } catch {
          /* skip */
        }
      }
    }

    console.log(`[Naukri] Total jobs extracted: ${jobs.length}`);
    await updateConnectionStatus('naukri', 'connected');
    return jobs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Naukri] Error: ${msg}`);
    await updateConnectionStatus('naukri', 'error', msg);
    throw err;
  } finally {
    await context.close();
  }
}
