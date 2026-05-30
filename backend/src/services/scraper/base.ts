import fs from 'fs/promises';
import path from 'path';
import { chromium as playwrightChromium } from 'playwright';
import type { Browser, BrowserContext, Cookie, Page } from 'playwright';
import { config } from '../../lib/config.js';
import { decrypt, encrypt } from '../encryption.js';
import { prisma } from '../../lib/prisma.js';

export type Platform = 'linkedin' | 'naukri';

export interface ScraperCredentials {
  username: string;
  password: string;
}

let sharedBrowser: Browser | null = null;

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--disable-infobars',
  '--disable-dev-shm-usage',
];

export async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    const launchOpts = {
      headless: config.playwrightHeadless,
      args: STEALTH_ARGS,
    };
    sharedBrowser = await playwrightChromium
      .launch({ ...launchOpts, channel: 'msedge' })
      .catch(() => playwrightChromium.launch({ ...launchOpts, channel: 'chrome' }))
      .catch(() => playwrightChromium.launch(launchOpts));
  }
  return sharedBrowser;
}

export async function getCredentials(platform: Platform): Promise<ScraperCredentials | null> {
  const cred = await prisma.platformCredential.findUnique({ where: { platform } });
  if (!cred?.encryptedData || cred.encryptedData === 'pending') return null;
  try {
    const data = JSON.parse(decrypt(cred.encryptedData)) as ScraperCredentials;
    if (!data.username || !data.password) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveSession(platform: Platform, cookies: Cookie[]): Promise<void> {
  const encrypted = encrypt(JSON.stringify(cookies));
  await prisma.platformCredential.upsert({
    where: { platform },
    create: { platform, encryptedData: encrypt('{}'), sessionData: encrypted, status: 'connected' },
    update: { sessionData: encrypted, status: 'connected' },
  });
}

export async function loadSession(context: BrowserContext, platform: Platform): Promise<boolean> {
  const cred = await prisma.platformCredential.findUnique({ where: { platform } });
  if (cred?.sessionData) {
    try {
      const cookies = JSON.parse(decrypt(cred.sessionData)) as Cookie[];
      await context.addCookies(cookies);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function updateConnectionStatus(
  platform: Platform,
  status: 'connected' | 'disconnected' | 'error',
  error?: string
): Promise<void> {
  await prisma.platformCredential.upsert({
    where: { platform },
    create: { platform, encryptedData: encrypt('{}'), status, lastError: error },
    update: { status, lastError: error ?? null, lastTestedAt: new Date() },
  });
}

const LOGIN_URLS: Record<Platform, string> = {
  linkedin: 'https://www.linkedin.com/login',
  naukri: 'https://www.naukri.com/nlogin/login',
};

const LOGGED_IN_URLS: Record<Platform, string> = {
  linkedin: 'https://www.linkedin.com/feed/',
  naukri: 'https://www.naukri.com/mnjuser/homepage',
};

export async function loginViaBrowser(platform: Platform): Promise<{ ok: boolean; message: string }> {
  const browser = await playwrightChromium.launch({ headless: false, args: STEALTH_ARGS, channel: 'msedge' }).catch(() =>
    playwrightChromium.launch({ headless: false, args: STEALTH_ARGS })
  );
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(LOGIN_URLS[platform], { waitUntil: 'domcontentloaded', timeout: 30000 });

    const start = Date.now();
    while (Date.now() - start < 120000) {
      await page.waitForTimeout(2000);
      const url = page.url();
      const isLoggedIn =
        (platform === 'linkedin' && !url.includes('/login') && (url.includes('/feed') || url.includes('/jobs'))) ||
        (platform === 'naukri' && !url.includes('login') && (url.includes('homepage') || url.includes('naukri.com/')));
      if (isLoggedIn) {
        const cookies = await context.cookies();
        await saveSession(platform, cookies);
        await updateConnectionStatus(platform, 'connected');
        await browser.close();
        return { ok: true, message: `${platform} connected via browser login` };
      }
    }
    await browser.close();
    return { ok: false, message: 'Login timed out. Please try again.' };
  } catch (err) {
    await browser.close().catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    await updateConnectionStatus(platform, 'error', msg);
    return { ok: false, message: msg };
  }
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser?.isConnected()) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
  }
}

export async function hasStoredSession(platform: Platform): Promise<boolean> {
  const cred = await prisma.platformCredential.findUnique({ where: { platform } });
  if (cred?.sessionData) return true;
  const sessionPath = path.join(config.sessionsDir, `${platform}.json`);
  try {
    await fs.access(sessionPath);
    return true;
  } catch {
    return false;
  }
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('captcha') || url.includes('challenge') || url.includes('checkpoint')) {
    return true;
  }

  const hasCaptchaFrame = await page
    .$$('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="checkpoint"], iframe[src*="captcha"]')
    .then((f) => f.length > 0)
    .catch(() => false);
  if (hasCaptchaFrame) return true;

  const hasCaptchaElement = await page
    .$('#captcha, .captcha-container, [data-captcha], .challenge-dialog, #cf-challenge-running, .g-recaptcha, .h-captcha')
    .then((el) => !!el)
    .catch(() => false);
  if (hasCaptchaElement) return true;

  const text = await page.textContent('body').catch(() => '');
  return /captcha|verify you are human|security check|are you a robot|prove you're human/i.test(text ?? '');
}

export async function waitForCaptchaSolve(page: Page, timeout = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await page.waitForTimeout(2000);
    const stillPresent = await detectCaptcha(page);
    if (!stillPresent) return true;
  }
  return false;
}

export interface JobSearchParams {
  title: string;
  keywords?: string;
  location?: string;
  experienceLevel?: string;
  jobType?: string;
  datePosted?: string;
}
