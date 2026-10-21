const { test, expect } = require('@playwright/test');
const { openApp, goto, visibleGlyphs } = require('./helpers');

/* ============================================================
   Thuis-workout in de opbouw van de gym-sessie: kaarten dicht,
   afgevinkt naar onderen, terug naar boven, alternatieven per
   niveau en een warming-up-kaart bovenaan.
   ============================================================ */

const ALL_GEAR = ['geen', 'mat', 'dumbbells', 'kettlebell', 'weerstandsband'];
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Opent de thuis-workout met vast materiaal en (optioneel) een vast voorstel. */
async function openHome(page, opts = {}) {
  await openApp(page);
  await page.evaluate(o => {
    const h = store.home();
    h.equipment = o.equipment;
    h.warmupMin = o.warmupMin;
    store.setHome(h);
    if (o.sessions) store.setHomeSessions(o.sessions);
    store.clearHomeWorkout();
  }, { equipment: opts.equipment || ALL_GEAR, warmupMin: opts.warmupMin == null ? 3 : opts.warmupMin, sessions: opts.sessions || null });
  await goto(page, 'homeworkout');
  if (opts.plan) {
    await page.evaluate(plan => { const w = store.homeWorkout(); w.plan = plan; store.setHomeWorkout(w); renderHomeWorkout(); }, opts.plan);
    await page.waitForTimeout(150);
  }
}
const card = (page, name) => page.locator('#hw-plan .hw-card').filter({ has: page.locator('.m-name', { hasText: new RegExp('^' + reEsc(name) + '$') }) });
const openCard = page => page.locator('#hw-plan .hw-card.open');
const order = page => page.locator('#hw-plan .hw-card .m-name').allTextContents();
async function open(page, name) {
  await card(page, name).locator('.mc-header').click();
  await page.waitForTimeout(150);
}
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

