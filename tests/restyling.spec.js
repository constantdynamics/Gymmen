const { test, expect } = require('@playwright/test');
const { APP_URL, VIEWS, openApp, seedHistory, goto, settle, visibleGlyphs } = require('./helpers');

/* ============================================================
   Restyling — de eisen uit de briefing (§1 t/m §4)
   ============================================================ */

test.describe('§4 iconen: nul emoji, nul unicode-symbolen', () => {
  test('sprite staat als eerste kind van body en heeft de hele set', async ({ page }) => {
    await openApp(page);
    const sprite = page.locator('#icon-sprite');
    await expect(sprite).toHaveCount(1);
    // sprite moet vóór #app staan, zodat <use> altijd resolvet
    const isFirst = await page.evaluate(() =>
      document.body.firstElementChild.id === 'icon-sprite');
    expect(isFirst).toBe(true);
    const symbols = await page.locator('#icon-sprite symbol').count();
    expect(symbols).toBeGreaterThanOrEqual(60);
    // helpers bestaan en leveren een <use> op
    const html = await page.evaluate(() => icon('check', 16));
    expect(html).toContain('href="#i-check"');
    expect(html).toContain('stroke="currentColor"');
    expect(await page.evaluate(() => iconFill('star-solid', 16))).toContain('fill="currentColor"');
  });

  test('geen enkele view toont nog een emoji of icoon-glyph', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    const found = [];
    for (const v of VIEWS) {
      await goto(page, v);
      (await visibleGlyphs(page)).forEach(g => found.push(v + ' | ' + g));
    }
    expect(found, 'zichtbare emoji/symbolen: ' + found.join(' ; ')).toEqual([]);
  });

  test('ook met een open oefeningkaart en een open modal blijft het schoon', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.locator('.mc-header').nth(1).click();
    await page.waitForTimeout(300);
    expect(await visibleGlyphs(page)).toEqual([]);
    await page.locator('.done-btn').first().click();
    await page.waitForTimeout(300);
    await page.click('#finish-session');
    await page.waitForTimeout(1200);
    await expect(page.locator('#summary-modal.show')).toHaveCount(1);
    expect(await visibleGlyphs(page)).toEqual([]);
  });

  test('elk gerenderd icoon verwijst naar een bestaand symbol', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    const dangling = [];
    for (const v of VIEWS) {
      await goto(page, v);
      const bad = await page.evaluate(() => {
        const ids = new Set([...document.querySelectorAll('#icon-sprite symbol')].map(s => s.id));
        return [...document.querySelectorAll('use')]
          .map(u => (u.getAttribute('href') || '').replace('#', ''))
          .filter(h => h && !ids.has(h));
      });
      bad.forEach(b => dangling.push(v + ' -> ' + b));
    }
    expect(dangling, 'onbekende icoonnamen: ' + dangling.join(', ')).toEqual([]);
  });
});

test.describe('§3.2 bottom-nav', () => {
  test('vier zichtbare knoppen, acht in de DOM', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.nav-item')).toHaveCount(8);
    await expect(page.locator('.nav-item:visible')).toHaveCount(4);
    const labels = await page.locator('.nav-item:visible .nav-label').allTextContents();
    expect(labels).toEqual(['HOME', 'SESSIE', 'STATS', 'INSTEL']);
  });

  test('de verborgen tabs houden hun data-view en blijven routeerbaar', async ({ page }) => {
    await openApp(page);
    for (const v of ['coach', 'goals', 'thuis', 'tips']) {
      await expect(page.locator(`.nav-item[data-view="${v}"]`)).toHaveCount(1);
      await goto(page, v);
      await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-' + v);
    }
  });

  test('actieve tab krijgt de paarse pil, geen streepje meer', async ({ page }) => {
    await openApp(page);
    await goto(page, 'stats');
    const active = page.locator('.nav-item.active');
    await expect(active).toHaveCount(1);
    const bg = await active.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgba(123, 47, 255, 0.22)');
    const after = await active.evaluate(el => getComputedStyle(el, '::after').content);
    expect(after).toBe('none');
  });
});

