const { test, expect } = require('@playwright/test');
const { openApp, seedHistory, goto, visibleGlyphs } = require('./helpers');

/* ============================================================
   Feedbackronde: open vragen, do's & don'ts, gevoelskleur,
   hero-schakelaars en de PR-definitie
   ============================================================ */

/* Apparaten waarvan de open vraag in het standaardschema écht nog leeft: hun
   standaardgewicht ligt onder de drempel waarboven de vraag vervalt. */
const OPEN_MACHINE = 'Shoulder Press';       // 14 kg, drempel 23
const OPEN_MACHINE_2 = 'Horizontal Row (Pulley)'; // 27,3 kg, drempel 36

/** Opent een oefeningkaart in de sessie op naam en geeft de body terug. */
async function openExercise(page, name) {
  await page.click('#enter-gym');
  await page.locator('.mc-header', { hasText: name }).first().click();
  await page.waitForTimeout(250);
  return page.locator('.machine-card.open .mc-body');
}

/** Klapt het do's & don'ts-blok van de open kaart uit (details staat dicht). */
async function openDosDonts(page) {
  await page.evaluate(() => {
    const b = document.querySelector('.machine-card.open .tip-body[data-tips]');
    if (b && b.closest('details')) b.closest('details').open = true;
  });
  await page.waitForTimeout(150);
}

test.describe('Gewichtsstapel van de chest press', () => {
  test('komt uit de foto: 14 t/m 104 kg, geen plaatje van 9', async ({ page }) => {
    await openApp(page);
    const stack = await page.evaluate(() =>
      store.machines().find(m => m.name === 'Seated Chest Press').stack);
    expect(stack).toEqual([14, 18, 23, 29, 36, 43, 50, 57, 63, 70, 77, 84, 90, 97, 104]);
  });

  test('de chest press heeft geen openstaande vraag meer', async ({ page }) => {
    await openApp(page);
    const open = await page.evaluate(() =>
      machinesWithOpenQuestion().map(m => m.name));
    expect(open).not.toContain('Seated Chest Press');
  });

  test('een bestaande stapel met 9 kg wordt eenmalig bijgewerkt', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const ms = store.machines();
      ms.find(m => m.name === 'Seated Chest Press').stack = [9, 14, 18, 23];
      store.setMachines(ms);
      const p = store.profile();
      delete p.chestStackPhoto2607;
      localStorage.setItem('gymwave_profile', JSON.stringify(p));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.route === 'function');
    const stack = await page.evaluate(() =>
      store.machines().find(m => m.name === 'Seated Chest Press').stack);
    expect(stack[0]).toBe(14);
    expect(stack).toHaveLength(15);
  });

  test('de belangrijke tip over niet doorstrekken staat erbij', async ({ page }) => {
    await openApp(page);
    const tips = await page.evaluate(() =>
      machineExtraTips(store.machines().find(m => m.name === 'Seated Chest Press')));
    expect(tips[0]).toMatch(/180 graden/);
  });
});

