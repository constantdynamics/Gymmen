const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

/**
 * Zoekt een bruikbare Chromium.
 * 1. CHROMIUM_PATH als die gezet is
 * 2. de vooraf geïnstalleerde browser uit PLAYWRIGHT_BROWSERS_PATH
 * 3. anders: laat Playwright zelf kiezen (`npx playwright install chromium`)
 */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    const dir = fs.readdirSync(base).find(d => /^chromium-\d+$/.test(d));
    if (dir) {
      const bin = path.join(base, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(bin)) return bin;
    }
  }
  return undefined;
}

const executablePath = findChromium();

module.exports = defineConfig({
  testDir: './tests',
  // Elke test start een eigen browser; in een kleine container is 2 workers
  // sneller dan alles tegelijk.
  workers: process.env.CI ? 2 : 2,
  fullyParallel: false,
  // Ruim genomen: de tests die alle tien views langslopen hebben op een
  // trage machine meer dan 30 s nodig.
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [['line']],
  use: {
    // GymWave is één bestand zonder server; de tests laden het via file://
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 780 },
    isMobile: false,          // hasTouch/isMobile hoeft niet en scheelt flakiness
    launchOptions: executablePath ? { executablePath } : {},
  },
});
