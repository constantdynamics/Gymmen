const { test, expect } = require('@playwright/test');
const { openApp, goto, visibleGlyphs } = require('./helpers');

/* ============================================================
   Zwemmen: eigen rij op Home, afvinklijst vooraf, afstand en pace
   achteraf invullen, en een bord plus voortgang na het opslaan.
   ============================================================ */

const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** Zet een paar zwembeurten klaar (oud → nieuw). */
async function seedSwims(page, rows) {
  await page.evaluate(rs => {
    const d = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    store.setSwims(rs.map(([n, m, p], i) => ({ id: 'sw' + i, date: d(n), meters: m, pace: p, savedAt: new Date(Date.now() - n * 86400000).toISOString() })));
  }, rows);
}
async function openSwim(page) {
  await goto(page, 'swim');
  await expect(page.locator('#view-swim')).toHaveClass(/active/);
}
const item = (page, sec, name) => page.locator(`#swim-checklist .check-item[data-sec="${sec}"]`).filter({ has: page.locator('.ci-label', { hasText: new RegExp('^' + name + '$') }) });

test.describe('Zwemmen op Home', () => {
  test('een zevende rij in waterblauw, met chip en tellers, die het zwemscherm opent', async ({ page }) => {
    const errors = await openApp(page);
    await seedSwims(page, [[9, 800, 160], [4, 1200, 150]]);
    await page.evaluate(() => renderHome());
    const row = page.locator('.hero-row.row-swim');
    await expect(row).toBeVisible();
    await expect(row.locator('.hero-title')).toHaveText('Zwemmen');
    await expect(row.locator('.hero-sub')).toHaveText('1200 m · 2:30 /100 m');
    await expect(row.locator('.wait-val')).toHaveText('4');
    await expect(row.locator('.hc-num')).toHaveText(['2', '1200']);
    await expect(row.locator('.hc-lbl')).toHaveText(['sessies', 'm pr']);
    await page.locator('#enter-swim').click();
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-swim');
    expect(errors).toEqual([]);
  });

  test('witte tekst haalt op de lichtste kant van het blauw minstens 4,5:1', async ({ page }) => {
    await openApp(page);
    const lum = c => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const { ink, light } = await page.evaluate(() => {
      const t = document.querySelector('.hero-swim .hero-title');
      const b = getComputedStyle(document.documentElement).getPropertyValue('--swim-b').trim();
      return { ink: getComputedStyle(t).color.match(/\d+/g).slice(0, 3).map(Number), light: [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)) };
    });
    const [hi, lo] = [lum(ink), lum(light)].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
    // blauw, niet paars: blauw is het sterkste kanaal en rood het zwakste
    const [r, g, b] = light;
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  test('de rij uitzetten laat de rustige knop zien, die ook naar het zwemscherm gaat', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#open-swim')).toBeHidden();
    await page.evaluate(() => { const p = store.prefs(); p.heroes.swim = false; store.setPrefs(p); renderHome(); });
    await expect(page.locator('.hero-row.row-swim')).toBeHidden();
    await expect(page.locator('#open-swim')).toBeVisible();
    await page.click('#open-swim');
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-swim');
    await goto(page, 'settings');
    await expect(page.locator('#hero-settings [data-hero="swim"]')).toHaveCount(1);
  });

  test('zwembeurten tellen mee in sessies totaal en in het spierherstel', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      store.setSessions([]); store.setHomeSessions([]);
      store.setSwims([{ id: 'x', date: todayISO(), meters: 1000, pace: 150, savedAt: new Date().toISOString(), endedAt: new Date().toISOString() }]);
      renderHome();
    });
    await expect(page.locator('#stat-sessions')).toHaveText('1');
    const rec = await page.evaluate(() => Object.fromEntries(muscleRecovery().map(r => [r.key, r.pct])));
    expect(rec.schoud).toBeLessThan(5);
    expect(rec.rug).toBeLessThan(5);
    expect(rec.benen).toBe(100);
    expect(rec.borst).toBe(100);
  });
});