test.describe('Openstaande vragen: beantwoorden bij de oefening', () => {
  test('een apparaat met open vraag toont het blok met foto- en tekstoptie', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, OPEN_MACHINE);
    await expect(body.locator('.ask-box')).toHaveCount(1);
    await expect(body.locator('.ask-photo')).toHaveCount(1);
    await expect(body.locator('.ask-text')).toHaveCount(1);
    await expect(body.locator('.ask-moot')).toHaveCount(1);
  });

  test('gewichten als tekst doorgeven zet de gewichtsstapel meteen goed', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, OPEN_MACHINE);
    await body.locator('.ask-text').fill('5, 9, 14, 18, 23, 29');
    await body.locator('.ask-send').click();
    await expect(page.locator('#modal.show')).toHaveCount(1);
    await page.click('#modal-confirm');
    await page.waitForTimeout(250);
    const stack = await page.evaluate(n =>
      store.machines().find(m => m.name === n).stack, OPEN_MACHINE);
    expect(stack).toEqual([5, 9, 14, 18, 23, 29]);
    // vraag is afgehandeld en verdwijnt uit de lijst
    const open = await page.evaluate(() => machinesWithOpenQuestion().map(m => m.name));
    expect(open).not.toContain(OPEN_MACHINE);
  });

  test('annuleren bewaart het antwoord maar laat de stapel staan', async ({ page }) => {
    await openApp(page);
    const before = await page.evaluate(n =>
      store.machines().find(m => m.name === n).stack, OPEN_MACHINE);
    const body = await openExercise(page, OPEN_MACHINE);
    await body.locator('.ask-text').fill('5, 9, 14, 18, 23, 29');
    await body.locator('.ask-send').click();
    await page.click('#modal-cancel');
    await page.waitForTimeout(250);
    const after = await page.evaluate(n =>
      store.machines().find(m => m.name === n).stack, OPEN_MACHINE);
    expect(after).toEqual(before);
    const ans = await page.evaluate(n => store.answers()[n], OPEN_MACHINE);
    expect(ans.text).toBe('5, 9, 14, 18, 23, 29');
    expect(ans.resolved).toBe(true);
  });

  test('een kort antwoord wordt bewaard zonder de stapel aan te raken', async ({ page }) => {
    await openApp(page);
    const before = await page.evaluate(n =>
      store.machines().find(m => m.name === n).stack, OPEN_MACHINE);
    const body = await openExercise(page, OPEN_MACHINE);
    await body.locator('.ask-text').fill('nee, 9 kg is de lichtste');
    await body.locator('.ask-send').click();
    await page.waitForTimeout(250);
    await expect(page.locator('#modal.show')).toHaveCount(0);
    const ans = await page.evaluate(n => store.answers()[n], OPEN_MACHINE);
    expect(ans.text).toBe('nee, 9 kg is de lichtste');
    expect(ans.resolved).toBe(true);
    expect(await page.evaluate(n =>
      store.machines().find(m => m.name === n).stack, OPEN_MACHINE)).toEqual(before);
  });

  test('"hoeft niet" sluit de vraag zonder iets in te vullen', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, OPEN_MACHINE_2);
    await body.locator('.ask-moot').click();
    await page.waitForTimeout(250);
    const open = await page.evaluate(() => machinesWithOpenQuestion().map(m => m.name));
    expect(open).not.toContain(OPEN_MACHINE_2);
  });

  test('parseWeightList leest kommagetallen en losse getallen los uit elkaar', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => parseWeightList('9, 14, 18, 23'))).toEqual([9, 14, 18, 23]);
    expect(await page.evaluate(() => parseWeightList('9,14,18'))).toEqual([9, 14, 18]);
    expect(await page.evaluate(() => parseWeightList('losse gewichtjes van 2,3 kg'))).toEqual([2.3]);
  });
});

test.describe('Geen vraag meer als je er allang boven traint', () => {
  test('een gemiddelde boven de drempel laat de vraag vervallen', async ({ page }) => {
    await openApp(page);
    const res = await page.evaluate(n => {
      const m = store.machines().find(x => x.name === n);
      const before = !!openQuestionFor(m);
      // vier sessies ruim boven de drempel van 23 kg
      store.setSessions([1, 2, 3, 4].map((i) => ({
        id: 's' + i, date: '2026-07-0' + i, entries: [{ machineId: m.id, weight: 43 }],
      })));
      return { before, after: !!openQuestionFor(store.machines().find(x => x.id === m.id)) };
    }, OPEN_MACHINE);
    expect(res.before).toBe(true);
    expect(res.after).toBe(false);
  });

  test('een gemiddelde onder de drempel houdt de vraag gewoon staan', async ({ page }) => {
    await openApp(page);
    const open = await page.evaluate(n => {
      const m = store.machines().find(x => x.name === n);
      store.setSessions([{ id: 's1', date: '2026-07-01', entries: [{ machineId: m.id, weight: 14 }] }]);
      return !!openQuestionFor(store.machines().find(x => x.id === m.id));
    }, OPEN_MACHINE);
    expect(open).toBe(true);
  });

  test('de Pulldown vraagt uit zichzelf niets: je traint er al boven', async ({ page }) => {
    await openApp(page);
    // standaardgewicht 36 kg, drempel 36 — dus meteen afgehandeld zonder foto
    const open = await page.evaluate(() => machinesWithOpenQuestion().map(m => m.name));
    expect(open).not.toContain('Pulldown');
    expect(open).not.toContain('Seated Leg Press'); // 109 kg, ruim boven 86
    expect(open).toContain('Shoulder Press');
  });

  test('de banner in de sessie noemt alleen wat nog echt open staat', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(250);
    const txt = await page.locator('.photo-banner').innerText();
    expect(txt).toContain('Shoulder Press');
    expect(txt).not.toContain('Pulldown');
    expect(txt).not.toContain('Seated Chest Press');
    expect(txt).not.toContain('Leg Curl'); // foto binnen, stapel staat erin
  });

  test('een vraag zonder drempel vervalt nooit vanzelf', async ({ page }) => {
    await openApp(page);
    const open = await page.evaluate(() => {
      // stapel volledig onbekend: dan helpt een hoog gemiddelde niet, de vraag blijft
      MACHINE_OPEN_QUESTIONS['Dumbells'] = { q: 'test', mootAbove: null };
      const m = store.machines().find(x => x.name === 'Dumbells');
      store.setSessions([{ id: 's1', date: '2026-07-01', entries: [{ machineId: m.id, weight: 200 }] }]);
      return !!openQuestionFor(store.machines().find(x => x.id === m.id));
    });
    expect(open).toBe(true);
  });
});

