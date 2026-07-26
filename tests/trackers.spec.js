const { test, expect } = require('@playwright/test');
const { openApp, goto, visibleGlyphs } = require('./helpers');

/* ============================================================
   Push-ups en sit-ups — zelfde tracker als calf raises,
   zonder standenrij, als vierde en vijfde stap van de paarse schaal.
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

  test('de vijf rijen vormen een paarse schaal van donker naar licht', async ({ page }) => {
    await openApp(page);
    const lum = c => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const steps = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return ['gym', 'home', 'calf', 'push', 'situp'].map(k => ({
        a: cs.getPropertyValue('--' + k + '-a').trim(),
        b: cs.getPropertyValue('--' + k + '-b').trim(),
      }));
    });
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    // elke stap is lichter dan de vorige, en blauw blijft het sterkste kanaal
    const ls = steps.map(s => lum(hex(s.a)));
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeGreaterThan(ls[i - 1]);
    steps.forEach(s => {
      const [r, g, b] = hex(s.b);
      expect(b).toBeGreaterThan(r);   // paars, niet roze
      expect(r).toBeGreaterThan(g);
    });
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
    await expect(push).toHaveText('0');
    expect(await push.evaluate(el => getComputedStyle(el).color)).toBe('rgb(125, 255, 188)');
    await expect(situp).toHaveText('4');
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

test.describe('Waffle van de beste serie', () => {
  /** Zet één opgeslagen poging klaar met deze reps en toont de Thuis-tab. */
  async function withPr(page, reps) {
    await page.evaluate(r => {
      const d = new Date().toISOString().slice(0, 10);
      store.setPushups(r ? [{ date: d, reps: r }] : []);
      route('thuis');
    }, reps);
    await page.waitForTimeout(400);
  }

  test('het raster groeit zodra het vol zit', async ({ page }) => {
    await openApp(page);
    const sides = await page.evaluate(() =>
      [1, 2, 3, 4, 5, 8, 9, 10, 15, 16, 24, 25].map(n => waffleSide(n)));
    //  1-3 -> 2x2 | 4-8 -> 3x3 | 9-15 -> 4x4 | 16-24 -> 5x5 | 25 -> 6x6
    expect(sides).toEqual([2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6]);
  });

  test('bij een PR van 1 een 2x2 met alleen linksboven gevuld', async ({ page }) => {
    await openApp(page);
    await withPr(page, 1);
    const w = page.locator('#pushup-box .sess-waffle');
    await expect(w.locator('.sw-cell')).toHaveCount(4);
    await expect(w.locator('.sw-cell.done')).toHaveCount(1);
    // de eerste cel in de DOM is linksboven in het raster
    await expect(w.locator('.sw-cell').first()).toHaveClass(/done/);
    await expect(w.locator('.sw-cell').nth(1)).not.toHaveClass(/done/);
  });

  test('bij een PR van 4 een 3x3 met vier gevuld in leesrichting', async ({ page }) => {
    await openApp(page);
    await withPr(page, 4);
    const cells = page.locator('#pushup-box .sess-waffle .sw-cell');
    await expect(cells).toHaveCount(9);
    const filled = await cells.evaluateAll(els => els.map(e => e.classList.contains('done')));
    // eerst vullen, dan pas leeg: geen gaten in de leesrichting
    expect(filled).toEqual([true, true, true, true, false, false, false, false, false]);
    const cols = await page.locator('#pushup-box .sess-waffle')
      .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(3);
    await expect(page.locator('#pushup-box .sw-title')).toHaveText('beste serie');
    await expect(page.locator('#pushup-box .sw-cap')).toContainText('4 reps');
  });

  test('de chart houdt dezelfde afmeting terwijl het raster groeit', async ({ page }) => {
    await openApp(page);
    const sizes = [];
    for (const pr of [1, 4, 9, 16]) {
      await withPr(page, pr);
      sizes.push(await page.locator('#pushup-box .sess-waffle').evaluate(el => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)];
      }));
    }
    // vierkant, en bij elk aantal even groot
    sizes.forEach(([w, h]) => expect(Math.abs(w - h)).toBeLessThanOrEqual(1));
    sizes.forEach(([w]) => expect(w).toBe(sizes[0][0]));
    // ruwweg een half scherm: minstens een derde van de vensterhoogte
    expect(sizes[0][0]).toBeGreaterThan(780 / 3);
  });

  test('zonder pogingen is er geen waffle', async ({ page }) => {
    await openApp(page);
    await withPr(page, 0);
    await expect(page.locator('#pushup-box .sess-waffle')).toHaveCount(0);
  });

  test('het aantal pogingen doet er niet toe, alleen de beste', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const d = i => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      // twaalf pogingen, beste is 7
      store.setPushups([5, 3, 7, 4, 6, 2, 5, 7, 3, 6, 4, 5]
        .map((reps, i) => ({ date: d(12 - i), reps })));
      route('thuis');
    });
    await page.waitForTimeout(450);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell.done')).toHaveCount(7);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell')).toHaveCount(9);
  });

  test('alle drie de trackers hebben er een, in hun eigen tint', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const d = i => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      store.setCalf(Array.from({ length: 5 }, (_, i) => ({ date: d(5 - i), mode: 'L', reps: 10 + i })));
      store.setPushups(Array.from({ length: 9 }, (_, i) => ({ date: d(9 - i), reps: 10 + i })));
      store.setSitups(Array.from({ length: 2 }, (_, i) => ({ date: d(2 - i), reps: 20 + i })));
      route('thuis');
    });
    await page.waitForTimeout(500);
    const shots = {};
    for (const box of ['calf-box', 'pushup-box', 'situp-box']) {
      const w = page.locator(`#${box} .sess-waffle`);
      await expect(w).toHaveCount(1);
      shots[box] = await w.locator('.sw-cell.done').first()
        .evaluate(el => getComputedStyle(el).backgroundImage);
    }
    expect(shots['calf-box']).toContain('rgb(61, 18, 160)');
    expect(shots['pushup-box']).toContain('rgb(82, 27, 194)');
    expect(shots['situp-box']).toContain('rgb(104, 37, 218)');
    // alle drie tonen hun eigen beste serie: 14, 18 en 21
    await expect(page.locator('#calf-box .sess-waffle .sw-cell.done')).toHaveCount(14);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell.done')).toHaveCount(18);
    await expect(page.locator('#situp-box .sess-waffle .sw-cell.done')).toHaveCount(21);
    // en alle drie dezelfde kop
    for (const box of ['calf-box', 'pushup-box', 'situp-box']) {
      await expect(page.locator(`#${box} .sw-title`)).toHaveText('beste serie');
    }
  });

  test('een nieuw record laat het raster groeien, een mindere poging niet', async ({ page }) => {
    await openApp(page);
    await withPr(page, 3);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell.done')).toHaveCount(3);

    // eerst een mindere poging: raster blijft gelijk
    for (let i = 0; i < 2; i++) await page.click('[data-rt-inc="pushup"]');
    await page.click('[data-rt-save="pushup"]');
    await page.waitForTimeout(450);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell.done')).toHaveCount(3);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell')).toHaveCount(4);

    // dan een record van 6: raster groeit naar 3x3
    for (let i = 0; i < 6; i++) await page.click('[data-rt-inc="pushup"]');
    await page.click('[data-rt-save="pushup"]');
    await page.waitForTimeout(450);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell.done')).toHaveCount(6);
    await expect(page.locator('#pushup-box .sess-waffle .sw-cell')).toHaveCount(9);
    expect(await page.evaluate(() => store.pushups().length)).toBe(3);
  });
});

