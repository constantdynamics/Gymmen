const { test, expect } = require('@playwright/test');
const { openApp, goto, visibleGlyphs } = require('./helpers');

/* ============================================================
   Push-ups en sit-ups — zelfde tracker als calf raises,
   zonder standenrij, in donker- en lichtroze.
   ============================================================ */

/** Vult een paar pogingen zodat PR's en wachttijd-kleuren data hebben. */
async function seedReps(page) {
  await page.evaluate(() => {
    const d = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    store.setCalf([{ date: d(3), mode: 'L', reps: 20 }]);
    store.setPushups([{ date: d(5), reps: 18 }, { date: d(2), reps: 24 }]);
    store.setSitups([{ date: d(1), reps: 30 }]);
    renderHome();
  });
  await page.waitForTimeout(250);
}

test.describe('Home: vijf activiteitsrijen', () => {
  test('vijf rijen in de juiste volgorde, elk met chip en tellers', async ({ page }) => {
    await openApp(page);
    await seedReps(page);
    await expect(page.locator('.hero-row')).toHaveCount(5);
    expect(await page.locator('.hero-title').allTextContents())
      .toEqual(['De Gym In', 'Thuis Gymmen', 'Calf raises', 'Push-ups', 'Sit-ups']);
    await expect(page.locator('.wait-chip')).toHaveCount(5);
    await expect(page.locator('.hero-count')).toHaveCount(10);
  });

  test('de roze rijen dragen hun eigen kleurtokens', async ({ page }) => {
    await openApp(page);
    const push = await page.locator('.hero-push').evaluate(el => getComputedStyle(el).backgroundImage);
    const situp = await page.locator('.hero-situp').evaluate(el => getComputedStyle(el).backgroundImage);
    expect(push).toContain('rgb(168, 20, 90)');    // --push-a  donkerroze
    expect(push).toContain('rgb(224, 43, 120)');   // --push-b
    expect(situp).toContain('rgb(232, 85, 158)');  // --situp-a lichtroze
    expect(situp).toContain('rgb(255, 168, 207)'); // --situp-b
  });

  test('wachttijd schuift een stap per dag, net als calf', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const d = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      store.setPushups([{ date: d(0), reps: 10 }]);   // vandaag -> groen
      store.setSitups([{ date: d(4), reps: 10 }]);    // 4 dagen -> stap 4
      renderHome();
    });
    await page.waitForTimeout(250);
    const push = page.locator('.hero-row.row-push .wait-val');
    const situp = page.locator('.hero-row.row-situp .wait-val');
    await expect(push).toHaveText('0 D');
    expect(await push.evaluate(el => getComputedStyle(el).color)).toBe('rgb(125, 255, 188)');
    await expect(situp).toHaveText('4 D');
    expect(await situp.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 167, 140)');
  });

  test('tellers springen naar het eigen tracker-blok', async ({ page }) => {
    await openApp(page);
    await seedReps(page);
    await page.locator('.hero-row.row-push .hero-count').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-thuis');
    await expect(page.locator('#pushup-box .calf-readout')).toBeVisible();
  });

  test('de hero opent zijn tracker via de bestaande ghost-knop', async ({ page }) => {
    await openApp(page);
    // ghost-knoppen blijven in de DOM maar zijn onzichtbaar, net als bij calf
    for (const id of ['open-calf', 'open-pushup', 'open-situp']) {
      await expect(page.locator('#' + id)).toHaveCount(1);
      await expect(page.locator('#' + id)).toBeHidden();
    }
    await page.click('#enter-situp');
    await page.waitForTimeout(400);
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-thuis');
  });
});