test.describe('Gewichtsstapel van de leg curl', () => {
  test('komt uit de foto: 9 t/m 90 kg, veertien platen', async ({ page }) => {
    await openApp(page);
    const stack = await page.evaluate(() =>
      store.machines().find(m => m.name === 'Leg Curl').stack);
    expect(stack).toEqual([9, 14, 18, 23, 29, 36, 43, 50, 57, 63, 70, 77, 84, 90]);
  });

  test('de leg curl heeft geen openstaande vraag meer', async ({ page }) => {
    await openApp(page);
    const open = await page.evaluate(() => machinesWithOpenQuestion().map(m => m.name));
    expect(open).not.toContain('Leg Curl');
  });

  test('een bestaande leg curl zonder stapel krijgt hem alsnog', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const ms = store.machines();
      delete ms.find(m => m.name === 'Leg Curl').stack;
      store.setMachines(ms);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.route === 'function');
    const stack = await page.evaluate(() =>
      store.machines().find(m => m.name === 'Leg Curl').stack);
    expect(stack).toHaveLength(14);
    expect(stack[stack.length - 1]).toBe(90);
  });

  test('het gewicht klikt nu op de echte platen', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Leg Curl');
    await expect(body.locator('.stack-row')).toHaveCount(1);
    await expect(body.locator('.weight-display')).toHaveValue('23');
    await body.locator('[data-act="inc"]').click();
    await expect(body.locator('.weight-display')).toHaveValue('29'); // volgende plaat, niet +1
  });
});

test.describe("Do's & don'ts weghalen", () => {
  test('selectiemodus toont vinkvakjes en verwijdert de aangevinkte regels', async ({ page }) => {
    await openApp(page);
    await openExercise(page, 'Seated Chest Press');
    await openDosDonts(page);
    const before = await page.evaluate(() =>
      machineExtraTips(store.machines().find(m => m.name === 'Seated Chest Press')).length);
    const card = page.locator('.machine-card.open .mc-body');
    await expect(card.locator('ul.dos-list input[type=checkbox]')).toHaveCount(0);
    await card.locator('.tip-pick-toggle').click();
    await page.waitForTimeout(250);
    // na het omschakelen staat het blok open met vinkvakjes ervoor
    const card2 = page.locator('.machine-card.open .mc-body');
    await expect(card2.locator('ul.dos-list input[type=checkbox]')).toHaveCount(before);
    await card2.locator('ul.dos-list input[type=checkbox]').first().check();
    await card2.locator('.tip-pick-del').click();
    await page.click('#modal-confirm');
    await page.waitForTimeout(250);
    const after = await page.evaluate(() =>
      machineExtraTips(store.machines().find(m => m.name === 'Seated Chest Press')).length);
    expect(after).toBe(before - 1);
  });

  test('zonder aanvinken verwijdert de knop niets', async ({ page }) => {
    await openApp(page);
    await openExercise(page, 'Seated Chest Press');
    await openDosDonts(page);
    const before = await page.evaluate(() =>
      machineMistakes(store.machines().find(m => m.name === 'Seated Chest Press')).length);
    await page.locator('.machine-card.open .tip-pick-toggle').click();
    await page.waitForTimeout(250);
    await page.locator('.machine-card.open .tip-pick-del').click();
    await page.waitForTimeout(250);
    await expect(page.locator('#modal.show')).toHaveCount(0);
    const after = await page.evaluate(() =>
      machineMistakes(store.machines().find(m => m.name === 'Seated Chest Press')).length);
    expect(after).toBe(before);
  });

  test('alles weghalen laat de lijst leeg — hij valt niet terug op de standaard', async ({ page }) => {
    await openApp(page);
    const left = await page.evaluate(() => {
      const ms = store.machines();
      const m = ms.find(x => x.name === 'Pulldown');
      const n = machineMistakes(m).length;
      removeMachineTipLines(m.id, 'donts', [...Array(n).keys()]);
      return machineMistakes(store.machines().find(x => x.id === m.id)).length;
    });
    expect(left).toBe(0);
  });

  test('standaardtekst terugzetten herstelt beide lijsten', async ({ page }) => {
    await openApp(page);
    const back = await page.evaluate(() => {
      const ms = store.machines();
      const m = ms.find(x => x.name === 'Pulldown');
      const was = machineMistakes(m).length;
      removeMachineTipLines(m.id, 'donts', [0]);
      const ms2 = store.machines();
      const t = ms2.find(x => x.id === m.id);
      delete t.tips; delete t.mistakes; delete t.dosEdited; delete t.dontsEdited;
      store.setMachines(ms2);
      return { was, now: machineMistakes(store.machines().find(x => x.id === m.id)).length };
    });
    expect(back.now).toBe(back.was);
  });

  test('wat je in de sessie weghaalt is ook op de Tips-pagina weg', async ({ page }) => {
    await openApp(page);
    const removed = await page.evaluate(() => {
      const m = store.machines().find(x => x.name === 'Pulldown');
      const first = machineExtraTips(m)[0];
      removeMachineTipLines(m.id, 'dos', [0]);
      return first;
    });
    await goto(page, 'tips');
    await page.evaluate(() => document.querySelectorAll('#tips-content details').forEach(d => d.open = true));
    const shown = await page.locator('#tips-content ul.dos-list li').allInnerTexts();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.map(t => t.trim())).not.toContain(removed.trim());
  });
});