test.describe('Thuis-workout: dezelfde lijst als de gym', () => {
  test('alle kaarten staan dicht en de warming-up staat bovenaan', async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => { store.clearHomeWorkout(); });
    await goto(page, 'homeworkout');
    const n = await page.evaluate(() => store.homeWorkout().plan.length);
    await expect(page.locator('#hw-plan .hw-card')).toHaveCount(n + 1);
    await expect(page.locator('#hw-plan .hw-card.open')).toHaveCount(0);
    await expect(page.locator('#hw-plan .mc-body')).toHaveCount(0);
    await expect(page.locator('#hw-plan .hw-card').first()).toHaveClass(/hw-warm/);
    await expect(page.locator('#hw-progress')).toHaveText(`0 / ${n + 1}`);
    // de reeks-speler is weg
    await expect(page.locator('#hw-play, #hwp-done')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('er staat hooguit één kaart open', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank', 'Glute bridge'] });
    await open(page, 'Plank');
    await expect(openCard(page)).toHaveCount(1);
    await open(page, 'Glute bridge');
    await expect(openCard(page)).toHaveCount(1);
    await expect(openCard(page).locator('.m-name')).toHaveText('Glute bridge');
    // nog een keer op de kop = dicht
    await openCard(page).locator('.mc-header').click();
    await expect(openCard(page)).toHaveCount(0);
  });

  test('Klaar: de kaart zakt naar onderen en het scherm gaat terug naar boven', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank', 'Glute bridge'] });
    await open(page, 'Plank');
    await page.evaluate(() => window.scrollTo(0, 400));
    await openCard(page).locator('.done-btn').click();
    await page.waitForTimeout(900);
    expect(await order(page)).toEqual(['Warming-up', 'Squat (lichaamsgewicht)', 'Glute bridge', 'Plank']);
    await expect(card(page, 'Plank')).toHaveClass(/done/);
    await expect(card(page, 'Plank').locator('.chk')).toHaveCount(1);
    await expect(openCard(page)).toHaveCount(0);
    await expect(page.locator('#hw-progress')).toHaveText('1 / 4');
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);
    const r = await page.evaluate(() => store.homeWorkout().results['Plank']);
    expect(r.done).toBe(true);
    expect(r.value).toBe(30);   // 3×30 sec
    expect(r.setsDone).toBe(3); // niets afgetikt = alle sets
  });

  test('Overslaan zet hem tussen te doen en klaar; Toch doen haalt hem terug', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank', 'Glute bridge'] });
    await open(page, 'Squat (lichaamsgewicht)');
    await openCard(page).locator('.done-btn').click();
    await page.waitForTimeout(300);
    await open(page, 'Plank');
    await openCard(page).locator('.skip-btn').click();
    await page.waitForTimeout(400);
    expect(await order(page)).toEqual(['Warming-up', 'Glute bridge', 'Plank', 'Squat (lichaamsgewicht)']);
    await expect(card(page, 'Plank')).toHaveClass(/skipped/);
    await expect(card(page, 'Plank').locator('.skip-tag')).toHaveCount(1);
    await expect(page.locator('#hw-progress')).toHaveText('1 / 3 · 1 overgeslagen');
    await open(page, 'Plank');
    await expect(openCard(page).locator('.skip-btn .act-lbl')).toHaveText('Toch doen');
    await openCard(page).locator('.skip-btn').click();
    await page.waitForTimeout(300);
    expect(await order(page)).toEqual(['Warming-up', 'Plank', 'Glute bridge', 'Squat (lichaamsgewicht)']);
    await expect(openCard(page).locator('.m-name')).toHaveText('Plank');
  });

  test('Terug klapt alleen dicht en houdt je cijfer vast', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank'] });
    await open(page, 'Squat (lichaamsgewicht)');
    await expect(openCard(page).locator('.wr-num')).toHaveText('15');
    await openCard(page).locator('[data-act="inc"]').click();
    await openCard(page).locator('[data-act="inc"]').click();
    await expect(openCard(page).locator('.wr-num')).toHaveText('17');
    await expect(openCard(page).locator('.mc-header .w-badge')).toHaveText('17');
    await openCard(page).locator('.back-btn').click();
    await page.waitForTimeout(200);
    await expect(openCard(page)).toHaveCount(0);
    expect(await order(page)).toEqual(['Warming-up', 'Squat (lichaamsgewicht)', 'Plank']);
    expect(await page.evaluate(() => store.homeWorkout().results['Squat (lichaamsgewicht)'].value)).toBe(17);
    await expect(card(page, 'Squat (lichaamsgewicht)').locator('.m-sr')).toHaveText('3×17');
    await open(page, 'Squat (lichaamsgewicht)');
    await expect(openCard(page).locator('.wr-num')).toHaveText('17');
  });

  test('vierkantje: kg of reps, met de gevoelskleur van vorige keer als rand', async ({ page }) => {
    await openHome(page, {
      plan: ['Goblet squat', 'Squat (lichaamsgewicht)'],
      sessions: [{ id: 'h1', date: daysAgo(2), endedAt: new Date().toISOString(), entries: [{ exerciseName: 'Goblet squat', value: 10, metric: 'reps', weight: 20, feeling: 4, sets: 3 }] }],
    });
    const kb = card(page, 'Goblet squat').locator('.w-badge');
    await expect(kb).toHaveText('20');
    expect(await kb.evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(74, 222, 128)');
    const bw = card(page, 'Squat (lichaamsgewicht)').locator('.w-badge');
    await expect(bw).toHaveText('15');
    await expect(bw).toHaveClass(/none/);
    await expect(card(page, 'Goblet squat').locator('.m-sr')).toHaveText('3×10');
  });

  test('geschiedenis, record en de kettlebell als stapel in de open kaart', async ({ page }) => {
    await openHome(page, {
      plan: ['Goblet squat'],
      sessions: [16, 20].map((kg, i) => ({ id: 'h' + i, date: daysAgo(5 - i), endedAt: new Date().toISOString(), entries: [{ exerciseName: 'Goblet squat', value: 10, metric: 'reps', weight: kg, feeling: 3, sets: 3 }] })),
    });
    await open(page, 'Goblet squat');
    const body = openCard(page);
    await expect(body.locator('.hist-strip .hs-cell')).toHaveCount(2);
    await expect(body.locator('.hist-strip .hs-lbl')).toContainText('PR 20 kg');
    await expect(body.locator('.wr-num')).toHaveText('20');
    await expect(body.locator('.stack-label')).toHaveText('kettlebell 2 van 5');
    await expect(body.locator('.wr-pr')).toContainText('20 kg');
    await body.locator('[data-act="inc"]').click();
    await expect(body.locator('.wr-num')).toHaveText('24');
  });

  test('set-rondjes starten de rusttimer, ook in de thuis-workout', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)'] });
    await open(page, 'Squat (lichaamsgewicht)');
    await openCard(page).locator('.hw-sr > summary').click();
    await openCard(page).locator('.set-dot').first().click();
    await expect(page.locator('#hw-rest-banner')).toHaveClass(/active/);
    await expect(page.locator('#hw-rest-banner')).toContainText('Rust');
    await expect(openCard(page).locator('.hw-sr > summary')).toContainText('1 gedaan');
    expect(await page.evaluate(() => store.homeWorkout().results['Squat (lichaamsgewicht)'].setsDone)).toBe(1);
    await page.evaluate(() => restTimer.stop());
  });

  test('secondentimer bij oefeningen op tijd', async ({ page }) => {
    await openHome(page, { plan: ['Plank'] });
    await open(page, 'Plank');
    const btn = openCard(page).locator('.hw-timer-btn');
    await expect(btn).toContainText('Start 30 sec timer');
    await btn.click();
    await expect(openCard(page).locator('.hw-timer-big')).toHaveText(/\d+ sec/);
    await expect(btn).toContainText('Stop timer');
    await btn.click();
    await expect(btn).toContainText('Start 30 sec timer');
  });

  test('Zwaarder noteert het advies en vinkt af; de volgende keer staat het voorstel klaar', async ({ page }) => {
    await openHome(page, { plan: ['Goblet squat', 'Plank'] });
    await open(page, 'Goblet squat');
    await openCard(page).locator('.nextup-btn').click();
    await page.waitForTimeout(300);
    await expect(card(page, 'Goblet squat')).toHaveClass(/done/);
    const nu = await page.evaluate(() => store.home().nextUp['Goblet squat']);
    expect(nu.to.kg).toBe(20);
    // een nieuwe workout (andere dag/id) toont het advies, en de knop zet het gewicht
    await page.evaluate(() => {
      store.clearHomeWorkout();
      route('homeworkout');
      const w = store.homeWorkout(); w.plan = ['Goblet squat']; store.setHomeWorkout(w); renderHomeWorkout();
    });
    await expect(card(page, 'Goblet squat').locator('.w-badge')).toHaveText('16');
    await open(page, 'Goblet squat');
    const badge = openCard(page).locator('.nextup-badge');
    await expect(badge).toContainText('20 kg');
    await expect(openCard(page).locator('.wr-num')).toHaveText('16'); // advies verzet het cijfer niet
    await badge.locator('.apply-suggest').click();
    await expect(openCard(page).locator('.wr-num')).toHaveText('20');
    await expect(openCard(page).locator('.nextup-btn .act-lbl')).toHaveText('Genoteerd');
    // gehaald = de vlag ruimt zichzelf op
    await openCard(page).locator('.done-btn').click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (store.home().nextUp || {})['Goblet squat'])).toBeUndefined();
  });

  test('dosering gehaald: een stapje erbij als advies, dat na "zet op" verdwijnt', async ({ page }) => {
    await openHome(page, {
      plan: ['Squat (lichaamsgewicht)'],
      sessions: [{ id: 'h1', date: daysAgo(2), endedAt: new Date().toISOString(), entries: [{ exerciseName: 'Squat (lichaamsgewicht)', value: 15, metric: 'reps', feeling: 3, sets: 3 }] }],
    });
    await open(page, 'Squat (lichaamsgewicht)');
    const badge = openCard(page).locator('.nextup-badge');
    await expect(badge).toContainText('16 reps');
    await expect(openCard(page).locator('.wr-num')).toHaveText('15');
    await badge.locator('.apply-suggest').click();
    await expect(openCard(page).locator('.wr-num')).toHaveText('16');
    await expect(openCard(page).locator('.nextup-badge')).toHaveCount(0);
  });

  test('groen gevoel vraagt of het zwaarder mag, rood haalt het advies weer weg', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)'] });
    await open(page, 'Squat (lichaamsgewicht)');
    await openCard(page).locator('[data-feel="5"]').click();
    await expect(page.locator('#modal.show')).toHaveCount(1);
    await expect(page.locator('#modal-title')).toHaveText('Zwaarder de volgende keer?');
    await page.click('#modal-confirm');
    await expect(openCard(page).locator('.nextup-btn .act-lbl')).toHaveText('Genoteerd');
    expect(await page.evaluate(() => store.home().nextUp['Squat (lichaamsgewicht)'].to.value)).toBe(17);
    await openCard(page).locator('[data-feel="1"]').click();
    await expect(openCard(page).locator('.nextup-btn .act-lbl')).toHaveText('Zwaarder');
    expect(await page.evaluate(() => (store.home().nextUp || {})['Squat (lichaamsgewicht)'])).toBeUndefined();
  });

  test('als alles erop staat vraagt de app of je wilt afronden', async ({ page }) => {
    await openHome(page, { plan: ['Plank'], warmupMin: 0 });
    await expect(page.locator('#hw-plan .hw-warm')).toHaveCount(0);
    await open(page, 'Plank');
    await openCard(page).locator('.done-btn').click();
    await expect(page.locator('#modal.show')).toHaveCount(1, { timeout: 3000 });
    await expect(page.locator('#modal-title')).toHaveText('Workout afronden?');
    await page.click('#modal-confirm');
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => store.homeSessions().length)).toBe(1);
  });

  test('afronden bewaart je naam, de warming-up, sets en het niveau', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank'] });
    await page.fill('#hw-name', 'Woensdag thuis');
    await open(page, 'Warming-up');
    await openCard(page).locator('.done-btn').click();
    await page.waitForTimeout(300);
    await open(page, 'Squat (lichaamsgewicht)');
    await openCard(page).locator('.done-btn').click();
    await page.waitForTimeout(300);
    await page.click('#hw-finish');
    await page.waitForTimeout(1200);
    const s = await page.evaluate(() => store.homeSessions().slice(-1)[0]);
    expect(s.name).toBe('Woensdag thuis');
    expect(s.warmup.min).toBe(3);
    expect(s.warmup.moves).toHaveLength(6);
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0]).toMatchObject({ exerciseName: 'Squat (lichaamsgewicht)', value: 15, sets: 3, setsDone: 3, level: 'novice' });
    await expect(page.locator('#summary-modal.show')).toHaveCount(1);
    await expect(page.locator('#summary-content .ss-sub').first()).toContainText('warming-up 3 min');
  });

  test('een workout van vóór deze opzet (reeks-speler) opent gewoon als lijst', async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(() => {
      store.setHomeWorkout({ id: 'oud', date: todayISO(), startedAt: new Date().toISOString(), salt: 2, plan: ['Plank', 'Glute bridge'], results: { Plank: { metric: 'sec', done: true, value: 35 } }, playing: true, playIdx: 1 });
    });
    await goto(page, 'homeworkout');
    await expect(page.locator('#hw-plan .hw-card')).toHaveCount(3);
    const w = await page.evaluate(() => store.homeWorkout());
    expect(w.playing).toBeUndefined();
    expect(w.warmup.moves.length).toBe(6);
    await expect(card(page, 'Plank')).toHaveClass(/done/);
    expect(errors).toEqual([]);
  });
});

