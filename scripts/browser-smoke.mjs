import { chromium } from 'playwright';

const baseUrl = process.env.BROWSER_SMOKE_URL ?? 'http://127.0.0.1:5173';
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for Vite dev server');
}

await waitForServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(new Error(`console: ${message.text()}`));
    });
    page.on('requestfailed', (request) => errors.push(new Error(`${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`)));

    await page.goto(`${baseUrl}/?seed=smoke-${viewport.name}`, { waitUntil: 'networkidle' });
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 5_000 });
    await page.locator('#start-modal').waitFor({ state: 'visible' });
    await page.locator('#target-score').selectOption('7');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 5_000 });
    await page.locator('#start-modal').waitFor({ state: 'visible' });
    if (await page.locator('#target-score').inputValue() !== '7') {
      throw new Error(`${viewport.name}: target score setting was not restored (value=${await page.locator('#target-score').inputValue()}, storage=${await page.evaluate(() => localStorage.getItem('hwatu-rule-settings'))})`);
    }
    await page.locator('#btn-start').click();
    await page.locator('#start-modal').waitFor({ state: 'hidden' });
    await page.locator('#game-container canvas').waitFor({ state: 'attached' });

    const scorePanel = page.locator('#score-panel');
    await page.locator('#btn-score-details').click();
    await scorePanel.waitFor({ state: 'visible' });
    if ((await scorePanel.getAttribute('aria-hidden')) !== 'false') {
      throw new Error(`${viewport.name}: score panel did not become accessible`);
    }
    await page.locator('#btn-score-panel-close').click();
    await page.waitForFunction(() => document.querySelector('#score-panel')?.getAttribute('aria-hidden') === 'true');

    const captureToggle = page.locator('#btn-capture-toggle');
    const captureBefore = await captureToggle.getAttribute('aria-pressed');
    await captureToggle.click();
    if ((await captureToggle.getAttribute('aria-pressed')) === captureBefore) {
      throw new Error(`${viewport.name}: capture notice toggle did not change state`);
    }

    const audioToggle = page.locator('#btn-audio-toggle');
    const audioBefore = await audioToggle.getAttribute('aria-pressed');
    await audioToggle.click();
    if ((await audioToggle.getAttribute('aria-pressed')) === audioBefore) {
      throw new Error(`${viewport.name}: audio toggle did not change state`);
    }

    await page.locator('#btn-restart').click();
    await page.waitForTimeout(100);
    if (await page.locator('#start-modal').isVisible()) {
      throw new Error(`${viewport.name}: header restart unexpectedly opened start modal`);
    }
    if ((await page.locator('#game-container canvas').count()) !== 1) {
      throw new Error(`${viewport.name}: restart did not preserve one game canvas`);
    }

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      canvasCount: document.querySelectorAll('#game-container canvas').length,
    }));
    if (layout.documentWidth > layout.viewportWidth) {
      throw new Error(`${viewport.name}: horizontal overflow ${layout.documentWidth} > ${layout.viewportWidth}`);
    }
    if (layout.canvasCount !== 1) throw new Error(`${viewport.name}: expected one game canvas`);
    if (errors.length > 0) throw new AggregateError(errors, `${viewport.name}: browser errors detected`);
    console.log(`ok ${viewport.name} ${viewport.width}x${viewport.height}`);
    void page.close();
  }
} finally {
  void browser.close();
}
process.exit(0);