test.describe('Neon-driehoekjes', () => {
  test("do's zijn neongroen en don'ts neonrood", async ({ page }) => {
    await openApp(page);
    await openExercise(page, 'Seated Chest Press');
    const cols = await page.evaluate(() => {
      const pick = sel => {
        const li = document.querySelector('.machine-card.open ' + sel + ' li');
        return li ? getComputedStyle(li, '::before').borderLeftColor : null;
      };
      return { dos: pick('ul.dos-list'), donts: pick('ul.donts-list') };
    });
    expect(cols.dos).toBe('rgb(57, 255, 20)');
    expect(cols.donts).toBe('rgb(255, 7, 58)');
  });
});

test.describe('Het gewicht gaat nooit meer vanzelf omlaag', () => {
  for (const feel of [1, 2]) {
    test(`gevoel ${feel} zet geen verlaging klaar, ook niet na afvinken`, async ({ page }) => {
      await openApp(page);
      const body = await openExercise(page, 'Seated Chest Press');
      const before = await page.evaluate(() =>
        store.machines().find(m => m.name === 'Seated Chest Press').lastWeight);
      await body.locator(`[data-feel="${feel}"]`).click();
      await page.waitForTimeout(150);
      await page.locator('.machine-card.open .done-btn').click();
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => {
        const m = store.machines().find(x => x.name === 'Seated Chest Press');
        return { nextUp: m.nextUp, weight: m.lastWeight };
      });
      expect(after.nextUp == null || after.nextUp.dir !== 'down').toBe(true);
      expect(after.weight).toBe(before);
    });
  }

  test('thuis stelt het doel ook niet meer vanzelf naar beneden bij', async ({ page }) => {
    await openApp(page);
    // hwLowerIfDarkRed bestaat niet meer; er is dus geen pad dat een doel verlaagt
    const gone = await page.evaluate(() => typeof window.hwLowerIfDarkRed === 'undefined');
    expect(gone).toBe(true);
  });
});

test.describe('Gewichtsvierkantje naast de oefeningnaam', () => {
  test('toont het gewicht in cijfers, zonder eenheid', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    const badge = page.locator('.machine-card', { hasText: 'Seated Chest Press' }).locator('.w-badge').first();
    await expect(badge).toHaveText('23');
    await expect(badge).not.toContainText('kg');
  });

  test('de rand krijgt de kleur van hoe zwaar het vorige keer voelde', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const m = store.machines().find(x => x.name === 'Seated Chest Press');
      store.setSessions([{ id: 'a', date: '2026-07-20',
        entries: [{ machineId: m.id, weight: 23, feeling: 1 }] }]);
      renderSession();
    });
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    const border = await page.locator('.machine-card', { hasText: 'Seated Chest Press' })
      .locator('.w-badge').first().evaluate(el => getComputedStyle(el).borderTopColor);
    expect(border).toBe('rgb(127, 29, 29)'); // donkerrood = veel te zwaar
  });

  test('zonder ingevuld gevoel blijft de rand neutraal en gestippeld', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    const badge = page.locator('.machine-card', { hasText: 'Seated Chest Press' }).locator('.w-badge').first();
    await expect(badge).toHaveClass(/none/);
    expect(await badge.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('dashed');
  });

  test('de rand is dik genoeg om af te lezen', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    const w = await page.locator('.w-badge').first().evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(w).toBeGreaterThanOrEqual(3);
  });

  test('cardio-oefeningen hebben geen vierkantje', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    const n = await page.locator('.machine-card', { hasText: 'Warming-up' }).locator('.w-badge').count();
    expect(n).toBe(0);
  });
});