test.describe('Zwemmen: de afvinklijst', () => {
  test('doen en mee staan erin zoals opgegeven', async ({ page }) => {
    await openApp(page);
    await openSwim(page);
    const sub = await page.locator('#swim-checklist .ci-sub .ci-label').allTextContents();
    expect(sub).toEqual(['Zwembroek', 'Onderbroek', 'Mogans', 'Trainingsbroek']);
    await expect(page.locator('#swim-checklist [data-parent="omkleden"] .ci-label')).toHaveText('Omkleden');
    await expect(item(page, 'doen', 'Trouwring thuis')).toHaveCount(1);
    const mee = await page.locator('#swim-checklist .check-item[data-sec="mee"] .ci-label').allTextContents();
    expect(mee).toEqual(['AH-tasje', 'Koptelefoon', 'Oordropjes', 'Zwembril', 'Haarband', 'Tasje voor goodies', 'Surfponcho', 'Zwempasje', 'Zwembroek', 'Slippers', 'Theedoek', 'Onderbroek', 'Fris shirt', 'Sokken']);
  });

  test('omkleden vinkt vanzelf af als alle kledingstukken af zijn', async ({ page }) => {
    await openApp(page);
    await openSwim(page);
    const parent = page.locator('#swim-checklist [data-parent="omkleden"]');
    for (const n of ['Zwembroek', 'Onderbroek', 'Mogans']) await item(page, 'omkleden', n).click();
    await expect(parent).not.toHaveClass(/checked/);
    await expect(parent.locator('.ci-count')).toHaveText('3/4');
    await item(page, 'omkleden', 'Trainingsbroek').click();
    await expect(page.locator('#swim-checklist [data-parent="omkleden"]')).toHaveClass(/checked/);
    // het hoofdvinkje zet ze in één keer weer uit
    await page.locator('#swim-checklist [data-parent="omkleden"]').click();
    await expect(page.locator('#swim-checklist .ci-sub.checked')).toHaveCount(0);
    await page.locator('#swim-checklist [data-parent="omkleden"]').click();
    await expect(page.locator('#swim-checklist .ci-sub.checked')).toHaveCount(4);
  });

  test('zwembroek aantrekken en zwembroek meenemen zijn twee losse vinkjes', async ({ page }) => {
    await openApp(page);
    await openSwim(page);
    await item(page, 'omkleden', 'Zwembroek').click();
    await expect(item(page, 'omkleden', 'Zwembroek')).toHaveClass(/checked/);
    await expect(item(page, 'mee', 'Zwembroek')).not.toHaveClass(/checked/);
  });

  test('alles af geeft good to go; de lijst is elke dag leeg en zelf te wissen', async ({ page }) => {
    await openApp(page);
    await openSwim(page);
    await page.evaluate(() => {
      const l = store.swimList(), checked = {};
      SWIM_SECTIONS.forEach(sec => l[sec].forEach(i => { checked[swimKey(sec, i)] = true; }));
      store.setSwimChecklist({ date: todayISO(), checked });
      renderSwimChecklist();
    });
    await expect(page.locator('#swim-checklist .goodtogo')).toHaveText("You're good to go!");
    await page.click('#swim-reset');
    await expect(page.locator('#swim-checklist .check-item.checked')).toHaveCount(0);
    // vinkjes van gisteren tellen vandaag niet meer
    await item(page, 'mee', 'Slippers').click();
    await page.evaluate(() => { const s = store.swimChecklist(); s.date = '2000-01-01'; store.setSwimChecklist(s); renderSwimChecklist(); });
    await expect(page.locator('#swim-checklist .check-item.checked')).toHaveCount(0);
  });

  test('je kunt dingen toevoegen en weghalen, en dat blijft bewaard', async ({ page }) => {
    await openApp(page);
    await openSwim(page);
    await page.click('#swim-edit');
    await page.fill('#swim-checklist [data-add="mee"]', 'Shampoo');
    await page.click('#swim-checklist [data-addbtn="mee"]');
    await expect(item(page, 'mee', 'Shampoo')).toHaveCount(1);
    // dubbel kan niet
    await page.fill('#swim-checklist [data-add="mee"]', 'shampoo');
    await page.press('#swim-checklist [data-add="mee"]', 'Enter');
    await expect(item(page, 'mee', 'Shampoo')).toHaveCount(1);
    // weghalen
    await item(page, 'mee', 'Theedoek').locator('.ci-del').click();
    await expect(item(page, 'mee', 'Theedoek')).toHaveCount(0);
    // ook bij omkleden toevoegen
    await page.fill('#swim-checklist [data-add="omkleden"]', 'Sokken uit');
    await page.click('#swim-checklist [data-addbtn="omkleden"]');
    await expect(page.locator('#swim-checklist [data-parent="omkleden"] .ci-count')).toHaveText('0/5');
    await page.click('#swim-edit');
    await expect(page.locator('#swim-checklist .ci-del')).toHaveCount(0);
    const l = await page.evaluate(() => store.swimList());
    expect(l.mee).toContain('Shampoo');
    expect(l.mee).not.toContain('Theedoek');
    expect(l.omkleden).toContain('Sokken uit');
  });
});

