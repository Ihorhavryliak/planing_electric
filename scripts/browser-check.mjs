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

  await page.getByPlaceholder('Test apartment').fill('Browser Check Project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: /open project/i }).first().click();

  await page.getByPlaceholder('Variant name').fill('Base variant');
  await page.getByRole('button', { name: 'Save snapshot' }).click();
  await page.getByRole('cell', { name: 'Base variant' }).waitFor();

  await page.getByRole('link', { name: /open plan editor/i }).click();

  await page.getByRole('button', { name: 'Add floor' }).click();
  await page.getByPlaceholder('Floor 1').fill('Floor A');
  await page.getByRole('button', { name: 'Create floor' }).click();

  const fileInput = page.locator('input[type=file]');
  await fileInput.setInputFiles(pngPath);
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });

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
  const canvasBox = await planCanvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas is not visible');
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
  await page.getByText('Openings', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add door' }).click();
  await page.getByRole('button', { name: 'Add window' }).click();

  const at = (x, y) => ({
    x: canvasBox.x + canvasBox.width * x,
    y: canvasBox.y + canvasBox.height * y,
  });

  // Calibrate so the calculation panel can show real lengths.
  await page.getByRole('button', { name: 'Calibrate scale tool' }).click();
  await page.mouse.click(at(0.2, 0.2).x, at(0.2, 0.2).y);
  await page.mouse.click(at(0.8, 0.2).x, at(0.8, 0.2).y);
  await page.getByLabel('Real distance').fill('4');
  await page.getByRole('button', { name: 'Set scale' }).click();

  // Place a socket and draw a cable route between two points.
  await page.getByRole('button', { name: 'Place socket' }).click();
  await page.mouse.click(at(0.35, 0.6).x, at(0.35, 0.6).y);
  await page.getByRole('button', { name: 'Draw cable route tool' }).click();
  await page.mouse.click(at(0.35, 0.6).x, at(0.35, 0.6).y);
  await page.mouse.click(at(0.65, 0.6).x, at(0.65, 0.6).y);
  await page.keyboard.press('Enter');

  // Room outline and a dimension.
  await page.getByRole('button', { name: 'Draw room outline tool' }).click();
  await page.mouse.click(at(0.25, 0.7).x, at(0.25, 0.7).y);
  await page.mouse.click(at(0.55, 0.7).x, at(0.55, 0.7).y);
  await page.mouse.click(at(0.55, 0.85).x, at(0.55, 0.85).y);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Add dimension tool' }).click();
  await page.mouse.click(at(0.25, 0.7).x, at(0.25, 0.7).y);
  await page.mouse.click(at(0.55, 0.7).x, at(0.55, 0.7).y);

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
  await page.getByRole('button', { name: '2D edit' }).click();

  // Replace the raster plan with a PDF and render its page.
  await page.locator('input[type=file]').setInputFiles(pdfPath);
  await page.getByRole('button', { name: 'Use this page' }).click();
  await page.getByText(/Loading underlay|Rendering PDF page/).waitFor({ state: 'hidden', timeout: 30000 });

  await page.reload();
  await page.waitForURL('**/editor');
  await page.getByText('Underlay', { exact: true }).waitFor({ timeout: 20000 });

  // Local-first: create an anonymous project, draw a wall, and reload it.
  await page.goto(`${WEB}/local`);
  await page.getByPlaceholder('New local project').fill('Local check');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL('**/local/*');
  await page.locator('canvas').waitFor();
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

  console.log(JSON.stringify({ ok: true, errors }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