test.describe('Thuis-workout: niveaus en alternatieven', () => {
  test('elke oefening heeft een van de vier MuscleWiki-niveaus', async ({ page }) => {
    await openApp(page);
    const r = await page.evaluate(() => ({
      n: SNACK_POOL.length,
      missing: SNACK_POOL.filter(s => !LEVELS.includes(SNACK_LEVELS[s.name])).map(s => s.name),
      extra: Object.keys(SNACK_LEVELS).filter(k => !SNACK_POOL.some(s => s.name === k)),
      used: [...new Set(Object.values(SNACK_LEVELS))].sort(),
    }));
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
    expect(r.used).toEqual(['advanced', 'beginner', 'intermediate', 'novice']);
  });

  test('het niveau staat gekleurd in de kaart en is aan te passen', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)'] });
    await open(page, 'Squat (lichaamsgewicht)');
    const badge = openCard(page).locator('.lvl-badge');
    await expect(badge).toHaveText('Novice');
    expect(await badge.evaluate(el => getComputedStyle(el).getPropertyValue('--lvl').trim())).toBe('#22c55e');
    await badge.click();
    await expect(openCard(page).locator('.hw-lvl-pick')).toBeVisible();
    await expect(openCard(page).locator('[data-setlvl]')).toHaveCount(4);
    await openCard(page).locator('[data-setlvl="intermediate"]').click();
    await expect(openCard(page).locator('.lvl-badge')).toHaveText('Intermediate');
    expect(await page.evaluate(() => store.home().levels['Squat (lichaamsgewicht)'])).toBe('intermediate');
    // terug naar de inschatting = je eigen keuze vervalt
    await openCard(page).locator('.lvl-badge').click();
    await openCard(page).locator('[data-setlvl="novice"]').click();
    expect(await page.evaluate(() => (store.home().levels || {})['Squat (lichaamsgewicht)'])).toBeUndefined();
  });

  test('Alternatief: kies een niveau, de app wisselt meteen en vraagt alleen vandaag of voortaan', async ({ page }) => {
    await openHome(page, { equipment: ['geen', 'mat'], plan: ['Squat (lichaamsgewicht)', 'Plank'] });
    await open(page, 'Squat (lichaamsgewicht)');
    await openCard(page).locator('.hw-alt-btn').click();
    const chips = openCard(page).locator('.hw-alt-panel [data-alt]');
    await expect(chips).toHaveCount(4);
    await expect(openCard(page).locator('[data-alt="novice"]')).toBeEnabled();
    await expect(openCard(page).locator('[data-alt="advanced"]')).toBeDisabled();
    await openCard(page).locator('[data-alt="novice"]').click();
    await page.waitForTimeout(200);
    const plan = await page.evaluate(() => store.homeWorkout().plan);
    expect(plan[0]).not.toBe('Squat (lichaamsgewicht)');
    const lvl = await page.evaluate(n => ({ focus: exByName(n).focus, level: exLevel(exByName(n)), eq: exByName(n).equipment }), plan[0]);
    expect(lvl).toEqual({ focus: 'benen', level: 'novice', eq: lvl.eq });
    expect(['geen', 'mat']).toContain(lvl.eq);
    await expect(openCard(page).locator('.m-name')).toHaveText(plan[0]);
    await expect(page.locator('#modal-title')).toHaveText('Alleen vandaag of voortaan?');
    await expect(page.locator('#modal-confirm')).toHaveText('Voortaan');
    await expect(page.locator('#modal-cancel')).toHaveText('Alleen vandaag');
    await page.click('#modal-cancel');
    expect(await page.evaluate(() => store.home().swaps || {})).toEqual({});
    await expect(openCard(page).locator('.hw-swap-line')).toContainText('In plaats van Squat (lichaamsgewicht)');
    // terugzetten
    await openCard(page).locator('.hw-swap-undo').click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => store.homeWorkout().plan[0])).toBe('Squat (lichaamsgewicht)');
    // de modal heeft zijn gewone knoppen weer bij een volgende vraag
    await openCard(page).locator('.skip-btn').click();
    await page.evaluate(() => showModal('Test', 'test', () => {}));
    await expect(page.locator('#modal-confirm')).toHaveText('Bevestigen');
    await expect(page.locator('#modal-confirm')).toHaveClass(/warn/);
  });

  test('Voortaan: het origineel komt niet meer terug in nieuwe voorstellen', async ({ page }) => {
    await openHome(page, { equipment: ['geen', 'mat'], plan: ['Squat (lichaamsgewicht)', 'Plank'] });
    await open(page, 'Squat (lichaamsgewicht)');
    await openCard(page).locator('.hw-alt-btn').click();
    await openCard(page).locator('[data-alt="novice"]').click();
    await page.waitForTimeout(200);
    const repl = await page.evaluate(() => store.homeWorkout().plan[0]);
    await page.click('#modal-confirm');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => store.home().swaps)).toEqual({ 'Squat (lichaamsgewicht)': repl });
    await expect(openCard(page).locator('.hw-swap-line')).toContainText('voortaan');
    const seen = await page.evaluate(() => {
      const names = new Set();
      for (let salt = 1; salt <= 40; salt++) homeWorkoutPlan(salt).plan.forEach(s => names.add(s.name));
      return [...names];
    });
    expect(seen).not.toContain('Squat (lichaamsgewicht)');
    expect(seen).toContain(repl);
    // terugzetten haalt ook het "voortaan" weg
    await openCard(page).locator('.hw-swap-undo').click();
    expect(await page.evaluate(() => store.home().swaps)).toEqual({});
  });

  test('zonder passend alternatief zijn de niveauknoppen uit', async ({ page }) => {
    await openHome(page, { equipment: ['geen'], plan: ['Standing knee raise + twist'] });
    await open(page, 'Standing knee raise + twist');
    await openCard(page).locator('.hw-alt-btn').click();
    for (const l of ['novice', 'beginner', 'intermediate', 'advanced']) {
      await expect(openCard(page).locator(`[data-alt="${l}"]`)).toBeDisabled();
    }
  });
});

