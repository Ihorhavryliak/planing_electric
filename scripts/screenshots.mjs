/* global process, console, window, fetch */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:8090';
const EMAIL = process.env.TEST_EMAIL ?? 'tester@drawmyplace.local';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test12345!';
const OUT = path.join(process.cwd(), 'docs', 'screenshots');

const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'app', path: '/app' },
  { name: 'local', path: '/local' },
];

async function login(page) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/app', { timeout: 30000 });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await context.addInitScript(
      ({ theme }) => {
        window.localStorage.setItem('drawmyplace-theme', theme);
        window.localStorage.setItem('drawmyplace-locale', 'en');
      },
      { theme },
    );
    const page = await context.newPage();

    await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT, `landing-${theme}.png`),
      fullPage: false,
    });

    // Authenticate before capturing the workspace and local project pages.
    await login(page);
    const projects = await page.evaluate(async () => {
      const response = await fetch('/api/v1/projects', {
        credentials: 'include',
      });
      return response.ok ? response.json() : [];
    });
    const project = projects.find((item) => item.name === 'Signaling demo') ?? projects[0];

    for (const item of PAGES.slice(1)) {
      await page.goto(`${WEB}${item.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT, `${item.name}-${theme}.png`),
        fullPage: false,
      });
    }

    if (project) {
      await page.goto(
        `${WEB}/app/projects/${project.id}/editor?tour=off`,
        { waitUntil: 'networkidle' },
      );
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(OUT, `editor-${theme}.png`),
        fullPage: false,
      });

      await page.goto(
        `${WEB}/app/projects/${project.id}/documentation`,
        { waitUntil: 'networkidle' },
      );
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT, `documentation-${theme}.png`),
        fullPage: false,
      });
    }

    await context.close();
  }

  await browser.close();
  console.log(`Saved screenshots to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