test.describe('§3.1 home: activiteitsrijen met wachttijd-kleur', () => {
  test('elke activiteit heeft een rij met chip en twee tellers', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await expect(page.locator('.hero-row')).toHaveCount(5);
    await expect(page.locator('.wait-chip')).toHaveCount(5);
    await expect(page.locator('.hero-count')).toHaveCount(10);
    // per chip zes segmenten in de ramp
    for (let i = 0; i < 5; i++) {
      await expect(page.locator('.wait-chip').nth(i).locator('.wait-ramp span')).toHaveCount(6);
    }
    const labels = await page.locator('.hc-lbl').allTextContents();
    expect(labels).toEqual(['sessies', 'kg pr', 'sessies', 'kg pr', 'series', 'reps pr',
      'series', 'reps pr', 'series', 'reps pr']);
  });

  test('rampIndex: gym en thuis 3 dagen per stap, calf 1 dag', async ({ page }) => {
    await openApp(page);
    const r = await page.evaluate(() => ({
      gym: [0, 2, 3, 6, 9, 12, 15, 40].map(d => rampIndex(d, 3)),
      calf: [0, 1, 2, 3, 4, 5, 9].map(d => rampIndex(d, 1)),
    }));
    expect(r.gym).toEqual([0, 0, 1, 2, 3, 4, 5, 5]);
    expect(r.calf).toEqual([0, 1, 2, 3, 4, 5, 5]);
  });

  test('chipkleur volgt de trap groen naar rood', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const ms = store.machines().filter(m => !m.cardio);
      const mk = d => {
        const dt = new Date(Date.now() - d * 86400000);
        return { id: 's' + d, date: dt.toISOString().slice(0, 10), name: 'x', endedAt: dt.toISOString(),
          entries: [{ machineId: ms[0].id, weight: 40 }] };
      };
      store.setSessions([mk(1)]);           // 1 dag -> index 0 (groen)
      store.setHomeSessions([]);            // nooit  -> index 5 (rood)
      renderHome();
    });
    await page.waitForTimeout(200);
    const val = page.locator('.wait-chip').first().locator('.wait-val');
    await expect(val).toHaveText('1');
    expect(await val.evaluate(el => getComputedStyle(el).color)).toBe('rgb(125, 255, 188)');
    // thuis zonder data: streepje en de rode stap
    const homeVal = page.locator('.wait-chip').nth(1).locator('.wait-val');
    await expect(homeVal).toHaveText('—');
    expect(await homeVal.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 138, 138)');
  });

  test('datumregel en losse stat-pills zijn niet meer zichtbaar', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#home-date')).toBeHidden();
    await expect(page.locator('.stat-pills')).toBeHidden();
    // maar wel nog in de DOM, met hun waarden
    await expect(page.locator('#stat-sessions')).toHaveCount(1);
    await expect(page.locator('#stat-kg')).toHaveCount(1);
  });

  test('tellers zijn aantikbaar en springen naar Stats', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await page.locator('.hero-row.row-home .hero-count').first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-stats');
    expect(await page.evaluate(() => statScope)).toBe('thuis');
  });
});

test.describe('§3.5 herstel-chart', () => {
  test('zeven spiergroepen met waarde, balk en label', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await expect(page.locator('.recov-col')).toHaveCount(7);
    const labels = await page.locator('.recov-labels span').allTextContents();
    expect(labels).toEqual(['benen', 'kuiten', 'core', 'rug', 'borst', 'arm', 'schoud']);
    const heights = await page.locator('.rc-bar').evaluateAll(els =>
      els.map(e => e.getBoundingClientRect().height));
    heights.forEach(h => expect(h).toBeGreaterThan(3));
  });

  test('kleur loopt van groen naar rood, niet naar paars', async ({ page }) => {
    await openApp(page);
    const cols = await page.evaluate(() => {
      const rows = muscleRecovery();
      return rows.map(r => RAMP[r.idx]);
    });
    const ramp = ['#35d07f', '#9ede3a', '#ffd75e', '#ffa53a', '#ff6b3d', '#ff3b3b'];
    cols.forEach(c => expect(ramp).toContain(c));
  });
});

