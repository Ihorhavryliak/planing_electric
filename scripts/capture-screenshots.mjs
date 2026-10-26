/* global process, window, console */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:3004';
const OUTPUT = path.resolve('docs/screenshots');

async function main() {
  await mkdir(OUTPUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  async function openDemo(theme) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      colorScheme: theme,
    });
    await page.addInitScript(({ nextTheme }) => {
      window.localStorage.setItem('dmp:onboarding', JSON.stringify({
        editorTour: 'skipped',
        hints: {},
      }));
      window.localStorage.setItem('drawmyplace-theme', nextTheme);
    }, { nextTheme: theme });
    await page.goto(`${WEB}/local`);
    await page.getByRole('button', { name: 'Load demo' }).click();
    await page.waitForURL('**/local/*');
    await page.locator('canvas').first().waitFor();
    await page.waitForTimeout(1200);

    const hideGuide = page.getByRole('button', { name: 'Hide quick guide' });
    if (await hideGuide.count()) {
      await hideGuide.click();
      await page.waitForTimeout(250);
    }

    return page;
  }

  const dark = await openDemo('dark');
  await dark.screenshot({
    path: path.join(OUTPUT, 'editor-dark.png'),
    fullPage: false,
  });
  await dark.close();

  const light = await openDemo('light');
  await light.screenshot({
    path: path.join(OUTPUT, 'editor-light.png'),
    fullPage: false,
  });
  await light.close();

  const publicPage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  await publicPage.addInitScript(() => {
    window.localStorage.setItem('drawmyplace-theme', 'light');
  });
  await publicPage.goto(`${WEB}/local`);
  await publicPage.waitForTimeout(700);
  await publicPage.screenshot({
    path: path.join(OUTPUT, 'local-projects.png'),
    fullPage: false,
  });
  await publicPage.close();

  await browser.close();
  console.log('Screenshots written to', OUTPUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