test.describe('Intensiteit op het samenvattingsbord', () => {
  test('donkerrood telt als 5, geel als 3 en donkergroen als 1', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => intensityOf(1))).toBe(5);
    expect(await page.evaluate(() => intensityOf(3))).toBe(3);
    expect(await page.evaluate(() => intensityOf(5))).toBe(1);
    expect(await page.evaluate(() => intensityOf(null))).toBe(null);
  });

  test('het gemiddelde telt alleen oefeningen waar je een gevoel invulde', async ({ page }) => {
    await openApp(page);
    const it = await page.evaluate(() => sessionIntensity({ entries: [
      { feeling: 1 }, { feeling: 3 }, {}, { feeling: 5 },
    ] }));
    expect(it.n).toBe(3);
    expect(it.avg).toBeCloseTo(3, 5); // (5 + 3 + 1) / 3
  });

  test('het blok staat op het bord met cijfer, balk en kleur', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    // twee oefeningen afronden, allebei donkerrood
    for (let i = 0; i < 2; i++) {
      await page.locator('.machine-card:not(.done)').filter({ hasNot: page.locator('.chk') }).nth(1).locator('.mc-header').click();
      await page.waitForTimeout(250);
      const feel = page.locator('.machine-card.open [data-feel="1"]');
      if (await feel.count()) await feel.click();
      await page.waitForTimeout(150);
      await page.locator('.machine-card.open .done-btn').click();
      await page.waitForTimeout(300);
    }
    await page.click('#finish-session');
    await page.waitForTimeout(1200);
    const box = page.locator('#summary-content .si-box');
    await expect(box).toHaveCount(1);
    await expect(box.locator('.si-num')).toContainText('5,0');
    const col = await box.locator('.si-fill').evaluate(el => el.style.background);
    expect(col.replace(/\s/g, '')).toContain('rgb(127,29,29)'); // donkerrood
  });

  test('zonder ingevuld gevoel verschijnt het blok niet', async ({ page }) => {
    await openApp(page);
    await page.click('#enter-gym');
    await page.waitForTimeout(300);
    await page.locator('.mc-header').nth(1).click();
    await page.waitForTimeout(250);
    await page.locator('.machine-card.open .done-btn').click();
    await page.waitForTimeout(300);
    await page.click('#finish-session');
    await page.waitForTimeout(1200);
    await expect(page.locator('#summary-content .si-box')).toHaveCount(0);
  });
});

test.describe('Zwaarder vinkt meteen af', () => {
  test('één tik noteert, vinkt af en klapt in', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await body.locator('.act-up').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.machine-card.open')).toHaveCount(0);
    const state = await page.evaluate(() => {
      const m = store.machines().find(x => x.name === 'Seated Chest Press');
      return { entries: currentSession.entries.length, dir: m.nextUp && m.nextUp.dir };
    });
    expect(state.entries).toBe(1);
    expect(state.dir).toBe('up');
  });

  test('nog een keer tikken haalt het vlaggetje eraf zonder af te vinken', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await body.locator('.act-up').click();
    await page.waitForTimeout(400);
    // heropenen en het vlaggetje eraf halen
    await page.locator('.mc-header', { hasText: 'Seated Chest Press' }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('.machine-card.open .act-up')).toHaveClass(/active/);
    await page.locator('.machine-card.open .act-up').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.machine-card.open')).toHaveCount(1); // blijft open
    const dir = await page.evaluate(() => {
      const m = store.machines().find(x => x.name === 'Seated Chest Press');
      return m.nextUp && m.nextUp.dir;
    });
    expect(dir).toBeFalsy();
  });
});

test.describe('De coach houdt het kort', () => {
  test('sets en reps worden niet meer voorgelezen', async ({ page }) => {
    await openApp(page);
    const spoken = await page.evaluate(() => {
      const said = [];
      const orig = voiceCoach.speak;
      voiceCoach.speak = (t) => said.push(t);
      speakMachineSettings(store.machines()[1]);
      voiceCoach.speak = orig;
      return said.join(' ');
    });
    expect(spoken).toMatch(/Gewicht \d+ kilo/);
    expect(spoken).not.toMatch(/sets van/i);
  });
});