test.describe('§3.3 machine-kaart', () => {
  test('ticketvorm, readout en de gewichtsstapel als segmenten', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.locator('.mc-header').nth(1).click();
    await page.waitForTimeout(300);
    const card = page.locator('.machine-card.open');
    await expect(card).toHaveCount(1);
    // afgeschuinde hoek alleen op deze kaart
    const clip = await card.evaluate(el => getComputedStyle(el).clipPath);
    expect(clip).toContain('polygon');
    await expect(page.locator('.weight-readout')).toHaveCount(1);
    const segs = page.locator('.stack-seg');
    expect(await segs.count()).toBeGreaterThan(4);
    await expect(page.locator('.stack-seg.cur')).toHaveCount(1);
    // gewone kaarten blijven rond
    const plainClip = await page.locator('#crowd-card .card, .card').first()
      .evaluate(el => getComputedStyle(el).clipPath);
    expect(plainClip === 'none' || !plainClip.includes('polygon')).toBeTruthy();
  });

  test('plus verhoogt het gewicht en de readout loopt mee', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.locator('.mc-header').nth(1).click();
    await page.waitForTimeout(300);
    const before = await page.locator('.wr-num').textContent();
    await page.locator('[data-act="inc"]').first().click();
    await page.waitForTimeout(150);
    const after = await page.locator('.wr-num').textContent();
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));
    expect(await page.locator('.weight-display').first().inputValue()).toBe(after);
  });

  test('gevoelsschaal heeft vijf segmenten zonder tussenruimte', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.locator('.mc-header').nth(1).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.machine-card.open .feel-btn')).toHaveCount(5);
    const gap = await page.locator('.machine-card.open .feel-scale')
      .evaluate(el => getComputedStyle(el).gap);
    expect(gap).toBe('2px');
  });

  test('afgeronde kaart is mat maar niet grijs gefilterd', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.locator('.mc-header').nth(1).click();
    await page.locator('.done-btn').first().click();
    await page.waitForTimeout(400);
    const done = page.locator('.machine-card.done').first();
    await expect(done).toHaveCount(1);
    const filter = await done.evaluate(el => getComputedStyle(el).filter);
    expect(filter).toBe('none');
  });
});

test.describe('§3.4 stats', () => {
  test('referentielijn met leesbare label-chip', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await goto(page, 'stats');
    await expect(page.locator('.chart-wrap')).toHaveCount(1);
    const line = page.locator('.ref-line').first();
    await expect(line).toHaveCount(1);
    expect(await line.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('2px');
    const chip = page.locator('.ref-chip').first();
    const bg = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');   // chip heeft een eigen achtergrond
  });

  test('waffle gebruikt de vijfstaps ladder plus een PR-cel', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await goto(page, 'stats');
    expect(await page.locator('.waffle-cell').count()).toBeGreaterThan(0);
    expect(await page.locator('.waffle-cell.pr').count()).toBeGreaterThan(0);
    const levels = await page.locator('.waffle-cell').evaluateAll(els =>
      [...new Set(els.map(e => (e.className.match(/lv\d/) || ['pr'])[0]))]);
    levels.forEach(l => expect(['lv1', 'lv2', 'lv3', 'lv4', 'lv5', 'pr']).toContain(l));
    await expect(page.locator('.waffle-legend').first()).toBeVisible();
  });

  test('alleen de nieuwste balk gloeit en toont zijn waarde', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await goto(page, 'stats');
    await expect(page.locator('.wave-bar.newest')).toHaveCount(1);
    await expect(page.locator('.wave-bar .bar-val')).toHaveCount(1);
  });
});

test.describe('§3.6 thuis en calf raises', () => {
  test('beloningssterren zijn SVG, tien stuks', async ({ page }) => {
    await openApp(page);
    await goto(page, 'thuis');
    await expect(page.locator('.inc-star')).toHaveCount(10);
    await expect(page.locator('.inc-star svg')).toHaveCount(10);
  });

  test('calf: readout, rep-rondjes met markering en PR-rij per modus', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await goto(page, 'thuis');
    await expect(page.locator('#calf-box .calf-readout')).toHaveCount(1);
    const size = await page.locator('#calf-box .cr-num').evaluate(el => getComputedStyle(el).fontSize);
    expect(size).toBe('62px');
    await expect(page.locator('#calf-box .calf-pr-row .cp-cell')).toHaveCount(3);
    await expect(page.locator('#calf-box .rep-dot.prev-mark')).toHaveCount(1);
    await expect(page.locator('#calf-box .rep-dot.pr-mark')).toHaveCount(1);
    expect(await page.locator('#calf-box .calf-hist .ch-col').count()).toBeGreaterThan(0);
  });

  test('plus-knop telt de reps op', async ({ page }) => {
    await openApp(page);
    await goto(page, 'thuis');
    await expect(page.locator('#calf-box .cr-num')).toHaveText('0');
    await page.click('#calf-inc');
    await page.click('#calf-inc');
    await page.waitForTimeout(200);
    await expect(page.locator('#calf-box .cr-num')).toHaveText('2');
    await page.click('#calf-dec');
    await page.waitForTimeout(200);
    await expect(page.locator('#calf-box .cr-num')).toHaveText('1');
  });
});

