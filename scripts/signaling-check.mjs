/* global process, console, window, fetch */
import { chromium } from 'playwright';

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:8090';
const EMAIL = process.env.TEST_EMAIL ?? 'tester@drawmyplace.local';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test12345!';

async function api(page, path, init = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(`/api/v1${path}`, {
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        ...init,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${init.method ?? 'GET'} ${path} ${response.status}: ${text}`);
      }
      return text ? JSON.parse(text) : null;
    },
    { path, init },
  );
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.localStorage.setItem('drawmyplace-locale', 'en');
    window.localStorage.setItem('drawmyplace-theme', 'light');
    window.localStorage.setItem(
      'dmp:onboarding',
      JSON.stringify({ editorTour: 'completed', hints: {} }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/app', { timeout: 30000 });

  const stamp = Date.now();
  const project = await api(page, '/projects', {
    method: 'POST',
    body: JSON.stringify({ name: `Playwright signaling ${stamp}` }),
  });
  const floor = await api(page, `/projects/${project.id}/floors`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Floor 1' }),
  });
  const plan = await api(page, `/floors/${floor.id}/plans`, { method: 'POST' });

  await page.goto(`${WEB}/app/projects/${project.id}/editor?tour=off`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('tab', { name: 'Signaling' }).click();
  await page.getByRole('button', { name: 'Add loop' }).click();
  await page.getByText('SL1', { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);

  // Devices and cable are added through the public API after the loop exists;
  // the editor then verifies that live takeoff, validation and exports see them.
  const planData = await api(page, `/plans/${plan.id}`);
  const loops = planData.calculationSettings?.signaling?.loops ?? [];
  if (loops.length === 0) throw new Error('Signaling loop was not persisted');
  const loopId = loops[0].id;

  const panelPoint = await api(page, `/plans/${plan.id}/points`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'panel',
      x: 80,
      y: 80,
      properties: {
        subtype: 'fire-panel',
        productId: 'hochiki-firenet-panel',
        loopId,
      },
    }),
  });

  // Point the loop at the panel and add the detector set + cable.
  await api(page, `/plans/${plan.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      calculationSettings: {
        ...planData.calculationSettings,
        signaling: {
          loops: loops.map((item) => ({ ...item, panelId: panelPoint.id })),
        },
      },
    }),
  });

  for (let address = 1; address <= 3; address += 1) {
    await api(page, `/plans/${plan.id}/points`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'custom',
        x: 200 + address * 120,
        y: 220,
        properties: {
          subtype: 'smoke-detector',
          productId: 'hochiki-soc-e-smoke',
          loopId,
          address,
          zone: 1,
        },
      }),
    });
  }
  await api(page, `/plans/${plan.id}/routes`, {
    method: 'POST',
    body: JSON.stringify({
      geometry: [
        { x: 80, y: 80 },
        { x: 500, y: 80 },
        { x: 500, y: 220 },
      ],
      settings: { mounting: 'ceiling', system: 'fire', loopId },
    }),
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Signaling' }).click();
  await page.getByText('4/128').waitFor({ timeout: 15000 });
  await page.getByRole('tab', { name: /Calculation/ }).click();
  await page.getByText('Signaling loops').waitFor({ timeout: 15000 });

  await page.getByRole('tab', { name: /Validation/ }).click();
  await page.getByRole('heading', { name: 'Validation', exact: true }).waitFor();

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('tab', { name: /Calculation/ }).click();
  await page.getByRole('button', { name: /Signaling schematic/ }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith('.svg')) {
    throw new Error('Signaling schematic was not exported as SVG');
  }

  await page.goto(
    `${WEB}/app/projects/${project.id}/documentation`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForTimeout(2000);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('tab', { name: 'Signaling specification' }).click();
  await page.waitForTimeout(1000);
  await page
    .getByText(/addressable optical smoke detector|smoke detector/i)
    .first()
    .waitFor({ timeout: 15000 });

  if (errors.length > 0) {
    throw new Error(`Page errors: ${errors.join('; ')}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: project.id,
        loopPersisted: true,
        devices: 4,
        export: download.suggestedFilename(),
        reports: true,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