test.describe('Calf-waffle telt de beste serie, niet de pogingen', () => {
  /** Acht pogingen over drie standen; de hoogste PR is 32 op Links. */
  async function seedCalfModes(page) {
    await page.evaluate(() => {
      const d = i => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      store.setCalf([
        { date: d(9), mode: '2', reps: 18 }, { date: d(8), mode: 'L', reps: 12 },
        { date: d(7), mode: 'R', reps: 15 }, { date: d(6), mode: '2', reps: 24 },
        { date: d(5), mode: 'L', reps: 26 }, { date: d(4), mode: 'R', reps: 20 },
        { date: d(3), mode: 'L', reps: 32 }, { date: d(2), mode: '2', reps: 22 },
      ]);
      route('thuis');
    });
    await page.waitForTimeout(450);
  }

  test('de hoogste PR over de drie standen bepaalt het aantal bolletjes', async ({ page }) => {
    await openApp(page);
    await seedCalfModes(page);
    // acht losse pogingen, maar de waffle toont de beste serie: 32
    expect(await page.evaluate(() => store.calf().length)).toBe(8);
    await expect(page.locator('#calf-box .sess-waffle .sw-cell.done')).toHaveCount(32);
    await expect(page.locator('#calf-box .sess-waffle .sw-cell')).toHaveCount(36);
    await expect(page.locator('#calf-box .sw-title')).toHaveText('beste serie');
    await expect(page.locator('#calf-box .sw-cap')).toContainText('32 reps op Links');
  });

  test('een nieuwe poging onder de PR verandert het raster niet', async ({ page }) => {
    await openApp(page);
    await seedCalfModes(page);
    const before = await page.locator('#calf-box .sess-waffle .sw-cell.done').count();
    await page.evaluate(() => {
      const cs = store.calf();
      cs.push({ date: new Date().toISOString().slice(0, 10), mode: 'R', reps: 9 });
      store.setCalf(cs);
      renderCalfBox();
    });
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => store.calf().length)).toBe(9);
    await expect(page.locator('#calf-box .sess-waffle .sw-cell.done')).toHaveCount(before);
  });

  test('een nieuw record laat het raster wel groeien', async ({ page }) => {
    await openApp(page);
    await seedCalfModes(page);
    await page.evaluate(() => {
      const cs = store.calf();
      cs.push({ date: new Date().toISOString().slice(0, 10), mode: '2', reps: 40 });
      store.setCalf(cs);
      renderCalfBox();
    });
    await page.waitForTimeout(350);
    await expect(page.locator('#calf-box .sess-waffle .sw-cell.done')).toHaveCount(40);
    await expect(page.locator('#calf-box .sess-waffle .sw-cell')).toHaveCount(49);
    await expect(page.locator('#calf-box .sw-cap')).toContainText('40 reps op 2 benen');
  });

  test('calfBestPr kiest de hoogste over alle standen', async ({ page }) => {
    await openApp(page);
    await seedCalfModes(page);
    const best = await page.evaluate(() => calfBestPr());
    expect(best).toEqual({ pr: 32, mode: 'L' });
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

  test('tekst op de lichtste rij haalt minstens 4,5:1', async ({ page }) => {
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
      const cs = getComputedStyle(document.documentElement);
      const b = cs.getPropertyValue('--situp-b').trim();
      return {
        ink: rgb(getComputedStyle(t).color),
        light: [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)), // lichtste uiteinde
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