test.describe('§1 randvoorwaarden', () => {
  test('geen horizontale overflow op 360 px', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await page.click('#enter-gym');
    await page.locator('.mc-header').nth(1).click();
    const bad = [];
    for (const v of VIEWS) {
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
      expect(r.w, 'scrollWidth op ' + v).toBeLessThanOrEqual(360);
      r.over.forEach(o => bad.push(v + ' | ' + o));
    }
    expect(bad, 'elementen buiten 360 px: ' + bad.join(' ; ')).toEqual([]);
  });

  test('tap-targets zijn minstens 44 px', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    const small = [];
    for (const v of VIEWS) {
      await goto(page, v);
      const r = await page.evaluate(view => {
        const out = [];
        document.querySelectorAll('button, a.btn, summary, .nav-item').forEach(el => {
          if (!el.offsetParent || el.disabled) return;
          const b = el.getBoundingClientRect();
          if (b.height === 0) return;
          // het rep-rondje is bewust 36 px, met een raakvlak van 44 px via ::before
          const eff = el.classList.contains('rep-dot') ? b.height + 8 : b.height;
          if (eff < 43.5) out.push(view + ' | ' + (el.id || el.className).toString().slice(0, 40) + ' h=' + eff.toFixed(1));
        });
        document.querySelectorAll('input[type=checkbox]').forEach(el => {
          if (!el.offsetParent) return;
          const lab = el.closest('label');
          const h = (lab || el).getBoundingClientRect().height;
          if (h < 43.5) out.push(view + ' | checkbox-label h=' + h.toFixed(1));
        });
        return out;
      }, v);
      small.push(...r);
    }
    expect(small, 'te kleine tap-targets: ' + small.join(' ; ')).toEqual([]);
  });

  test('tekst komt nooit onder 66% helderheid', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    const dim = [];
    for (const v of VIEWS) {
      await goto(page, v);
      const r = await page.evaluate(view => {
        const out = [];
        document.querySelectorAll('#app *').forEach(el => {
          if (!el.offsetParent) return;
          if (el.disabled || el.closest('button:disabled, .btn:disabled')) return;
          const txt = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
          if (!txt) return;
          let o = 1, cur = el;
          while (cur && cur !== document.body) { o *= parseFloat(getComputedStyle(cur).opacity); cur = cur.parentElement; }
          const col = getComputedStyle(el).color;
          const a = (col.match(/rgba?\([^)]*?,\s*([\d.]+)\)/) || [, '1'])[1];
          const eff = o * parseFloat(a);
          if (eff < 0.655) out.push(view + ' | ' + (el.id || el.className || el.tagName).toString().slice(0, 40) + ' = ' + eff.toFixed(2));
        });
        return out;
      }, v);
      dim.push(...r);
    }
    expect(dim, 'te donkere tekst: ' + [...new Set(dim)].join(' ; ')).toEqual([]);
  });

  test('één bestand: geen nieuwe externe verzoeken behalve de al bestaande', async ({ page }) => {
    // deze test blokkeert bewust niets, maar laat de verzoeken wel afketsen
    const hosts = new Set();
    page.on('request', r => {
      const u = r.url();
      if (u.startsWith('file://') || u.startsWith('data:') || u.startsWith('blob:')) return;
      hosts.add(new URL(u).host);
    });
    await page.route('**/*', route => {
      const u = route.request().url();
      return u.startsWith('file://') ? route.continue() : route.abort();
    });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    // alleen de fonts en de Supabase-CDN die er al stonden
    [...hosts].forEach(h =>
      expect(['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']).toContain(h));
  });
});
