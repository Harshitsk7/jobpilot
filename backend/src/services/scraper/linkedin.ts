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

const LOGIN_URL = 'https://www.linkedin.com/login';
const JOBS_URL = 'https://www.linkedin.com/jobs/search/';

const EXPERIENCE_LEVEL_MAP: Record<string, string> = {
  fresher: '1,2',
  junior: '2,3',
  mid: '3,4',
  senior: '4',
  lead: '4,5',
  expert: '5,6',
};

export async function testLinkedInConnection(): Promise<{ ok: boolean; message: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    const hasSession = await loadSession(context, 'linkedin');
    const page = await context.newPage();
    if (hasSession) {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!page.url().includes('/login')) {
        await updateConnectionStatus('linkedin', 'connected');
        return { ok: true, message: 'LinkedIn connected via saved session' };
      }
    }
    const creds = await getCredentials('linkedin');
    if (creds?.username && creds?.password) {
      await loginLinkedIn(page, creds.username, creds.password);
      await saveSession('linkedin', await context.cookies());
      await updateConnectionStatus('linkedin', 'connected');
      return { ok: true, message: 'LinkedIn connected successfully' };
    }
    return { ok: false, message: 'No valid session. Use "Login via Browser" in Settings.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateConnectionStatus('linkedin', 'error', msg);
    return { ok: false, message: msg };
  } finally {
    await context.close();
  }
}

async function loginLinkedIn(page: Page, username: string, password: string): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/feed|checkpoint|challenge|jobs/, { timeout: 60000 }).catch(() => { });

  if (await detectCaptcha(page)) {
    console.log('[LinkedIn] CAPTCHA/challenge detected — waiting up to 2 minutes for manual solve...');
    const solved = await waitForCaptchaSolve(page, 120000);
    if (!solved) {
      throw new Error('LinkedIn CAPTCHA timeout. Use "Login via Browser" to complete verification.');
    }
    console.log('[LinkedIn] CAPTCHA solved, continuing...');
    await page.waitForTimeout(2000);
  }

  if (page.url().includes('/login')) {
    throw new Error('LinkedIn login failed. Check credentials or use "Login via Browser".');
  }
}

