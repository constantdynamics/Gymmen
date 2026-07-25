const path = require('path');

const APP_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

/** Alle views die de app kent, in de volgorde waarin ze in de DOM staan. */
const VIEWS = ['home', 'session', 'coach', 'goals', 'thuis', 'homeworkout',
  'stats', 'tips', 'checklist', 'settings'];

/** Opent de app en klikt de onboarding weg met het standaardschema. */
async function openApp(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    // netwerkfouten van Google Fonts / de Supabase-CDN horen bij file:// draaien
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_CONNECTION|ERR_NAME|ERR_INTERNET|fonts\.|jsdelivr/.test(t)) {
      errors.push('console: ' + t);
    }
  });
  page.__errors = errors;
  await page.goto(APP_URL);
  await page.waitForFunction(() => typeof window.route === 'function');
  if (await page.locator('#ob-preset').isVisible().catch(() => false)) {
    await page.click('#ob-preset');
    await page.waitForTimeout(300);
  }
  return errors;
}

/** Vult geschiedenis zodat grafieken, PR's en wachttijd-kleuren echt data hebben. */
async function seedHistory(page) {
  await page.evaluate(() => {
    const ms = store.machines().filter(m => !m.cardio);
    store.setSessions([22, 17, 12, 8, 3].map((d, i) => {
      const dt = new Date(Date.now() - d * 86400000);
      return {
        id: 'seed' + i, date: dt.toISOString().slice(0, 10), name: 'Full body',
        endedAt: dt.toISOString(),
        entries: ms.map((m, j) => ({ machineId: m.id, weight: 40 + i * 6 + j * 3, sets: 3, reps: 12, feeling: 3 })),
      };
    }));
    store.setHomeSessions([10, 6, 2].map((d, i) => {
      const dt = new Date(Date.now() - d * 86400000);
      return {
        date: dt.toISOString().slice(0, 10), endedAt: dt.toISOString(),
        entries: [
          { exerciseName: 'Goblet squat', value: 10 + i * 2, metric: 'reps', weight: 16 },
          { exerciseName: 'Plank', value: 30 + i * 5, metric: 'sec' },
        ],
      };
    }));
    store.setCalf([4, 3, 2, 1].map((d, i) => ({
      date: new Date(Date.now() - d * 86400000).toISOString().slice(0, 10),
      mode: 'L', reps: 12 + i * 4,
    })));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.route === 'function');
  await page.waitForTimeout(400);
}

async function goto(page, view) {
  await page.evaluate(v => route(v), view);
  await page.waitForTimeout(250);
}

/** Zichtbare tekstknopen die een emoji of icoon-achtig unicode-teken bevatten. */
async function visibleGlyphs(page) {
  return page.evaluate(() => {
    const re = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿⬀-⯿−]/u;
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!re.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || !el.offsetParent) continue;
      out.push((el.id || el.className || el.tagName) + ' :: ' + n.nodeValue.trim().slice(0, 60));
    }
    return out;
  });
}

module.exports = { APP_URL, VIEWS, openApp, seedHistory, goto, visibleGlyphs };