test.describe('Zwemmen: invullen en voortgang', () => {
  test('afstand per 25 m en pace per seconde; zonder geschiedenis 1000 m en 2:30', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => store.setSwims([]));
    await openSwim(page);
    await expect(page.locator('#swim-m')).toHaveText('1000');
    await expect(page.locator('#swim-p')).toHaveText('2:30');
    await expect(page.locator('#swim-date')).toHaveValue(daysAgo(0));
    await page.locator('[data-swim="meters"][data-d="1"]').click();
    await page.locator('[data-swim="meters"][data-d="1"]').click();
    await page.locator('[data-swim="pace"][data-d="-1"]').click();
    await expect(page.locator('#swim-m')).toHaveText('1050');
    await expect(page.locator('#swim-p')).toHaveText('2:29');
    await expect(page.locator('#swim-dur')).toHaveText('Ongeveer 26 minuten in het water');
  });

  test('opslaan bewaart de zwembeurt, geeft een ster en toont het bord', async ({ page }) => {
    await openApp(page);
    await seedSwims(page, [[9, 800, 160], [4, 1000, 152]]);
    const stars = await page.evaluate(() => store.incentives().stars || 0);
    await openSwim(page);
    // het invulblok begint bij je vorige keer
    await expect(page.locator('#swim-m')).toHaveText('1000');
    await expect(page.locator('#swim-p')).toHaveText('2:32');
    await page.locator('[data-swim="meters"][data-d="1"]').click();
    await page.locator('[data-swim="pace"][data-d="-1"]').click();
    await page.click('#swim-save');
    await expect(page.locator('#summary-modal.show')).toHaveCount(1);
    await expect(page.locator('#summary-modal h3')).toHaveText('Zwembeurt opgeslagen!');
    await expect(page.locator('#summary-content .ss-kg')).toHaveText('1025 m');
    await expect(page.locator('#summary-content .swim-pr-line')).toContainText('langste afstand');
    await expect(page.locator('#summary-content .swim-pr-line')).toContainText('snelste pace');
    await expect(page.locator('#summary-content .ss-bar')).toHaveCount(3);
    await expect(page.locator('#summary-content .ss-legend')).toContainText('Vorige keer: 1000 m');
    await expect(page.locator('#summary-content .ss-legend')).toContainText('1 s sneller');
    const saved = await page.evaluate(() => store.swims().slice(-1)[0]);
    expect(saved).toMatchObject({ date: daysAgo(0), meters: 1025, pace: 151 });
    expect(await page.evaluate(() => store.incentives().stars)).toBe(stars + 1);
    // sluiten brengt je naar je voortgang
    await page.click('#summary-close');
    await page.waitForTimeout(900);
    const top = await page.locator('#swim-stats-title').evaluate(el => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(200);
  });

  test('een eerdere zwembeurt invullen met een andere datum', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => store.setSwims([]));
    await openSwim(page);
    await page.fill('#swim-date', daysAgo(3));
    await page.locator('#swim-date').dispatchEvent('change');
    await page.click('#swim-save');
    await page.click('#summary-close');
    expect(await page.evaluate(() => store.swims()[0].date)).toBe(daysAgo(3));
    await goto(page, 'home');
    await expect(page.locator('.hero-row.row-swim .wait-val')).toHaveText('3');
    // een datum in de toekomst kan niet
    await openSwim(page);
    await page.fill('#swim-date', '2999-01-01');
    await page.locator('#swim-date').dispatchEvent('change');
    await expect(page.locator('#swim-date')).toHaveValue(daysAgo(0));
  });

  test('voortgang: afstand- en pace-grafiek, records en je zwembeurten', async ({ page }) => {
    await openApp(page);
    // dezelfde week: 0 en 1 dag geleden kunnen in verschillende weken vallen, dus vaste datums
    await page.evaluate(() => {
      store.setSwims([
        { id: 'a', date: '2026-09-01', meters: 800, pace: 160, savedAt: '2026-09-01T10:00:00Z' },
        { id: 'b', date: '2026-09-03', meters: 1200, pace: 155, savedAt: '2026-09-03T10:00:00Z' },
        { id: 'c', date: '2026-09-15', meters: 1000, pace: 140, savedAt: '2026-09-15T10:00:00Z' },
        { id: 'd', date: '2026-10-02', meters: 900, pace: 150, savedAt: '2026-10-02T10:00:00Z' },
      ]);
    });
    await openSwim(page);
    await expect(page.locator('.swim-dist .wave-bar')).toHaveCount(4);
    await expect(page.locator('.swim-pace .wave-bar')).toHaveCount(4);
    // ster op de langste afstand en op de snelste pace
    await expect(page.locator('.swim-dist .wave-bar.pr .bar-val')).toHaveText('1200');
    await expect(page.locator('.swim-pace .wave-bar.pr .bar-val')).toHaveText('2:20');
    // snelste pace = hoogste balk
    await page.waitForTimeout(600);
    const hs = await page.locator('.swim-pace .wave-bar').evaluateAll(els => els.map(e => parseFloat(e.dataset.h)));
    expect(Math.max(...hs)).toBe(hs[2]);
    const recs = await page.locator('#swim-stats .rec-row .rec-val').allTextContents();
    expect(recs.map(s => s.trim())).toEqual(['1200 m', '2:20 /100 m', '2000 m', '3000 m']);
    await expect(page.locator('#swim-stats .rec-row').nth(2).locator('.rec-date')).toHaveText('week van maandag 31 aug');
    await expect(page.locator('#swim-stats .rec-row').nth(3).locator('.rec-date')).toHaveText('september 2026');
    // geschiedenis: nieuwste bovenaan, verwijderen vraagt eerst
    await expect(page.locator('.swim-hist-row')).toHaveCount(4);
    await expect(page.locator('.swim-hist-row').first()).toContainText('900 m');
    await page.locator('.swim-hist-row').first().locator('.sh-del').click();
    await expect(page.locator('#modal-title')).toHaveText('Zwembeurt verwijderen?');
    await page.click('#modal-confirm');
    await expect(page.locator('.swim-hist-row')).toHaveCount(3);
    expect(await page.evaluate(() => store.swims().map(s => s.id))).toEqual(['a', 'b', 'c']);
  });

  test('zonder zwembeurten staat er een nette lege melding', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => store.setSwims([]));
    await openSwim(page);
    await expect(page.locator('#swim-stats .empty-state')).toContainText('Nog geen zwembeurten');
  });

  test('export, import, wissen en cloud-sync kennen de zwemdata', async ({ page }) => {
    await openApp(page);
    const keys = await page.evaluate(() => SYNC_KEYS);
    for (const k of ['gymwave_swims', 'gymwave_swim_list', 'gymwave_swim_checklist']) expect(keys).toContain(k);
    await seedSwims(page, [[2, 1000, 150]]);
    await goto(page, 'settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-data')]);
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(data.swims).toHaveLength(1);
    expect(data.swimList.mee).toContain('Zwembril');
  });

  test('geen glyphs en niets breder dan 360 px op het zwemscherm', async ({ page }) => {
    await openApp(page);
    await seedSwims(page, [[30, 750, 165], [16, 1000, 158], [4, 1000, 152]]);
    await openSwim(page);
    await page.click('#swim-edit');
    expect(await visibleGlyphs(page)).toEqual([]);
    const r = await page.evaluate(() => {
      const over = [];
      document.querySelectorAll('#view-swim *').forEach(el => {
        if (!el.offsetParent) return;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return;
        }
        const b = el.getBoundingClientRect();
        if (b.right > 361 || b.left < -1) over.push((el.id || el.className || el.tagName).toString().slice(0, 40));
      });
      return { w: document.documentElement.scrollWidth, over };
    });
    expect(r.w).toBeLessThanOrEqual(360);
    expect(r.over).toEqual([]);
  });
});