export async function searchLinkedInJobs(params: JobSearchParams): Promise<RawJob[]> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const jobs: RawJob[] = [];

  try {
    const hasSession = await loadSession(context, 'linkedin');
    const page = await context.newPage();

    // Check if logged in
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loggedIn = !page.url().includes('/login');

    if (!loggedIn) {
      const creds = await getCredentials('linkedin');
      if (creds?.username && creds?.password) {
        await loginLinkedIn(page, creds.username, creds.password);
        await saveSession('linkedin', await context.cookies());
      } else if (!hasSession) {
        throw new Error('LinkedIn not connected. Use "Login via Browser" in Settings first.');
      } else {
        throw new Error('LinkedIn session expired. Use "Login via Browser" to re-login.');
      }
    }

    // Build search URL
    const query = new URLSearchParams();
    if (params.keywords || params.title) query.set('keywords', params.keywords ?? params.title);
    if (params.location) query.set('location', params.location);
    if (params.datePosted === '24h') query.set('f_TPR', 'r86400');
    if (params.datePosted === 'week') query.set('f_TPR', 'r604800');
    if (params.jobType === 'remote') query.set('f_WT', '2');
    if (params.experienceLevel && EXPERIENCE_LEVEL_MAP[params.experienceLevel]) {
      query.set('f_E', EXPERIENCE_LEVEL_MAP[params.experienceLevel]);
    }

    const searchUrl = `${JOBS_URL}?${query.toString()}`;
    console.log(`[LinkedIn] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (await detectCaptcha(page)) {
      console.log('[LinkedIn] CAPTCHA detected on search page — waiting up to 2 minutes...');
      const solved = await waitForCaptchaSolve(page, 120000);
      if (!solved) {
        throw new Error('LinkedIn CAPTCHA timeout during job search. Try again later.');
      }
      console.log('[LinkedIn] CAPTCHA solved, continuing search...');
    }

    // Wait for job cards to load
    await page.waitForTimeout(2000);

    // Try to scroll to load more content
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    // Use broad selectors to find job cards - LinkedIn changes these frequently
    const cardSelectors = [
      'li.jobs-search-results__list-item',
      'ul.jobs-search__results-list > li',
      'div.job-search-card',
      'li[data-occludable-job-id]',
      '.scaffold-layout__list-container li',
      'div.jobs-search-results-list li',
      'li.ember-view.occludable-update',
    ];

    let cards: any[] = [];
    for (const selector of cardSelectors) {
      cards = await page.$$(selector);
      if (cards.length > 0) {
        console.log(`[LinkedIn] Found ${cards.length} cards with selector: ${selector}`);
        break;
      }
    }

    if (cards.length === 0) {
      // Fallback: try to extract from page using JavaScript
      console.log('[LinkedIn] No cards found with CSS selectors, trying JS extraction...');
      const pageContent = await page.content();
      console.log(`[LinkedIn] Page URL: ${page.url()}`);
      console.log(`[LinkedIn] Page title: ${await page.title()}`);
      console.log(`[LinkedIn] Page content length: ${pageContent.length}`);

      // Try extracting job data via JavaScript evaluation
      const jsJobs = await page.evaluate(() => {
        const results: Array<{ title: string; company: string; location: string; url: string; easyApply: boolean }> = [];
        const links = document.querySelectorAll('a[href*="/jobs/view/"]');
        links.forEach(link => {
          const card = link.closest('li') || link.parentElement;
          if (!card) return;
          const titleText = link.textContent?.trim() || '';
          const href = (link as HTMLAnchorElement).href || '';
          const allText = card.textContent || '';
          const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.length < 100);
          const easyApply = allText.includes('Easy Apply') || !!card.querySelector('.job-card-container__apply-method');
          results.push({
            title: titleText || lines[0] || 'Unknown',
            company: lines[1] || 'Unknown',
            location: lines[2] || '',
            url: href,
            easyApply,
          });
        });
        return results;
      });

      if (jsJobs.length > 0) {
        console.log(`[LinkedIn] JS extraction found ${jsJobs.length} jobs`);
        const limit = Math.min(jsJobs.length, 20);
        for (let i = 0; i < limit; i++) {
          const j = jsJobs[i];
          const url = j.url.startsWith('http') ? j.url : `https://www.linkedin.com${j.url}`;
          jobs.push({
            platform: 'linkedin',
            title: j.title,
            company: j.company,
            location: j.location || undefined,
            url,
            description: `${j.title} at ${j.company}`,
            applyType: j.easyApply ? 'easy_apply' : 'unknown',
          });
        }
      } else {
        console.log('[LinkedIn] No jobs found via JS extraction either');
        // Log some page structure for debugging
        const bodyHTML = await page.evaluate(() => {
          const body = document.body;
          const lis = body.querySelectorAll('li');
          return `Total <li>: ${lis.length}, Total <a>: ${body.querySelectorAll('a').length}`;
        });
        console.log(`[LinkedIn] Page structure: ${bodyHTML}`);
      }
    } else {
      // Process cards found via CSS selectors - extract from list without clicking each card
      const limit = Math.min(cards.length, 25);
      for (let i = 0; i < limit; i++) {
        try {
          const card = cards[i];

          // Extract title - try multiple selectors
          let title = 'Unknown';
          for (const sel of ['a.job-card-list__title', 'a.job-card-container__link', 'h3 a', 'a[href*="/jobs/view"]', '.artdeco-entity-lockup__title a', 'strong', 'h3']) {
            const el = await card.$(sel);
            if (el) { title = ((await el.innerText())?.trim()) || title; break; }
          }

          // Extract company
          let company = 'Unknown';
          for (const sel of ['h4.base-search-card__subtitle', '.job-card-container__primary-description', '.artdeco-entity-lockup__subtitle', 'h4 a', 'h4', '.base-search-card__subtitle']) {
            const el = await card.$(sel);
            if (el) { company = ((await el.innerText())?.trim()) || company; break; }
          }

          // Extract location
          let location: string | undefined;
          for (const sel of ['span.job-search-card__location', '.job-card-container__metadata-item', '.artdeco-entity-lockup__caption', 'span.job-search-card__location', '.base-search-card__metadata']) {
            const el = await card.$(sel);
            if (el) { location = ((await el.innerText())?.trim()) || undefined; break; }
          }

          // Extract URL
          let url = '';
          const linkEl = await card.$('a[href*="/jobs/view/"]') || await card.$('a[href*="/jobs/"]') || await card.$('a');
          if (linkEl) {
            const href = (await linkEl.getAttribute('href')) ?? '';
            url = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
          }

          if (title === 'Unknown' && !url) continue;

          // Detect Easy Apply from card text
          let applyType: 'easy_apply' | 'external' | 'unknown' = 'unknown';
          try {
            const cardText = await card.innerText().catch(() => '');
            if (cardText.includes('Easy Apply')) applyType = 'easy_apply';
          } catch { /* skip */ }

          jobs.push({
            platform: 'linkedin',
            title,
            company,
            location,
            url: url || searchUrl,
            description: `${title} at ${company}${location ? ` - ${location}` : ''}`,
            applyType,
          });
        } catch {
          /* skip card */
        }
      }
    }

    console.log(`[LinkedIn] Total jobs extracted: ${jobs.length}`);
    await updateConnectionStatus('linkedin', 'connected');
    return jobs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LinkedIn] Error: ${msg}`);
    await updateConnectionStatus('linkedin', 'error', msg);
    throw err;
  } finally {
    await context.close();
  }
}

/**
 * Scrape LinkedIn feed for recruiter posts containing job keywords.
 * Scrolls through the feed and extracts posts that look like job listings.
 */
export async function searchLinkedInFeedJobs(params: JobSearchParams): Promise<RawJob[]> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const jobs: RawJob[] = [];

  try {
    const hasSession = await loadSession(context, 'linkedin');
    const page = await context.newPage();

    // Check login
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (page.url().includes('/login')) {
      const creds = await getCredentials('linkedin');
      if (creds?.username && creds?.password) {
        await loginLinkedIn(page, creds.username, creds.password);
        await saveSession('linkedin', await context.cookies());
      } else {
        throw new Error('LinkedIn not connected. Use "Login via Browser" in Settings first.');
      }
    }

    // Search feed using LinkedIn search with content filter
    const keyword = params.keywords || params.title;
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword + ' hiring OR job OR opening OR looking OR recruit OR vacancy')}&origin=GLOBAL_SEARCH_HEADER&sortBy=date_posted`;
    console.log(`[LinkedIn Feed] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (await detectCaptcha(page)) {
      console.log('[LinkedIn Feed] CAPTCHA detected — waiting up to 2 minutes...');
      const solved = await waitForCaptchaSolve(page, 120000);
      if (!solved) {
        console.log('[LinkedIn Feed] CAPTCHA timeout, returning empty results');
        return [];
      }
    }

    await page.waitForTimeout(2000);

    // Scroll once to load more posts
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(1500);

    // Extract feed posts via JS
    const feedJobs = await page.evaluate((kw: string) => {
      const results: Array<{
        authorName: string;
        authorHeadline: string;
        postText: string;
        postUrl: string;
      }> = [];

      // Find all feed update containers
      const posts = document.querySelectorAll('div.feed-shared-update-v2, div.update-components-text, div[data-urn]');
      const seen = new Set<string>();

      // Also try getting all text blocks in search results
      const textBlocks = document.querySelectorAll('span.break-words, div.update-components-text__text, span[dir="ltr"]');

      textBlocks.forEach(block => {
        const text = block.textContent?.trim() || '';
        if (text.length < 50) return; // Too short to be a job post

        const kwLower = kw.toLowerCase();
        const textLower = text.toLowerCase();

        // Check if this post mentions hiring/job-related keywords
        const jobKeywords = ['hiring', 'job', 'opening', 'looking for', 'recruit', 'vacancy', 'position', 'role', 'apply', 'opportunity', 'join us', 'we are hiring', 'dm me', 'send resume', 'interested candidates'];
        const hasJobKeyword = jobKeywords.some(jk => textLower.includes(jk));
        const hasSearchKeyword = textLower.includes(kwLower);

        if (!hasJobKeyword) return;

        // Find the closest post container to get author info
        const postContainer = block.closest('div.feed-shared-update-v2') || block.closest('div[data-urn]') || block.closest('li');

        let authorName = 'Unknown Recruiter';
        let authorHeadline = '';
        let postUrl = '';

        if (postContainer) {
          // Get author name
          const authorEl = postContainer.querySelector('span.update-components-actor__name span[aria-hidden="true"], span.feed-shared-actor__name span[aria-hidden="true"], a.update-components-actor__meta-link span, a.app-aware-link span.visually-hidden');
          if (authorEl) authorName = authorEl.textContent?.trim() || authorName;

          // Get author headline
          const headlineEl = postContainer.querySelector('span.update-components-actor__description, span.feed-shared-actor__description');
          if (headlineEl) authorHeadline = headlineEl.textContent?.trim() || '';

          // Get post URL
          const linkEl = postContainer.querySelector('a[href*="/feed/update/"], a[href*="activity"]') as HTMLAnchorElement;
          if (linkEl) postUrl = linkEl.href;
        }

        const key = text.substring(0, 100);
        if (seen.has(key)) return;
        seen.add(key);

        results.push({
          authorName,
          authorHeadline,
          postText: text.substring(0, 2000),
          postUrl: postUrl || window.location.href,
        });
      });

      return results;
    }, keyword);

    console.log(`[LinkedIn Feed] Found ${feedJobs.length} job-related posts`);

    for (const post of feedJobs.slice(0, 15)) {
      // Try to extract a job title from the post text
      const titleMatch = post.postText.match(/(?:hiring|looking for|opening for|position|role)[:\s]+([^\n.!?]{5,60})/i);
      const title = titleMatch ? titleMatch[1].trim() : extractJobTitle(post.postText, keyword);

      jobs.push({
        platform: 'linkedin',
        title: title || `${keyword} opportunity`,
        company: post.authorName,
        location: extractLocation(post.postText),
        url: post.postUrl,
        description: `[Feed Post by ${post.authorName}${post.authorHeadline ? ' - ' + post.authorHeadline : ''}]\n\n${post.postText}`,
      });
    }

    console.log(`[LinkedIn Feed] Total feed jobs extracted: ${jobs.length}`);
    return jobs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LinkedIn Feed] Error: ${msg}`);
    // Don't update connection status for feed errors - it's supplementary
    return []; // Return empty instead of throwing
  } finally {
    await context.close();
  }
}

function extractJobTitle(text: string, fallbackKeyword: string): string {
  // Common patterns recruiters use
  const patterns = [
    /(?:hiring|looking for|need|seeking|opening for|position:?|role:?)\s*[:-]?\s*([A-Z][^\n.!?]{3,50})/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Engineer|Developer|Designer|Manager|Analyst|Architect|Lead|Specialist|Consultant|Associate))/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:engineer|developer|designer|manager|analyst|architect|lead|specialist|consultant|associate))/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return `${fallbackKeyword} (Feed Post)`;
}

function extractLocation(text: string): string | undefined {
  const cities = ['Remote', 'Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Noida', 'Gurgaon', 'Gurugram', 'New York', 'San Francisco', 'London', 'Singapore', 'Dubai', 'Work from home', 'WFH', 'Hybrid', 'Onsite', 'India', 'US', 'USA', 'UK'];
  const textLower = text.toLowerCase();
  const found = cities.filter(c => textLower.includes(c.toLowerCase()));
  return found.length > 0 ? found.slice(0, 3).join(', ') : undefined;
}
