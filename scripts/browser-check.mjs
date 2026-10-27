/* global process, Buffer, console, document, fetch, localStorage, history, location, window */
import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
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
  await page.locator('header').first().waitFor();
  const headerPosition = await page.evaluate(() => {
    const header = document.querySelector('header');
    return header ? window.getComputedStyle(header).position : '';
  });
  if (headerPosition !== 'sticky') {
    throw new Error(`Workspace header is not sticky: ${headerPosition}`);
  }

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
  try {
    await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });
  } catch (underlayError) {
    await page.screenshot({ path: path.join(dir, 'underlay-failure.png') });
    console.error('Underlay diagnostics', {
      errors,
      body: (await page.locator('body').innerText()).slice(0, 1200),
    });
    throw underlayError;
  }

  // Design-token and data-tour contracts stay stable across the refresh.
  const designContract = await page.evaluate(() => {
    const styles = window.getComputedStyle(document.documentElement);
    return {
      brand: styles.getPropertyValue('--dmp-color-brand').trim(),
      panel: styles.getPropertyValue('--panel-border').trim(),
      targets: ['editor-toolbar', 'editor-canvas', 'circuits', 'validation', 'save'].every(
        (name) => Boolean(document.querySelector(`[data-tour="${name}"]`)),
      ),
    };
  });
  if (!designContract.brand || !designContract.panel) {
    throw new Error('Semantic design tokens are missing.');
  }
  if (!designContract.targets) {
    throw new Error('The data-tour contract is incomplete.');
  }

  // First-run tour: five steps, completes once and is stored on the account.
  const tour = page.getByTestId('editor-tour');
  await tour.waitFor({ timeout: 15000 });
  for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
    await tour.getByRole('button', { name: 'Next', exact: true }).click();
  }
  const onboardingSaved = page.waitForResponse(
    (response) =>
      response.url().includes('/users/me/onboarding') &&
      response.request().method() === 'PATCH',
    { timeout: 10000 },
  );
  await tour.getByRole('button', { name: 'Finish tour', exact: true }).click();
  await onboardingSaved;
  await tour.waitFor({ state: 'detached', timeout: 10000 });
  const onboardingResponse = await page.request.get(
    `${WEB}/api/v1/users/me/onboarding`,
  );
  if (!onboardingResponse.ok()) {
    throw new Error('Onboarding state endpoint did not respond.');
  }
  const onboarding = await onboardingResponse.json();
  if (onboarding.editorTour !== 'completed') {
    throw new Error(`Tour state was not stored: ${JSON.stringify(onboarding)}`);
  }
  await page.reload();
  await page.waitForURL('**/editor');
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });
  if (await page.getByTestId('editor-tour').isVisible().catch(() => false)) {
    throw new Error('Completed tour was shown again after reload.');
  }

  // `?tour=editor` replays the tour for demos and the `?tour=off` switch is
  // covered by the same provider; skipping keeps it dismissed for this load.
  await page.goto(`${page.url().split('?')[0]}?tour=editor`);
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });
  const replayTour = page.getByTestId('editor-tour');
  await replayTour.waitFor({ timeout: 10000 });
  await replayTour.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await replayTour.waitFor({ state: 'detached', timeout: 10000 });
  if (await page.getByTestId('editor-tour').isVisible().catch(() => false)) {
    throw new Error('Skipped tour stayed visible.');
  }
  await page.evaluate(() => history.replaceState({}, '', location.pathname));

  // The quick guide is visible on the first editor visit, has a full-screen
  // walkthrough and can be collapsed afterwards.
  await page.getByText('Quick guide', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open full guide' }).click();
  const fullGuide = page.getByRole('dialog', { name: 'How to use the editor' });
  await fullGuide.waitFor();
  await fullGuide.getByRole('button', { name: 'Start drawing' }).click();
  await page.getByRole('button', { name: 'Hide quick guide' }).click();

  // Icon controls show a styled tooltip with a usage hint.
  await page.getByRole('button', { name: 'Draw wall tool' }).hover();
  const tooltip = page.getByRole('tooltip');
  await tooltip.waitFor({ timeout: 5000 });
  if (!(await tooltip.innerText()).includes('trace a wall')) {
    throw new Error('Toolbar tooltip did not show its usage hint.');
  }

  // Fullscreen uses the browser API and exits cleanly with Esc.
  const fullscreenButton = page.getByTestId('editor-fullscreen');
  await fullscreenButton.click();
  await page.waitForFunction(() => document.fullscreenElement !== null);
  if ((await fullscreenButton.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('Fullscreen button did not reflect the active state.');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Headless Chromium does not implement the browser-level Esc exit, so fall
  // back to the same button there. Real browsers exit on Esc.
  if (await page.evaluate(() => document.fullscreenElement !== null)) {
    await fullscreenButton.click();
  }
  await page.waitForFunction(() => document.fullscreenElement === null);
  await page.getByRole('button', { name: 'Fullscreen editor' }).waitFor();
  await page.locator('canvas').first().waitFor();

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
  const serverEditorUrl = page.url();
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

  // Hover hints describe plan objects and can be switched off.
  await page.getByRole('button', { name: 'Select tool' }).click();
  await syncCanvas();
  await page.mouse.move(at(0.35, 0.6).x, at(0.35, 0.6).y);
  const hoverTooltip = page.getByTestId('canvas-hover-tooltip');
  await hoverTooltip.waitFor({ timeout: 3000 });
  if (!(await hoverTooltip.innerText()).includes('Circuit')) {
    throw new Error('Point hover tooltip did not show its circuit.');
  }
  await page.mouse.move(at(0.5, 0.57).x, at(0.5, 0.57).y);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="canvas-hover-tooltip"]')
        ?.textContent?.includes('Installation') === true,
    null,
    { timeout: 3000 },
  );
  await page.mouse.move(at(0.32, 0.5).x, at(0.32, 0.5).y);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="canvas-hover-tooltip"]')
        ?.textContent?.includes('Thickness') === true,
    null,
    { timeout: 3000 },
  );
  await page.mouse.move(at(0.4, 0.72).x, at(0.4, 0.72).y);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="canvas-hover-tooltip"]')
        ?.textContent?.includes('Area') === true,
    null,
    { timeout: 3000 },
  );

  const hoverToggle = page.getByRole('button', { name: 'Disable hover hints' });
  await hoverToggle.click();
  if ((await page.evaluate(() => localStorage.getItem('dmp:editor:hoverHints'))) !== 'false') {
    throw new Error('Hover hints preference was not stored.');
  }
  await page.mouse.move(at(0.35, 0.6).x, at(0.35, 0.6).y);
  await page.waitForTimeout(600);
  if (await hoverTooltip.isVisible().catch(() => false)) {
    throw new Error('Hover tooltip stayed visible after disabling hints.');
  }
  await page.getByRole('button', { name: 'Enable hover hints' }).click();
  if ((await page.evaluate(() => localStorage.getItem('dmp:editor:hoverHints'))) !== 'true') {
    throw new Error('Hover hints preference was not restored.');
  }

  // Touch long-press shows the same tooltip after 500 ms.
  await page.dispatchEvent('canvas', 'pointerdown', {
    pointerType: 'touch',
    pointerId: 51,
    isPrimary: true,
    button: 0,
    clientX: at(0.35, 0.6).x,
    clientY: at(0.35, 0.6).y,
  });
  await page.waitForTimeout(650);
  if (!(await hoverTooltip.isVisible().catch(() => false))) {
    throw new Error('Touch long-press did not show a hover tooltip.');
  }
  await page.dispatchEvent('canvas', 'pointerup', {
    pointerType: 'touch',
    pointerId: 51,
    isPrimary: true,
    button: 0,
    clientX: at(0.35, 0.6).x,
    clientY: at(0.35, 0.6).y,
  });

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

  // Standard device library: attach a real article to the selected socket.
  const libraryPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Device library', exact: true }),
  });
  await libraryPanel.scrollIntoViewIfNeeded();
  await libraryPanel.getByLabel('Search the device library').fill('SDN3002171');
  const assignResponse = page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/v1/points/') &&
        response.request().method() === 'PATCH',
      { timeout: 8000 },
    )
    .catch(() => null);
  await libraryPanel.getByRole('button', { name: 'Assign', exact: true }).click();
  if (!(await assignResponse)) {
    await page.screenshot({ path: path.join(dir, 'library-failure.png') });
    throw new Error('Library assign did not send a point update.');
  }
  const articleSelect = page
    .getByRole('combobox')
    .filter({ has: page.locator('option[value="schneider-sedna-double"]') });
  await articleSelect.waitFor({ timeout: 10000 });
  if ((await articleSelect.inputValue()) !== 'schneider-sedna-double') {
    throw new Error('Library article was not attached to the selected point.');
  }

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
  // The route end snapped to the socket is explicitly pinned; detaching and
  // reattaching must keep the endpoint in place and only change the link.
  const pinStart = page.getByTestId('route-pin-status-start');
  await pinStart.waitFor();
  if ((await pinStart.innerText()).trim() === 'Free end') {
    throw new Error('Route start was not pinned to the socket automatically.');
  }
  const pinEnd = page.getByTestId('route-pin-status-end');
  if ((await pinEnd.innerText()).trim() !== 'Free end') {
    throw new Error('A route end drawn away from points should stay free.');
  }
  await page.getByTestId('route-detach-start').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="route-pin-status-start"]')
        ?.textContent?.includes('Free end') === true,
  );
  await page.getByTestId('route-attach-start').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="route-pin-status-start"]')
        ?.textContent?.includes('Free end') === false,
  );

  // Live takeoff reflects calibrated walls, rooms, devices and cable.
  const takeoffSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Live takeoff', exact: true }),
  });
  await takeoffSection.getByText('Calibrated', { exact: true }).waitFor();
  const deviceRow = takeoffSection
    .getByText('Total devices', { exact: true })
    .last()
    .locator('..');
  await deviceRow.getByText('2', { exact: true }).waitFor();
  const wallLengthRow = takeoffSection
    .getByText('Wall length', { exact: true })
    .last()
    .locator('..');
  if ((await wallLengthRow.innerText()).includes('—')) {
    throw new Error('Live takeoff did not calculate wall length.');
  }
  const cableRow = takeoffSection
    .getByText('Cable with waste', { exact: true })
    .last()
    .locator('..');
  if ((await cableRow.innerText()).includes('—')) {
    throw new Error('Live takeoff did not calculate cable length.');
  }

  // Engineering calculation runs live for every circuit.
  const electricalSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Electrical calculation', exact: true }),
  });
  await electricalSection.getByText('Coordinated', { exact: true }).waitFor();
  const electricalCurrent = electricalSection.getByText('Max current').locator('..');
  if ((await electricalCurrent.innerText()).includes('—')) {
    throw new Error('Electrical calculation did not produce a design current.');
  }
  await electricalSection.getByText('L1', { exact: true }).first().waitFor();

  // Panel schedule lays out protection modules and exports CSV.
  const panelSection = page.getByTestId('panel-schedule');
  await panelSection.waitFor();
  await panelSection.getByText(/\/ 36/).waitFor();
  const panelDownload = page.waitForEvent('download');
  await panelSection.getByTestId('panel-export-csv').click();
  const panelFile = await panelDownload;
  if (!panelFile.suggestedFilename().endsWith('.csv')) {
    throw new Error('Panel schedule CSV export did not produce a CSV file.');
  }

  // Mis-sized protection blocks estimate generation until it is fixed.
  const cableSelect = electricalSection.getByLabel('Default cable');
  const breakerSelect = electricalSection.getByLabel('Default breaker');
  await cableSelect.selectOption('1.5');
  await breakerSelect.selectOption('20');
  await electricalSection.getByText('Errors 1', { exact: true }).waitFor();
  if (!(await page.getByRole('button', { name: 'Generate estimate' }).isDisabled())) {
    throw new Error('Critical electrical error did not block the estimate.');
  }
  await cableSelect.selectOption('2.5');
  await breakerSelect.selectOption('16');
  await electricalSection.getByText('Coordinated', { exact: true }).waitFor();
  if (await page.getByRole('button', { name: 'Generate estimate' }).isDisabled()) {
    throw new Error('Estimate stayed blocked after fixing the protection.');
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
  let download;
  try {
    [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /GLB/ }).click(),
    ]);
  } catch (downloadError) {
    await page.screenshot({ path: path.join(dir, 'glb-failure.png') });
    console.error('GLB diagnostics', {
      errors,
      body: (await page.locator('body').innerText()).slice(-500),
    });
    throw downloadError;
  }
  if (!download.suggestedFilename().endsWith('.glb')) {
    throw new Error(`Unexpected GLB filename: ${download.suggestedFilename()}`);
  }

  // Advanced 3D modes: walk, x-ray, daylight, section and isolation.
  await page.getByRole('button', { name: 'Walk', exact: true }).click();
  await page.getByText(/WASD to move/).waitFor();
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  const xrayButton = page.getByRole('button', { name: 'X-ray', exact: true });
  await xrayButton.click();
  if ((await xrayButton.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('X-ray mode did not activate.');
  }
  await page.getByRole('button', { name: 'Daylight', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Section' }).check();
  await page.getByRole('slider', { name: /Cut at/ }).waitFor();
  const isolateButton = page.getByRole('button', {
    name: 'Isolate',
    exact: true,
  });
  await isolateButton.click();
  if ((await isolateButton.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('3D isolation did not activate.');
  }
  await isolateButton.click();
  await page.getByRole('checkbox', { name: 'Section' }).uncheck();
  await xrayButton.click();

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

  // SVG plan, schematic and full project JSON exports.
  const exportSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Export', exact: true }),
  });
  const planSvgPromise = page.waitForEvent('download');
  await exportSection.getByRole('button', { name: 'Plan SVG' }).click();
  const planSvg = await planSvgPromise;
  if (!planSvg.suggestedFilename().endsWith('.svg')) {
    throw new Error(`Unexpected plan SVG name: ${planSvg.suggestedFilename()}`);
  }
  const schematicSvgPromise = page.waitForEvent('download');
  await exportSection.getByRole('button', { name: 'Schematic SVG' }).click();
  const schematicSvg = await schematicSvgPromise;
  if (!schematicSvg.suggestedFilename().endsWith('.svg')) {
    throw new Error(
      `Unexpected schematic SVG name: ${schematicSvg.suggestedFilename()}`,
    );
  }
  const schematicPath = await schematicSvg.path();
  if (!schematicPath) throw new Error('Schematic SVG file is unavailable.');
  const schematicMarkup = await readFile(schematicPath, 'utf8');
  for (const token of [
    'INCOMING SUPPLY',
    'Q1-1L1',
    'QF1',
    'W1',
    'X1:1',
    '2.5 mm² copper',
  ]) {
    if (!schematicMarkup.includes(token)) {
      throw new Error(`Schematic SVG is missing "${token}".`);
    }
  }
  const journalPromise = page.waitForEvent('download');
  await exportSection.getByRole('button', { name: 'Cable journal CSV' }).click();
  const journal = await journalPromise;
  const journalPath = await journal.path();
  if (!journalPath) throw new Error('Cable journal file is unavailable.');
  const journalText = await readFile(journalPath, 'utf8');
  for (const token of ['Q1-1L1', 'W1', 'X1:1', '16 A C']) {
    if (!journalText.includes(token)) {
      throw new Error(`Cable journal is missing "${token}".`);
    }
  }
  const projectJsonPromise = page.waitForEvent('download');
  await exportSection.getByRole('button', { name: 'Project JSON' }).click();
  const projectJson = await projectJsonPromise;
  if (!projectJson.suggestedFilename().endsWith('.json')) {
    throw new Error(
      `Unexpected project JSON name: ${projectJson.suggestedFilename()}`,
    );
  }

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

  const reloadedRouteSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Cable routes', exact: true }),
  });
  await reloadedRouteSection.getByRole('button').first().click();
  const persistedPin = page.getByTestId('route-pin-status-start');
  await persistedPin.waitFor();
  if ((await persistedPin.innerText()).trim() === 'Free end') {
    throw new Error('Route pin did not persist across reload.');
  }

  // Move the pinned device on the canvas; the cable end must follow it.
  const planId = await page.locator('[data-plan-id]').getAttribute('data-plan-id');
  const viewportData = JSON.parse(
    (await page.locator('[data-viewport]').getAttribute('data-viewport')) ??
      '{"x":0,"y":0,"zoom":1}',
  );
  const moveBox = await page.locator('canvas').first().boundingBox();
  const drawingBefore = await page.evaluate(
    async (id) => (await fetch(`/api/v1/plans/${id}/drawing`)).json(),
    planId,
  );
  const pinnedRoute = drawingBefore.routes.find((route) => route.startPointId);
  const pinnedPoint = drawingBefore.points.find(
    (point) => point.id === pinnedRoute?.startPointId,
  );
  if (!moveBox || !pinnedRoute || !pinnedPoint) {
    throw new Error('Pinned route or point is missing after reload.');
  }
  const toScreen = (x, y) => ({
    x: moveBox.x + moveBox.width / 2 + (x - viewportData.x) * viewportData.zoom,
    y: moveBox.y + moveBox.height / 2 + (y - viewportData.y) * viewportData.zoom,
  });
  const from = toScreen(pinnedPoint.x, pinnedPoint.y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 18, from.y + 12, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(
    async ({ id, routeId, pointId }) => {
      const data = await (await fetch(`/api/v1/plans/${id}/drawing`)).json();
      const route = data.routes.find((item) => item.id === routeId);
      const point = data.points.find((item) => item.id === pointId);
      if (!route || !point) return false;
      return (
        Math.abs(route.geometry[0].x - point.x) < 1e-6 &&
        Math.abs(route.geometry[0].y - point.y) < 1e-6
      );
    },
    {
      id: planId,
      routeId: pinnedRoute.id,
      pointId: pinnedPoint.id,
    },
    { timeout: 15000 },
  );

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

  // Local-first demo project loads with rooms, circuits and routes.
  await page.goto(`${WEB}/local`);
  await page.getByText(/New here\?/).waitFor();
  await page.getByRole('button', { name: 'Load demo' }).click();
  await page.waitForURL('**/local/*');
  await page.locator('canvas').waitFor();
  if ((await page.getByLabel('Project name').inputValue()) !== 'Demo apartment') {
    throw new Error('Demo project name was not loaded.');
  }
  await page.getByText('Living room').first().waitFor();
  await page.getByText(/Lighting/).first().waitFor();

  const demoElectrical = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Electrical calculation', exact: true }),
  });
  await demoElectrical.getByText('Coordinated', { exact: true }).waitFor();
  await demoElectrical.getByText('Demand', { exact: true }).waitFor();
  await demoElectrical.getByText(/L2/).first().waitFor();

  // Create an anonymous project, draw a wall, and reload it.
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
  // Report templates: the synced local project only has a wall, so the
  // equipment preview shows its empty state.
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Report templates', exact: true })
    .waitFor();
  await page
    .getByText('Nothing to report yet. Add devices, circuits and routes in the editor.')
    .waitFor();
  // The original server project has devices and routes: test field selection
  // and real XLSX downloads there.
  await page.goto(serverEditorUrl.replace(/\/editor$/, '/documentation'));
  await page
    .getByRole('heading', { name: 'Documentation', exact: true })
    .waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Report templates', exact: true })
    .waitFor();
  const reportTable = page.locator('table.report-table').first();
  await reportTable.waitFor();
  if ((await reportTable.locator('tbody tr').count()) < 1) {
    throw new Error('Equipment report preview is empty.');
  }
  if (!(await reportTable.innerText()).includes('SDN3002171')) {
    throw new Error('Equipment report is missing the linked device article.');
  }
  const mountingChip = page.getByRole('button', {
    name: 'Mounting',
    exact: true,
  });
  await mountingChip.click();
  if (
    (await reportTable.locator('thead').innerText())
      .toLowerCase()
      .includes('mounting')
  ) {
    throw new Error('Deselected report field is still visible.');
  }
  await mountingChip.click();
  const [reportDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excel', exact: true }).click(),
  ]);
  const reportPath = path.join(dir, 'reports.xlsx');
  await reportDownload.saveAs(reportPath);
  const reportBytes = await readFile(reportPath);
  if (reportBytes[0] !== 0x50 || reportBytes[1] !== 0x4b) {
    throw new Error('Excel export is not an XLSX (ZIP) file.');
  }
  if (reportBytes.length < 1000) {
    throw new Error('Excel export is unexpectedly small.');
  }
  await page.getByRole('tab', { name: 'Cable journal' }).click();
  await page
    .getByRole('tab', { name: 'Cable journal', selected: true })
    .waitFor();
  await page
    .locator('table.report-table thead')
    .getByText('Wire', { exact: true })
    .waitFor();
  const journalHeader = await page
    .locator('table.report-table thead')
    .first()
    .innerText();
  if (!journalHeader.toLowerCase().includes('address')) {
    throw new Error(
      `Cable journal preview is missing its address column: ${journalHeader}`,
    );
  }
  const [allReportsDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'All reports (Excel)' }).last().click(),
  ]);
  const allReportsPath = path.join(dir, 'all-reports.xlsx');
  await allReportsDownload.saveAs(allReportsPath);
  const allReportsBytes = await readFile(allReportsPath);
  if (allReportsBytes[0] !== 0x50 || allReportsBytes.length < 2000) {
    throw new Error('Combined report workbook was not generated.');
  }
  const [ifcDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'IFC for BIM' }).first().click(),
  ]);
  const ifcPath = path.join(dir, 'project.ifc');
  await ifcDownload.saveAs(ifcPath);
  const ifcText = await readFile(ifcPath, 'utf8');
  if (
    !ifcText.startsWith('ISO-10303-21;') ||
    !ifcText.includes("FILE_SCHEMA(('IFC4'))") ||
    !ifcText.includes('IFCWALL(') ||
    !ifcText.includes('IFCCABLESEGMENT(')
  ) {
    throw new Error('IFC export is missing its STEP header or plan entities.');
  }
  // The remaining documentation checks use the synced local project.
  await page.goto(docsUrl);
  await page
    .getByRole('heading', { name: 'Documentation', exact: true })
    .waitFor({ timeout: 20000 });
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