test.describe('Modals passen op een telefoon', () => {
  test('de zwaarder-vraag blijft binnen 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await body.locator('[data-feel="5"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#modal.show')).toHaveCount(1);
    const fit = await page.evaluate(() => {
      const modal = document.querySelector('#modal');
      const r = modal.getBoundingClientRect();
      const btns = [...modal.querySelectorAll('.modal-actions .btn')];
      return {
        modalOverflow: r.left < 0 || r.right > window.innerWidth,
        scrollX: modal.scrollWidth > modal.clientWidth + 1,
        btnOverflow: btns.some(b => b.scrollWidth > b.clientWidth + 1),
        btnOutside: btns.some(b => b.getBoundingClientRect().right > r.right + 1),
      };
    });
    expect(fit).toEqual({ modalOverflow: false, scrollX: false, btnOverflow: false, btnOutside: false });
  });
});

test.describe('Gevoelskleur in de grafieken', () => {
  test('de balk kleurt mee met het gemiddelde van de vijfpuntsschaal', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const ms = store.machines().filter(m => !m.cardio);
      store.setSessions([1, 2].map((i) => ({
        id: 's' + i, date: '2026-07-0' + i,
        entries: ms.map(m => ({ machineId: m.id, weight: 40, feeling: i === 1 ? 1 : 5 })),
      })));
    });
    await goto(page, 'stats');
    await page.waitForTimeout(400);
    const bg = await page.locator('#total-chart-card .wave-bar').first().evaluate(el => el.style.background);
    expect(bg).toContain('rgb(127, 29, 29)'); // donkerrood = gevoel 1
    await expect(page.locator('.feel-legend')).toHaveCount(1);
  });

  test('feelColor mengt tussen twee stappen in plaats van af te ronden', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => feelColor(3))).toBe('rgb(234,179,8)');
    expect(await page.evaluate(() => feelColor(1))).toBe('rgb(127,29,29)');
    const mid = await page.evaluate(() => feelColor(3.5));
    expect(mid).not.toBe(await page.evaluate(() => feelColor(3)));
    expect(mid).not.toBe(await page.evaluate(() => feelColor(4)));
    expect(await page.evaluate(() => feelColor(null))).toBe(null);
  });

  test('de PR-cel in de waffle krijgt de gevoelskleur als achtergrond', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const m = store.machines().find(x => !x.cardio);
      store.setSessions([
        { id: 'a', date: '2026-07-01', entries: [{ machineId: m.id, weight: 20, feeling: 3 }] },
        { id: 'b', date: '2026-07-02', entries: [{ machineId: m.id, weight: 40, feeling: 5 }] },
      ]);
    });
    await goto(page, 'stats');
    await page.waitForTimeout(300);
    const bg = await page.locator('#waffle-section .waffle-cell.pr').first().evaluate(el => el.style.background);
    expect(bg).toContain('rgb(22, 101, 52)'); // donkergroen = gevoel 5
  });

  test('zonder ingevuld gevoel blijft de standaardkleur staan', async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
    await page.evaluate(() => {
      store.setSessions(store.sessions().map(s => ({
        ...s, entries: s.entries.map(e => { const c = { ...e }; delete c.feeling; return c; }),
      })));
    });
    await goto(page, 'stats');
    await page.waitForTimeout(400);
    const bg = await page.locator('#total-chart-card .wave-bar').first().evaluate(el => el.style.background);
    expect(bg).toBe('');
    await expect(page.locator('.feel-legend')).toHaveCount(0);
  });
});

test.describe('PR op Home = de zwaarste hele sessie', () => {
  test('gym telt alle gewichten van één sessie bij elkaar op', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const m = store.machines().filter(x => !x.cardio).slice(0, 3);
      store.setSessions([
        { id: 'a', date: '2026-07-01', entries: m.map(x => ({ machineId: x.id, weight: 30 })) }, // 90
        { id: 'b', date: '2026-07-02', entries: [{ machineId: m[0].id, weight: 80 }] },          // 80
      ]);
      renderHome();
    });
    await goto(page, 'home');
    const pr = await page.locator('.hero-row.row-gym .hero-count[data-jump="pr"] .hc-num').innerText();
    expect(pr).toBe('90');
  });

  test('thuis doet hetzelfde met de thuis-workouts', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      store.setHomeSessions([
        { date: '2026-07-01', entries: [{ exerciseName: 'a', value: 10, weight: 16 }, { exerciseName: 'b', value: 10, weight: 16 }] },
        { date: '2026-07-02', entries: [{ exerciseName: 'a', value: 10, weight: 20 }] },
      ]);
      renderHome();
    });
    await goto(page, 'home');
    const pr = await page.locator('.hero-row.row-home .hero-count[data-jump="pr"] .hc-num').innerText();
    expect(pr).toBe('32');
  });
});

