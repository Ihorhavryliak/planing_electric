/* global process, console, document, window, localStorage */
import { chromium } from 'playwright';

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:8090';
const EMAIL = process.env.TEST_EMAIL ?? 'tester@drawmyplace.local';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test12345!';

const ROUTES = ['/', '/login', '/register', '/pricing', '/local', '/app'];

async function main() {
  const browser = await chromium.launch();
  const failures = [];

  for (const width of [360, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('drawmyplace-locale', 'en');
      localStorage.setItem('drawmyplace-theme', 'light');
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      await page.goto(`${WEB}${route}`, { waitUntil: 'networkidle' });
      if (route === '/app') {
        const emailInput = page.locator('input[type=email]');
        if (await emailInput.count()) {
          await emailInput.fill(EMAIL);
          await page.fill('input[type=password]', PASSWORD);
          await page.click('button[type=submit]');
          await page.waitForURL('**/app', { timeout: 20000 });
        }
      }
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 2) {
        failures.push({ width, route, overflow });
      }
    }

    await context.close();
  }

  await browser.close();
  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, widths: [360, 768, 1024, 1440] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