test.describe('Thuis-workout: warming-up', () => {
  test('0, 3 of 5 minuten, en die tijd gaat van je workout af', async ({ page }) => {
    await openHome(page);
    await open(page, 'Warming-up');
    await expect(openCard(page).locator('.hw-warm-item')).toHaveCount(6);
    await expect(card(page, 'Warming-up').locator('.m-sr')).toHaveText('3 min · 6×30s');
    await page.locator('[data-warm="5"]').click();
    await page.waitForTimeout(200);
    // de warming-up-kaart blijft open en heeft nu tien bewegingen
    await expect(openCard(page).locator('.hw-warm-item')).toHaveCount(10);
    await expect(card(page, 'Warming-up').locator('.m-sr')).toHaveText('5 min · 10×30s');
    const mins = await page.evaluate(() => ({ plan: hwPlanMinutes(store.homeWorkout()), total: store.home().workoutMin || 30 }));
    expect(mins.plan).toBeLessThanOrEqual(mins.total - 5);
    await page.locator('[data-warm="0"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#hw-plan .hw-warm')).toHaveCount(0);
    expect(await page.evaluate(() => store.homeWorkout().warmup)).toBeNull();
  });

  test('de mix hangt af van de oefeningen van die dag, en begint met je hartslag', async ({ page }) => {
    await openApp(page);
    const r = await page.evaluate(() => {
      const legs = SNACK_POOL.filter(s => s.focus === 'benen').slice(0, 6).map(s => s.name);
      const upper = SNACK_POOL.filter(s => s.focus === 'schouders/armen' || s.focus === 'rug').slice(0, 6).map(s => s.name);
      const count = (names, regions) => {
        let tot = 0, pulseFirst = true;
        for (let salt = 1; salt <= 30; salt++) {
          const wu = makeWarmup(names, 3, salt);
          if (!warmMoveByName(wu.moves[0]).pulse) pulseFirst = false;
          tot += wu.moves.filter(n => warmMoveByName(n).regions.some(x => regions.includes(x))).length;
        }
        return { avg: tot / 30, pulseFirst };
      };
      return {
        legsLeg: count(legs, ['benen', 'kuiten']), upperLeg: count(upper, ['benen', 'kuiten']),
        upperUp: count(upper, ['schouders/armen', 'rug']), legsUp: count(legs, ['schouders/armen', 'rug']),
      };
    });
    expect(r.legsLeg.pulseFirst && r.upperUp.pulseFirst).toBe(true);
    expect(r.legsLeg.avg).toBeGreaterThan(r.upperLeg.avg + 1);
    expect(r.upperUp.avg).toBeGreaterThan(r.legsUp.avg + 1);
  });

  test('alle bewegingen passen op twee vierkante meter: niets springt', async ({ page }) => {
    await openApp(page);
    const names = await page.evaluate(() => WARMUP_MOVES.map(m => m.name + ' ' + m.how));
    expect(names.length).toBeGreaterThanOrEqual(15);
    expect(names.filter(t => /spring|jump|hup/i.test(t) && !/geen sprong/i.test(t))).toEqual([]);
  });

  test('de timer loopt de bewegingen af en vinkt de warming-up af', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank'] });
    await open(page, 'Warming-up');
    await expect(openCard(page).locator('.hw-warm-time')).toHaveText('3:00');
    await openCard(page).locator('.hw-warm-start').click();
    // de echte klok stilzetten en zelf tikken: 30 tikken = volgende beweging
    await page.evaluate(() => { clearInterval(hwWarm.int); for (let i = 0; i < 30; i++) hwWarmTick(); });
    const moves = await page.evaluate(() => store.homeWorkout().warmup.moves);
    await expect(openCard(page).locator('.hw-warm-cur')).toHaveText(moves[1]);
    await expect(openCard(page).locator('.hw-warm-item').nth(1)).toHaveClass(/cur/);
    await expect(openCard(page).locator('.hw-warm-item').nth(0)).toHaveClass(/done/);
    await expect(openCard(page).locator('.hw-warm-start')).toContainText('Pauze');
    await page.evaluate(() => { for (let i = 0; i < 30 * 5; i++) hwWarmTick(); });
    await page.waitForTimeout(300);
    await expect(card(page, 'Warming-up')).toHaveClass(/done/);
    expect(await order(page)).toEqual(['Squat (lichaamsgewicht)', 'Plank', 'Warming-up']);
    expect(await page.evaluate(() => store.homeWorkout().warmup.done)).toBe(true);
  });

  test('een beweging wisselen kan voor vandaag of voortaan', async ({ page }) => {
    await openHome(page, { plan: ['Squat (lichaamsgewicht)', 'Plank'] });
    await open(page, 'Warming-up');
    const before = await page.evaluate(() => store.homeWorkout().warmup.moves.slice());
    await openCard(page).locator('[data-swap="2"]').click();
    const after = await page.evaluate(() => store.homeWorkout().warmup.moves.slice());
    expect(after[2]).not.toBe(before[2]);
    expect(after.filter((n, i) => i !== 2)).toEqual(before.filter((n, i) => i !== 2));
    await expect(page.locator('#modal-title')).toHaveText('Alleen vandaag of voortaan?');
    await page.click('#modal-confirm');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => store.home().warmSwaps)).toEqual({ [before[2]]: after[2] });
    await expect(openCard(page).locator('.hw-warm-item').nth(2)).toContainText('in plaats van ' + before[2]);
    const gone = await page.evaluate(old => {
      for (let salt = 1; salt <= 40; salt++) if (makeWarmup(['Plank', 'Squat (lichaamsgewicht)'], 5, salt).moves.includes(old)) return false;
      return true;
    }, before[2]);
    expect(gone).toBe(true);
  });

  test('geen glyphs en alles binnen 360 px met een open kaart', async ({ page }) => {
    await openHome(page, { plan: ['Goblet squat', 'Plank'] });
    await open(page, 'Warming-up');
    expect(await visibleGlyphs(page)).toEqual([]);
    await open(page, 'Goblet squat');
    await openCard(page).locator('.hw-alt-btn').click();
    await openCard(page).locator('.lvl-badge').click();
    expect(await visibleGlyphs(page)).toEqual([]);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w).toBeLessThanOrEqual(360);
  });
});