test.describe("Hero's aan- en uitzetten", () => {
  test('een uitgezette hero verdwijnt van Home', async ({ page }) => {
    await openApp(page);
    await goto(page, 'settings');
    await page.locator('#hero-settings [data-hero="calf"]').uncheck();
    await goto(page, 'home');
    await expect(page.locator('.hero-row.row-calf')).toBeHidden();
    await expect(page.locator('.hero-row.row-gym')).toBeVisible();
  });

  test('de uitgezette hero komt terug als rustige knop onderaan', async ({ page }) => {
    await openApp(page);
    await goto(page, 'settings');
    await page.locator('#hero-settings [data-hero="gym"]').uncheck();
    await goto(page, 'home');
    await expect(page.locator('.hero-row.row-gym')).toBeHidden();
    await expect(page.locator('#open-gym')).toBeVisible();
    // en die knop start nog gewoon een sessie
    await page.locator('#open-gym').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-session');
  });

  test('een aangezette hero laat zijn ghost-knop weer verdwijnen', async ({ page }) => {
    await openApp(page);
    await goto(page, 'home');
    await expect(page.locator('#open-calf')).toBeHidden();
    await expect(page.locator('#open-gym')).toBeHidden();
  });

  test('de keuze overleeft herladen', async ({ page }) => {
    await openApp(page);
    await goto(page, 'settings');
    await page.locator('#hero-settings [data-hero="push"]').uncheck();
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.route === 'function');
    await page.waitForTimeout(300);
    await expect(page.locator('.hero-row.row-push')).toBeHidden();
  });

  test('alles uit blijft werkbaar: geen fouten en Home rendert nog', async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      const p = store.prefs();
      Object.keys(p.heroes).forEach(k => p.heroes[k] = false);
      store.setPrefs(p);
      renderHome();
    });
    await goto(page, 'home');
    await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-home');
    await expect(page.locator('.hero-row:visible')).toHaveCount(0);
    await expect(page.locator('#home-last')).toBeVisible();
    // alle vijf de ingangen staan er nog, als rustige knop
    for (const id of ['open-gym', 'open-homeworkout', 'open-calf', 'open-pushup', 'open-situp']) {
      await expect(page.locator('#' + id)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test.describe('Randvoorwaarden blijven staan', () => {
  test('de nieuwe blokken bevatten geen emoji of unicode-symbolen', async ({ page }) => {
    await openApp(page);
    await openExercise(page, OPEN_MACHINE);
    expect(await visibleGlyphs(page)).toEqual([]);
    await openDosDonts(page);
    await page.locator('.machine-card.open .tip-pick-toggle').click();
    await page.waitForTimeout(250);
    expect(await visibleGlyphs(page)).toEqual([]);
    await goto(page, 'settings');
    await page.evaluate(() => document.querySelectorAll('#machine-questions details').forEach(d => d.open = true));
    await page.waitForTimeout(150);
    expect(await visibleGlyphs(page)).toEqual([]);
  });

  test('de coach herhaalt met "I repeat" in plaats van "nog een keer"', async ({ page }) => {
    await openApp(page);
    const spoken = await page.evaluate(() => {
      const said = [];
      const orig = voiceCoach.speak;
      voiceCoach.speak = (t) => said.push(t);
      const c = store.coach(); c.speakSettingsTimes = 2; store.setCoach(c);
      speakMachineSettings(store.machines()[1]);
      voiceCoach.speak = orig;
      return said;
    });
    expect(spoken.some(t => /^I repeat\./.test(t))).toBe(true);
    expect(spoken.some(t => /nog een keer/i.test(t))).toBe(false);
  });
});

test.describe('Vier gekleurde actieknoppen naast elkaar', () => {
  const RGB = {
    back: 'rgb(18, 55, 158)',   // blauw
    up: 'rgb(168, 18, 92)',     // roze
    done: 'rgb(43, 10, 117)',   // paars
    skip: 'rgb(143, 21, 32)',   // rood
  };

  test('de rij staat naast elkaar en elke knop heeft zijn eigen kleur', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await expect(body.locator('.act-row .act-btn')).toHaveCount(4);
    // alle vier op dezelfde hoogte = echt naast elkaar
    const tops = await body.locator('.act-row .act-btn').evaluateAll(
      els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))]);
    expect(tops).toHaveLength(1);
    for (const [cls, rgb] of Object.entries(RGB)) {
      const bg = await body.locator('.act-' + cls).evaluate(el => getComputedStyle(el).backgroundImage);
      expect(bg).toContain(rgb);
    }
  });

  test('elke knop draagt zijn eigen icoon', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    const href = sel => body.locator(sel + ' use').getAttribute('href');
    expect(await href('.act-back')).toBe('#i-undo');
    expect(await href('.act-up')).toBe('#i-dumbbells');
    expect(await href('.act-done')).toBe('#i-save');
    expect(await href('.act-skip')).toBe('#i-hop');
  });

  test('de twee nieuwe iconen bestaan in de sprite', async ({ page }) => {
    await openApp(page);
    for (const id of ['i-dumbbells', 'i-hop']) {
      expect(await page.locator('symbol#' + id).count()).toBe(1);
    }
  });

  test('cardio heeft geen zwaarder-knop, dus drie kolommen', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Warming-up');
    await expect(body.locator('.act-row')).toHaveClass(/cols-3/);
    await expect(body.locator('.act-row .act-btn')).toHaveCount(3);
    await expect(body.locator('.act-up')).toHaveCount(0);
  });

  test('Terug klapt dicht en bewaart je gewicht', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await body.locator('.weight-ctrl [data-act="inc"]').click();
    const shown = await body.locator('.weight-display').inputValue();
    await body.locator('.back-btn').click();
    await page.waitForTimeout(300);
    // kaart is dicht en de oefening is niet afgevinkt
    await expect(page.locator('.machine-card.open')).toHaveCount(0);
    const n = await page.evaluate(() => currentSession.entries.length);
    expect(n).toBe(0);
    // het gewicht is wel onthouden
    const kept = await page.evaluate(() =>
      store.machines().find(m => m.name === 'Seated Chest Press').lastWeight);
    expect(String(kept)).toBe(shown);
  });

  test('Zwaarder wisselt tussen Zwaarder en Genoteerd', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await expect(body.locator('.act-up .act-lbl')).toHaveText('Zwaarder');
    // één tik noteert én vinkt af, dus de kaart klapt dicht — heropenen om de stand te zien
    await body.locator('.act-up').click();
    await page.waitForTimeout(400);
    await page.locator('.mc-header', { hasText: 'Seated Chest Press' }).first().click();
    await page.waitForTimeout(300);
    const up = page.locator('.machine-card.open .act-up');
    await expect(up.locator('.act-lbl')).toHaveText('Genoteerd');
    await expect(up).toHaveClass(/active/);
    await up.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.machine-card.open .act-up .act-lbl')).toHaveText('Zwaarder');
  });

  test('Klaar vinkt af en heet daarna Opslaan', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await expect(body.locator('.act-done .act-lbl')).toHaveText('Klaar');
    await body.locator('.act-done').click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => currentSession.entries.length)).toBe(1);
    await page.locator('.mc-header', { hasText: 'Seated Chest Press' }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('.machine-card.open .act-done .act-lbl')).toHaveText('Opslaan');
    await expect(page.locator('.machine-card.open .undo-btn')).toHaveCount(1);
  });

  test('Overslaan haalt ook een al gezet vinkje weg', async ({ page }) => {
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    await body.locator('.act-done').click();
    await page.waitForTimeout(400);
    await page.locator('.mc-header', { hasText: 'Seated Chest Press' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('.machine-card.open .act-skip').click();
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const m = store.machines().find(x => x.name === 'Seated Chest Press');
      return { entries: currentSession.entries.length, skipped: !!(currentSession.skipped || {})[m.id] };
    });
    expect(state.entries).toBe(0);
    expect(state.skipped).toBe(true);
  });

  test('de labels blijven binnen hun knop op 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openApp(page);
    const body = await openExercise(page, 'Seated Chest Press');
    const overflow = await body.locator('.act-btn').evaluateAll(els => els
      .filter(e => {
        const l = e.querySelector('.act-lbl');
        return l && l.getBoundingClientRect().width > e.getBoundingClientRect().width - 4;
      })
      .map(e => e.querySelector('.act-lbl').textContent));
    expect(overflow).toEqual([]);
  });
});