test.describe('Tracker-blokken in Thuis', () => {
  test('beide trackers hebben readout, steppers en rep-rondjes', async ({ page }) => {
    await openApp(page);
    await goto(page, 'thuis');
    for (const key of ['pushup', 'situp']) {
      const box = page.locator(`#${key}-box`);
      await expect(box.locator('.calf-readout')).toHaveCount(1);
      await expect(box.locator(`[data-rt-inc="${key}"]`)).toHaveCount(1);
      await expect(box.locator(`[data-rt-dec="${key}"]`)).toHaveCount(1);
      await expect(box.locator(`[data-rt-save="${key}"]`)).toHaveCount(1);
      expect(await box.locator('.rep-dot').count()).toBeGreaterThan(10);
    }
    // geen standenrij: die hoort alleen bij calf raises
    await expect(page.locator('#pushup-box .calf-modes')).toHaveCount(0);
    await expect(page.locator('#situp-box .calf-modes')).toHaveCount(0);
    await expect(page.locator('#calf-box .calf-modes')).toHaveCount(1);
  });

  test('optellen, aftrekken en opslaan werkt per oefening apart', async ({ page }) => {
    await openApp(page);
    await goto(page, 'thuis');
    for (let i = 0; i < 4; i++) await page.click('[data-rt-inc="pushup"]');
    await page.click('[data-rt-dec="pushup"]');
    await page.waitForTimeout(200);
    await expect(page.locator('#pushup-box .cr-num')).toHaveText('3');
    // sit-ups staat los en blijft op nul
    await expect(page.locator('#situp-box .cr-num')).toHaveText('0');

    await page.click('[data-rt-save="pushup"]');
    await page.waitForTimeout(400);
    const data = await page.evaluate(() => ({ p: store.pushups(), s: store.situps() }));
    expect(data.p.length).toBe(1);
    expect(data.p[0].reps).toBe(3);
    expect(data.p[0].mode).toBeUndefined();   // geen standen
    expect(data.s.length).toBe(0);
    await expect(page.locator('#pushup-box .cr-num')).toHaveText('0');
  });

  test('een rondje aantikken zet de teller op dat aantal', async ({ page }) => {
    await openApp(page);
    await goto(page, 'thuis');
    await page.locator('#situp-box .rep-dot').nth(7).click();
    await page.waitForTimeout(250);
    await expect(page.locator('#situp-box .cr-num')).toHaveText('8');
  });

  test('vorige stand en PR krijgen hun eigen markering', async ({ page }) => {
    await openApp(page);
    await seedReps(page);
    await goto(page, 'thuis');
    // push-ups: vorige 24, pr 24 -> beide markeringen op hetzelfde rondje
    await expect(page.locator('#pushup-box .rep-dot.prev-mark')).toHaveCount(1);
    await expect(page.locator('#pushup-box .rep-dot.pr-mark')).toHaveCount(1);
    await expect(page.locator('#pushup-box .cr-meta')).toContainText('vorige serie 24');
    await expect(page.locator('#pushup-box .cr-meta')).toContainText('pr 24');
    expect(await page.locator('#pushup-box .calf-hist .ch-col').count()).toBe(2);
  });

  test('opslag gaat naar een eigen sleutel en overleeft herladen', async ({ page }) => {
    await openApp(page);
    await goto(page, 'thuis');
    for (let i = 0; i < 5; i++) await page.click('[data-rt-inc="situp"]');
    await page.click('[data-rt-save="situp"]');
    await page.waitForTimeout(400);
    const key = await page.evaluate(() => localStorage.getItem('gymwave_situps'));
    expect(JSON.parse(key)[0].reps).toBe(5);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.route === 'function');
    await goto(page, 'thuis');
    await expect(page.locator('#situp-box .cr-meta')).toContainText('pr 5');
  });
});

test.describe('Randvoorwaarden voor de nieuwe rijen', () => {
  test('geen emoji of glyphs in de nieuwe onderdelen', async ({ page }) => {
    await openApp(page);
    await seedReps(page);
    expect(await visibleGlyphs(page)).toEqual([]);
    await goto(page, 'thuis');
    expect(await visibleGlyphs(page)).toEqual([]);
  });

  test('de push-up- en sit-up-iconen bestaan in de sprite', async ({ page }) => {
    await openApp(page);
    for (const n of ['pushup', 'situp']) {
      await expect(page.locator(`#icon-sprite symbol#i-${n}`)).toHaveCount(1);
    }
    const dangling = await page.evaluate(() => {
      const ids = new Set([...document.querySelectorAll('#icon-sprite symbol')].map(s => s.id));
      return [...document.querySelectorAll('use')]
        .map(u => (u.getAttribute('href') || '').replace('#', ''))
        .filter(h => h && !ids.has(h));
    });
    expect(dangling).toEqual([]);
  });

  test('tekst op de lichtroze rij haalt minstens 4,5:1', async ({ page }) => {
    await openApp(page);
    const lum = c => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    // lichtste punt van het verloop tegen de inktkleur van de knop
    const { ink, light } = await page.evaluate(() => {
      const el = document.querySelector('.hero-situp');
      const t = el.querySelector('.hero-title');
      const rgb = s => s.match(/\d+/g).slice(0, 3).map(Number);
      return {
        ink: rgb(getComputedStyle(t).color),
        light: [255, 168, 207],           // --situp-b, het lichtste uiteinde
      };
    });
    const [hi, lo] = [lum(ink), lum(light)].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  test('vijf rijen passen nog steeds binnen 360 px', async ({ page }) => {
    await openApp(page);
    await seedReps(page);
    for (const v of ['home', 'thuis']) {
      await goto(page, v);
      const r = await page.evaluate(() => {
        const over = [];
        document.querySelectorAll('#app *').forEach(el => {
          if (!el.offsetParent) return;
          const b = el.getBoundingClientRect();
          if (b.right > 361 || b.left < -1) over.push((el.id || el.className || el.tagName).toString().slice(0, 40));
        });
        return { w: document.documentElement.scrollWidth, over: [...new Set(over)] };
      });
      expect(r.w).toBeLessThanOrEqual(360);
      expect(r.over, v + ': ' + r.over.join(' ; ')).toEqual([]);
    }
  });

  test('export en import nemen de nieuwe oefeningen mee', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      store.setPushups([{ date: '2026-07-20', reps: 12 }]);
      store.setSitups([{ date: '2026-07-21', reps: 22 }]);
    });
    const keys = await page.evaluate(() => SYNC_KEYS);
    expect(keys).toContain('gymwave_pushups');
    expect(keys).toContain('gymwave_situps');
  });
});
