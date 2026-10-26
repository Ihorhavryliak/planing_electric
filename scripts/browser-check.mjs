/* global process, Buffer, console, document */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:3004';
const EMAIL = `browser-${Date.now()}@example.com`;
const PASSWORD = 'correct-horse-battery';

function makePdf() {
  const lines = ['DrawMyPlace test plan', 'Room 1', '1000 x 800'];
  const content = lines
    .map(
      (line, index) =>
        `BT /F1 18 Tf 60 ${760 - index * 30} Td (${line.replace(/[()\\]/g, '')}) Tj ET`,
    )
    .join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  const dir = path.join(os.tmpdir(), 'drawmyplace-browser-check');
  await mkdir(dir, { recursive: true });
  const pngPath = path.join(dir, 'plan.png');
  const pdfPath = path.join(dir, 'plan.pdf');
  await writeFile(pngPath, PNG_1PX);
  await writeFile(pdfPath, makePdf());

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(`${WEB}/register`);
  await page.getByLabel('Name').fill('Browser Check');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /create account|sign up|register/i }).click();
  await page.waitForURL('**/app', { timeout: 15000 });

  // Theme: system -> light -> dark, persists across reload, then back to system.
  const themeButton = page.getByRole('button', { name: /^Theme:/ });
  await themeButton.click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  );
  await themeButton.click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'dark',
  );
  await page.reload();
  await page.waitForURL('**/app');
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'dark',
  );
  await page.getByRole('button', { name: /^Theme:/ }).click();

  const languageOptions = await page
    .getByLabel('Language')
    .locator('option')
    .allTextContents();
  if (languageOptions.join('|') !== 'Українська|English') {
    throw new Error(`Unexpected language options: ${languageOptions.join(', ')}`);
  }

  // Ukrainian locale persists across reload, then switch back to English.
  await page.getByLabel('Language').selectOption('ua');
  await page.getByRole('button', { name: 'Вийти' }).waitFor();
  await page.getByRole('heading', { name: 'Ваші електроплани' }).waitFor();
  await page.reload();
  await page.waitForURL('**/app');
  await page.getByRole('button', { name: 'Вийти' }).waitFor();
  await page.getByRole('heading', { name: 'Ваші електроплани' }).waitFor();
  await page.getByLabel('Мова').selectOption('en');
  await page.getByRole('button', { name: 'Sign out' }).waitFor();

  await page.getByPlaceholder('Test apartment').fill('Browser Check Project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: /open project/i }).first().click();

  await page.getByPlaceholder('Variant name').fill('Base variant');
  await page.getByRole('button', { name: 'Save snapshot' }).click();
  await page.getByRole('cell', { name: 'Base variant' }).waitFor();

  await page.getByRole('link', { name: /open plan editor/i }).click();

  // The editor shell switches to Ukrainian and back.
  await page.getByLabel('Language').selectOption('ua');
  await page.getByRole('button', { name: 'Додати поверх' }).waitFor();
  await page.getByText('Почніть із поверху').waitFor();
  await page.getByLabel('Мова').selectOption('en');
  await page.getByRole('button', { name: 'Add floor' }).waitFor();

  await page.getByRole('button', { name: 'Add floor' }).click();
  await page.getByPlaceholder('Floor 1').fill('Floor A');
  await page.getByRole('button', { name: 'Create floor' }).click();

  const fileInput = page.locator('input[type=file]');
  await fileInput.setInputFiles(pngPath);
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });

  const circuitsSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Circuits', exact: true }),
  });
  await circuitsSection.getByLabel('Code').fill('L1');
  await circuitsSection.getByLabel('Name').fill('Lighting');
  await circuitsSection.getByRole('button', { name: 'Add circuit' }).click();
  await circuitsSection.getByText('L1', { exact: true }).waitFor();
  const circuitSelect = page
    .getByRole('combobox')
    .filter({ has: page.locator('option[value="L1"]') });

  const visibleButton = page.getByRole('button', { name: 'Visible' });
  await visibleButton.click();
  await page.getByRole('button', { name: 'Hidden' }).click();
  await page.getByRole('button', { name: 'Unlocked' }).click();
  await page.getByRole('button', { name: 'Locked' }).click();

  const opacity = page.getByLabel('Opacity');
  await opacity.fill('0.5');
  await opacity.blur();

  await page.reload();
  await page.waitForURL('**/editor');
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });

  // Draw a wall and add a door + window, so the 3D scene has real geometry.
  const planCanvas = page.locator('canvas').first();
  await page.waitForTimeout(750);
  let canvasBox = await planCanvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas is not visible');
  const canvasHash = () =>
    planCanvas.evaluate((canvas) => {
      const context = canvas.getContext('2d');
      if (!context) return 0;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      for (let index = 0; index < data.length; index += 997) {
        hash = (hash * 31 + data[index]) >>> 0;
      }
      return hash;
    });
  await page.getByRole('button', { name: 'Draw wall tool' }).click();
  await page.mouse.click(
    canvasBox.x + canvasBox.width * 0.3,
    canvasBox.y + canvasBox.height * 0.5,
  );
  await page.mouse.click(
    canvasBox.x + canvasBox.width * 0.7,
    canvasBox.y + canvasBox.height * 0.5,
  );
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Openings', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add door' }).click();
  await page.getByRole('button', { name: 'Add window' }).click();

  const at = (x, y) => ({
    x: canvasBox.x + canvasBox.width * x,
    y: canvasBox.y + canvasBox.height * y,
  });

  // Sidebar interactions scroll the page; refresh the canvas box before using
  // stored pixel coordinates for drawing.
  const syncCanvas = async () => {
    await planCanvas.scrollIntoViewIfNeeded();
    const box = await planCanvas.boundingBox();
    if (box) canvasBox = box;
  };

  // Calibrate so the calculation panel can show real lengths.
  await page.getByRole('button', { name: 'Calibrate scale tool' }).click();
  await syncCanvas();
  await page.mouse.click(at(0.2, 0.2).x, at(0.2, 0.2).y);
  await page.mouse.click(at(0.8, 0.2).x, at(0.8, 0.2).y);
  await page.getByLabel('Real distance').fill('4');
  await page.getByRole('button', { name: 'Set scale' }).click();

  // Place a double socket from the device palette and draw a cable route.
  await syncCanvas();
  await page.locator('summary').filter({ hasText: 'Power' }).click();
  await page.getByRole('button', { name: 'Double socket' }).click();
  await page.mouse.click(at(0.35, 0.6).x, at(0.35, 0.6).y);
  await page.getByRole('button', { name: 'Draw cable route tool' }).click();
  await page.mouse.click(at(0.35, 0.6).x, at(0.35, 0.6).y);
  await page.mouse.click(at(0.5, 0.57).x, at(0.5, 0.57).y);
  await page.mouse.click(at(0.65, 0.6).x, at(0.65, 0.6).y);
  await page.keyboard.press('Enter');
  const routeSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Cable routes', exact: true }),
  });
  await routeSection.getByText('1', { exact: true }).first().waitFor({ timeout: 10000 });

  // Room outline and a dimension. Keep clicks inside the visible viewport.
  await page.getByRole('button', { name: 'Draw room outline tool' }).click();
  await page.getByText(/Click to start a room outline/).waitFor();
  await page.mouse.click(at(0.25, 0.68).x, at(0.25, 0.68).y);
  await page.mouse.click(at(0.55, 0.68).x, at(0.55, 0.68).y);
  await page.mouse.click(at(0.55, 0.78).x, at(0.55, 0.78).y);
  await page.keyboard.press('Enter');

  const layoutSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Layout', exact: true }),
  });
  await layoutSection
    .getByText('Rooms')
    .locator('..')
    .getByText('1', { exact: true })
    .waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: 'Add dimension tool' }).click();
  await page.mouse.click(at(0.25, 0.7).x, at(0.25, 0.7).y);
  await page.mouse.click(at(0.55, 0.7).x, at(0.55, 0.7).y);
  await layoutSection
    .getByText('Dimensions')
    .locator('..')
    .getByText('1', { exact: true })
    .waitFor({ timeout: 10000 });

  // Select the socket, rotate it, and duplicate it.
  await page.getByRole('button', { name: 'Select tool' }).click();
  await syncCanvas();
  await page.mouse.click(at(0.35, 0.6).x, at(0.35, 0.6).y);
  await page.getByRole('button', { name: 'Duplicate' }).waitFor();
  await page.getByRole('textbox', { name: /Rotation/ }).fill('90');
  await page.getByRole('textbox', { name: /Rotation/ }).blur();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  const subtypeSelect = page
    .getByRole('combobox')
    .filter({ has: page.locator('option[value="socket-double"]') });
  if ((await subtypeSelect.inputValue()) !== 'socket-double') {
    throw new Error('Device subtype was not persisted on the point.');
  }
  await circuitSelect.selectOption('L1');

  const pointsSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Points', exact: true }),
  });
  await pointsSection.getByText('2', { exact: true }).first().waitFor({ timeout: 10000 });

  // Select the cable route from the panel, then drag its end bend.
  await routeSection.getByRole('button', { name: /Route 1/ }).click();
  await page.getByRole('heading', { name: 'Cable route', exact: true }).waitFor();
  await circuitSelect.selectOption('L1');
  await circuitsSection
    .getByText('1 devices · 1 routes', { exact: true })
    .waitFor();

  // Live takeoff reflects calibrated walls, rooms, devices and cable.
  const takeoffSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Live takeoff', exact: true }),
  });
  await takeoffSection.getByText('Calibrated', { exact: true }).waitFor();
  const deviceRow = takeoffSection.getByText('Total devices').locator('..');
  await deviceRow.getByText('2', { exact: true }).waitFor();
  const wallLengthRow = takeoffSection.getByText('Wall length').locator('..');
  if ((await wallLengthRow.innerText()).includes('—')) {
    throw new Error('Live takeoff did not calculate wall length.');
  }
  const cableRow = takeoffSection.getByText('Cable with waste').locator('..');
  if ((await cableRow.innerText()).includes('—')) {
    throw new Error('Live takeoff did not calculate cable length.');
  }

  await syncCanvas();
  await page.mouse.click(at(0.65, 0.6).x, at(0.65, 0.6).y);
  const beforeBend = await canvasHash();
  await page.mouse.move(at(0.65, 0.6).x, at(0.65, 0.6).y);
  await page.mouse.down();
  await page.mouse.move(at(0.62, 0.68).x, at(0.62, 0.68).y, {
    steps: 6,
  });
  await page.mouse.up();
  await page.waitForFunction(
    (previous) => {
      const canvas = document.querySelector('canvas');
      const context = canvas?.getContext('2d');
      if (!context || !canvas) return false;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      for (let index = 0; index < data.length; index += 997) {
        hash = (hash * 31 + data[index]) >>> 0;
      }
      return hash !== previous;
    },
    beforeBend,
    { timeout: 10000 },
  );

  // Switch the route to a wall chase and change its width.
  await page
    .getByRole('heading', { name: 'Cable route', exact: true })
    .waitFor({ timeout: 15000 });
  const mountingSelect = page.getByLabel('Installation');
  const beforeChase = await canvasHash();
  await mountingSelect.selectOption('chase');
  await page.getByLabel(/Chase width/).fill('80');
  await page.getByLabel(/Chase width/).blur();
  await page.waitForFunction(
    (previous) => {
      const canvas = document.querySelector('canvas');
      const context = canvas?.getContext('2d');
      if (!context || !canvas) return false;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      for (let index = 0; index < data.length; index += 997) {
        hash = (hash * 31 + data[index]) >>> 0;
      }
      return hash !== previous;
    },
    beforeChase,
    { timeout: 10000 },
  );
  if ((await mountingSelect.inputValue()) !== 'chase') {
    throw new Error('Route mounting was not saved.');
  }

  // Pan the canvas and confirm the rendered viewport changed.
  await page.getByRole('button', { name: 'Pan tool' }).click();
  await syncCanvas();
  const beforePan = await canvasHash();
  await page.mouse.move(at(0.5, 0.5).x, at(0.5, 0.5).y);
  await page.mouse.down();
  await page.mouse.move(at(0.62, 0.58).x, at(0.62, 0.58).y, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(
    (previous) => {
      const canvas = document.querySelector('canvas');
      const context = canvas?.getContext('2d');
      if (!context || !canvas) return false;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      for (let index = 0; index < data.length; index += 997) {
        hash = (hash * 31 + data[index]) >>> 0;
      }
      return hash !== previous;
    },
    beforePan,
    { timeout: 10000 },
  );
  await page.getByRole('button', { name: 'Fit plan to view' }).click();
  await page.getByRole('button', { name: 'Select tool' }).click();

  // Zoom controls and a viewport resize.
  const zoomLabel = page.locator('button[title^="Reset to 100%"]');
  await zoomLabel.click();
  const beforeZoom = (await zoomLabel.innerText()).trim();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForFunction(
    (previous) =>
      document.querySelector('button[title^="Reset to 100%"]')?.textContent?.trim() !==
      previous,
    beforeZoom,
  );
  await page.setViewportSize({ width: 900, height: 800 });
  await planCanvas.waitFor();

  // 3D view loads lazily and renders a WebGL canvas.
  await page.getByRole('button', { name: '3D view' }).click();
  await page.getByText(/3D view · drag to orbit/).waitFor({ timeout: 20000 });
  await page.locator('canvas').last().waitFor({ timeout: 20000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /GLB/ }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith('.glb')) {
    throw new Error(`Unexpected GLB filename: ${download.suggestedFilename()}`);
  }

  // Split view shows the 2D canvas and 3D scene side by side.
  await page.getByRole('button', { name: 'Split 2D/3D' }).click();
  await page.getByText(/3D view · drag to orbit/).waitFor({ timeout: 20000 });
  if ((await page.locator('canvas').count()) < 2) {
    throw new Error('Split view did not render both canvases.');
  }

  await page.getByRole('button', { name: '2D edit' }).click();

  // Select the whole route and delete it, then undo the deletion.
  await page.getByRole('button', { name: 'Select tool' }).click();
  await routeSection.getByRole('button').first().click();
  await routeSection.getByText('1', { exact: true }).first().waitFor();
  await page.keyboard.press('Delete');
  await routeSection.getByText('0', { exact: true }).first().waitFor();
  await page.keyboard.press('Control+z');
  await routeSection.getByText('1', { exact: true }).first().waitFor({ timeout: 10000 });

  // Replace the raster plan with a PDF and render its page.
  await page.locator('input[type=file]').setInputFiles(pdfPath);
  await page.getByRole('button', { name: 'Use this page' }).click();
  await page.getByText(/Loading underlay|Rendering PDF page/).waitFor({ state: 'hidden', timeout: 30000 });

  // Command palette, shortcut overview, preview and panel controls.
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.waitFor();
  await page.getByLabel('Search commands').fill('preview');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Exit preview' }).waitFor();
  await page.getByRole('button', { name: 'Exit preview' }).click();
  await circuitsSection.getByText('L1', { exact: true }).waitFor();

  await page.keyboard.press('?');
  const hotkeys = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await hotkeys.waitFor();
  await hotkeys.getByRole('button', { name: 'Close shortcuts' }).click();

  await page.getByRole('button', { name: 'Hide panels' }).click();
  await page.getByRole('button', { name: 'Show panels' }).click();
  await circuitsSection.getByText('L1', { exact: true }).waitFor();

  await page.getByRole('button', { name: '110%', exact: true }).click();
  if ((await page.locator('[style*="zoom: 1.1"]').count()) === 0) {
    throw new Error('Interface scale was not applied.');
  }
  await page.getByRole('button', { name: '100%', exact: true }).click();

  const roomNav = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Room navigation', exact: true }),
  });
  await roomNav.getByRole('button').first().click();
  if (
    (await roomNav.getByRole('button').first().getAttribute('aria-pressed')) !==
    'true'
  ) {
    throw new Error('Room navigation did not select the room.');
  }

  const orthoToggle = page.getByRole('button', {
    name: 'Orthogonal routing',
  });
  await orthoToggle.click();
  if ((await orthoToggle.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('Orthogonal routing toggle did not activate.');
  }
  await orthoToggle.click();

  // Validation aggregates plan issues and jumps to the affected device.
  const validationSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Validation', exact: true }),
  });
  const isolatedIssue = validationSection.getByRole('button', {
    name: /Devices not connected to any route/,
  });
  await isolatedIssue.waitFor({ timeout: 15000 });
  await isolatedIssue.click();
  await page.getByRole('button', { name: 'Duplicate' }).waitFor();

  // Hide the devices layer; it must survive a reload and be restorable.
  const layersSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Layers', exact: true }),
  });
  const devicesToggle = layersSection.getByRole('button', {
    name: 'Devices',
    exact: true,
  });
  await devicesToggle.click();
  if ((await devicesToggle.getAttribute('aria-pressed')) !== 'false') {
    throw new Error('Devices layer did not hide.');
  }

  await page.reload();
  await page.waitForURL('**/editor');
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });
  await circuitsSection.getByText('L1', { exact: true }).waitFor();
  const reloadedDevicesToggle = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Layers', exact: true }),
    })
    .getByRole('button', { name: 'Devices', exact: true });
  if ((await reloadedDevicesToggle.getAttribute('aria-pressed')) !== 'false') {
    throw new Error('Layer visibility did not persist across reload.');
  }
  await reloadedDevicesToggle.click();

  // Local-first: create an anonymous project, draw a wall, and reload it.
  await page.goto(`${WEB}/local`);
  await page.getByPlaceholder('New local project').fill('Local check');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL('**/local/*');
  await page.locator('canvas').waitFor();
  await page.getByText('Plan scale is not calibrated.').waitFor();

  await page.keyboard.press('Control+k');
  const localPalette = page.getByRole('dialog', { name: 'Command palette' });
  await localPalette.waitFor();
  await page.getByLabel('Search commands').fill('preview');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Exit preview' }).waitFor();
  await page.getByRole('button', { name: 'Exit preview' }).click();

  await page.keyboard.press('?');
  const localHotkeys = page.getByRole('dialog', {
    name: 'Keyboard shortcuts',
  });
  await localHotkeys.waitFor();
  await localHotkeys.getByRole('button', { name: 'Close shortcuts' }).click();

  const localCanvas = await page.locator('canvas').boundingBox();
  if (!localCanvas) throw new Error('Local canvas is not visible');
  await page.getByRole('button', { name: 'Draw wall tool' }).click();
  await page.mouse.click(
    localCanvas.x + localCanvas.width * 0.3,
    localCanvas.y + localCanvas.height * 0.5,
  );
  await page.mouse.click(
    localCanvas.x + localCanvas.width * 0.7,
    localCanvas.y + localCanvas.height * 0.5,
  );
  await page.keyboard.press('Enter');
  await page.getByText('Saved locally').waitFor({ timeout: 10000 });
  await page.reload();
  await page.waitForURL('**/local/*');
  await page.locator('canvas').waitFor();

  // Export, import and sync the local project.
  await page.goto(`${WEB}/local`);
  const localRow = page.getByRole('listitem').filter({ hasText: 'Local check' });
  const exportPromise = page.waitForEvent('download');
  await localRow.getByRole('button', { name: /JSON/ }).click();
  const exported = await exportPromise;
  if (!exported.suggestedFilename().endsWith('.json')) {
    throw new Error('Local project was not exported as JSON');
  }
  const exportPath = await exported.path();
  if (!exportPath) throw new Error('Export path is missing');

  await page.locator('input[type=file]').setInputFiles(exportPath);
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Local check' })
    .nth(1)
    .waitFor({ timeout: 10000 });

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Local check' })
    .first()
    .getByRole('button', { name: /Sync to account/ })
    .click();
  await page.waitForURL('**/app/projects/*/editor', { timeout: 30000 });
  await page.getByText('Save state').waitFor({ timeout: 20000 });

  // Documentation workspace: materials, estimates, validation and print.
  const docsUrl = page.url().replace(/\/editor$/, '/documentation');
  await page.goto(docsUrl);
  await page.getByRole('heading', { name: 'Documentation', exact: true }).waitFor({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Cost estimate' }).click();
  await page.getByText('No estimates have been generated yet.').waitFor();
  await page.getByRole('button', { name: 'Validation', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Validation', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Print PDF' }).click();
  await page.getByRole('button', { name: 'Print / Save as PDF' }).waitFor();
  await page.getByRole('button', { name: 'Variants', exact: true }).click();
  await page.getByText('No variants yet.').waitFor();

  console.log(JSON.stringify({ ok: true, errors }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
