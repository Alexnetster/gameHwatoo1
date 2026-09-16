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
    page.on('requestfailed', (request) => errors.push(new Error(`${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`)));

    await page.goto(`${baseUrl}/?seed=smoke-${viewport.name}`, { waitUntil: 'networkidle' });
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 5_000 });
    await page.locator('#start-modal').waitFor({ state: 'visible' });
    await page.locator('#btn-start').click();
    await page.locator('#start-modal').waitFor({ state: 'hidden' });
    await page.locator('#game-container canvas').waitFor({ state: 'attached' });

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
