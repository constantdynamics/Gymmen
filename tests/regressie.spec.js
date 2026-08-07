const { test, expect } = require('@playwright/test');
const { VIEWS, openApp, seedHistory, goto } = require('./helpers');

/* ============================================================
   Regressie — de werking mag niet veranderen door de restyling
   ============================================================ */

test('onboarding laadt het standaardschema met twaalf onderdelen', async ({ page }) => {
  const errors = await openApp(page);
  const n = await page.evaluate(() => store.machines().length);
  expect(n).toBe(12);
  await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-home');
  expect(errors).toEqual([]);
});

test('sessie starten, gewicht opslaan en afronden geeft het samenvattingsbord', async ({ page }) => {
  await openApp(page);
  await page.click('#enter-gym');
  await expect(page.locator('.view.active')).toHaveAttribute('id', 'view-session');
  await expect(page.locator('.machine-card')).toHaveCount(12);

  await page.locator('.mc-header').nth(1).click();
  await page.waitForTimeout(250);
  await page.locator('[data-act="inc"]').first().click();
  const w = await page.locator('.weight-display').first().inputValue();
  await page.locator('.done-btn').first().click();
  await page.waitForTimeout(400);

  await expect(page.locator('.machine-card.done')).toHaveCount(1);
  await expect(page.locator('#sess-progress')).toContainText('1 / 12');

  await page.click('#finish-session');
  await page.waitForTimeout(1300);
  await expect(page.locator('#summary-modal.show')).toHaveCount(1);
  await expect(page.locator('.ss-kg')).toContainText(String(Math.round(parseFloat(w))));
  // de sessie is opgeslagen
  expect(await page.evaluate(() => store.sessions().length)).toBe(1);
});

test('overslaan en terugzetten werkt', async ({ page }) => {
  await openApp(page);
  await page.click('#enter-gym');
  await page.locator('.mc-header').nth(1).click();
  await page.waitForTimeout(250);
  await page.locator('.skip-btn').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('.machine-card.skipped')).toHaveCount(1);
  await expect(page.locator('#sess-progress')).toContainText('overgeslagen');

  await page.locator('.machine-card.skipped .mc-header').click();
  await page.waitForTimeout(250);
  await page.locator('.skip-btn').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('.machine-card.skipped')).toHaveCount(0);
});

test('afgeronde oefening kan weer worden geopend', async ({ page }) => {
  await openApp(page);
  await page.click('#enter-gym');
  await page.locator('.mc-header').nth(1).click();
  await page.locator('.done-btn').first().click();
  await page.waitForTimeout(400);
  await page.locator('.machine-card.done .mc-header').click();
  await page.waitForTimeout(250);
  await page.locator('.undo-btn').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('.machine-card.done')).toHaveCount(0);
});

test('sets aftikken houdt de voortgang bij', async ({ page }) => {
  await openApp(page);
  await page.click('#enter-gym');
  await page.locator('.mc-header').nth(1).click();
  await page.waitForTimeout(250);
  // sets & reps staat standaard ingeklapt — eerst openzetten, dan pas aftikken
  const det = page.locator('.machine-card.open details', { has: page.locator('.set-track') });
  expect(await det.evaluate(el => el.open)).toBe(false);
  await det.locator('summary').click();
  await page.waitForTimeout(200);
  const dots = page.locator('.machine-card.open .set-dot');
  expect(await dots.count()).toBeGreaterThan(0);
  await dots.first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('.machine-card.open .set-dot.done')).toHaveCount(1);
});

test('thuis-workout: voorstel genereren en een oefening afvinken', async ({ page }) => {
  await openApp(page);
  await goto(page, 'homeworkout');
  const cards = page.locator('.snack-card');
  expect(await cards.count()).toBeGreaterThan(0);
  await page.locator('.hw-check').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('.snack-card.hw-done')).toHaveCount(1);
  await expect(page.locator('.hw-summary')).toContainText('1 van');
});

test('thuis-workout: ander voorstel geeft een ander programma', async ({ page }) => {
  await openApp(page);
  await goto(page, 'homeworkout');
  const before = await page.evaluate(() => (store.homeWorkout() || {}).plan);
  await page.click('#hw-regen');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (store.homeWorkout() || {}).plan);
  expect(after).not.toEqual(before);
});

test('reeks-speler loopt de oefeningen af', async ({ page }) => {
  await openApp(page);
  await goto(page, 'homeworkout');
  await page.click('#hw-play');
  await page.waitForTimeout(500);
  await expect(page.locator('#hwp-done')).toHaveCount(1);
  await page.click('#hwp-done');
  await page.waitForTimeout(500);
  // speler blijft staan en is naar de volgende oefening geschoven
  await expect(page.locator('#hwp-done')).toHaveCount(1);
  await page.click('#hwp-stop');
  await page.waitForTimeout(400);
  await expect(page.locator('.snack-card').first()).toBeVisible();
});

test('sterrenwinkel: saldo loopt op na een afgeronde sessie', async ({ page }) => {
  await openApp(page);
  await goto(page, 'shop');
  await expect(page.locator('.shop-balance .sb-num')).toContainText('0');

  await goto(page, 'home');
  await page.click('#enter-gym');
  await page.locator('.mc-header').nth(1).click();
  await page.locator('.done-btn').first().click();
  await page.waitForTimeout(300);
  await page.click('#finish-session');
  await page.waitForTimeout(1300);
  await page.click('#summary-close');
  await page.waitForTimeout(400);

  await goto(page, 'shop');
  await expect(page.locator('.shop-balance .sb-num')).toContainText('1');
});

test('sterrenwinkel: item toevoegen, aanpassen en verwijderen', async ({ page }) => {
  await openApp(page);
  await goto(page, 'shop');
  const before = await page.locator('.shop-item').count();
  await page.fill('#shop-new-name', 'Nieuwe koptelefoon');
  await page.fill('#shop-new-price', '22');
  await page.click('#shop-add');
  await page.waitForTimeout(400);
  await expect(page.locator('.shop-item')).toHaveCount(before + 1);
  const item = page.locator('.shop-item', { hasText: 'Nieuwe koptelefoon' });
  await expect(item.locator('.si-price')).toContainText('22');

  await item.locator('.shop-edit').click();
  await page.waitForTimeout(300);
  const item2 = page.locator('.shop-item', { hasText: 'Nieuwe koptelefoon' });
  await item2.locator('.se-price').fill('7');
  await item2.locator('.shop-save').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.shop-item', { hasText: 'Nieuwe koptelefoon' }).locator('.si-price')).toContainText('7');

  await page.locator('.shop-item', { hasText: 'Nieuwe koptelefoon' }).locator('.shop-del').click();
  await page.click('#modal-confirm');
  await page.waitForTimeout(300);
  await expect(page.locator('.shop-item')).toHaveCount(before);
});

test('sterrenwinkel: kopen trekt de prijs van je saldo af', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { const v = store.incentives(); v.stars = 12; store.setIncentives(v); });
  await goto(page, 'shop');
  const item = page.locator('.shop-item.can').first();
  const name = await item.locator('.si-name').innerText();
  const price = parseInt((await item.locator('.si-price').innerText()).replace(/\D/g, ''));
  await item.locator('.shop-buy').click();
  await page.click('#modal-confirm');
  await page.waitForTimeout(400);
  const stars = await page.evaluate(() => store.incentives().stars);
  expect(stars).toBe(12 - price);
  await expect(page.locator('.shop-item', { hasText: name })).toHaveCount(0);
  await expect(page.locator('#shop-content')).toContainText('Gekocht (1)');
});

test('sterrenwinkel: te duur item kan niet gekocht worden', async ({ page }) => {
  await openApp(page);
  await goto(page, 'shop');
  const pricey = page.locator('.shop-item:not(.can)').first();
  await expect(pricey.locator('.shop-buy')).toBeDisabled();
});

test('calf raises: poging opslaan en PR bijwerken', async ({ page }) => {
  await openApp(page);
  await goto(page, 'thuis');
  for (let i = 0; i < 5; i++) await page.click('#calf-inc');
  await page.waitForTimeout(250);
  await expect(page.locator('#calf-box .cr-num')).toHaveText('5');
  await page.click('#calf-save');
  await page.waitForTimeout(500);
  const saved = await page.evaluate(() => store.calf());
  expect(saved.length).toBe(1);
  expect(saved[0].reps).toBe(5);
  await expect(page.locator('#calf-box .cr-num')).toHaveText('0');
});

test('statistieken: gym- en thuis-scope met eigen grafiek', async ({ page }) => {
  await openApp(page);
  await seedHistory(page);
  await goto(page, 'stats');
  await expect(page.locator('#stat-total-title')).toHaveText('Totale voortgang');
  expect(await page.locator('.wave-bar').count()).toBe(5);

  await page.locator('#stat-scope button[data-scope="thuis"]').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => statScope)).toBe('thuis');
  expect(await page.locator('.wave-bar').count()).toBe(3);
  await expect(page.locator('#stat-per-title')).toHaveText('Voortgang per oefening');

  await page.locator('#stat-scope button[data-scope="gym"]').click();
  await page.waitForTimeout(500);
  expect(await page.locator('.wave-bar').count()).toBe(5);
});

test('periodefilters schakelen de dataset', async ({ page }) => {
  await openApp(page);
  await seedHistory(page);
  await goto(page, 'stats');
  await page.locator('#stat-filters button[data-range="week"]').click();
  await page.waitForTimeout(400);
  const week = await page.locator('.wave-bar').count();
  await page.locator('#stat-filters button[data-range="3month"]').click();
  await page.waitForTimeout(400);
  const kwartaal = await page.locator('.wave-bar').count();
  expect(kwartaal).toBeGreaterThanOrEqual(week);
});

test('meenemen-checklist vinkt aan en reset', async ({ page }) => {
  await openApp(page);
  await goto(page, 'checklist');
  const items = page.locator('.check-item');
  expect(await items.count()).toBeGreaterThan(0);
  await items.first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('.check-item.checked')).toHaveCount(1);
  await page.click('#reset-checklist');
  await page.waitForTimeout(400);
  await expect(page.locator('.check-item.checked')).toHaveCount(0);
});

test('doel aanmaken en terugzien op home', async ({ page }) => {
  await openApp(page);
  await goto(page, 'goals');
  await page.click('#goal-add-toggle');
  await page.waitForTimeout(300);
  await page.fill('#gf-title', 'Sterker linkerbeen');
  await page.click('#gf-save');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => store.goals().length)).toBe(1);
  await goto(page, 'home');
  await expect(page.locator('#home-goals')).toContainText('Sterker linkerbeen');
});

test('thema wisselen zet data-theme en de tokens', async ({ page }) => {
  await openApp(page);
  await goto(page, 'settings');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await page.locator('.swatch').nth(1).click();
  await page.waitForTimeout(400);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(theme).not.toBe('Synthwave');
  await page.locator('.swatch').first().click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('Synthwave');
  expect(await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe('#08040d');
});

test('apparaten beheren blijft werken', async ({ page }) => {
  await openApp(page);
  await goto(page, 'settings');
  await expect(page.locator('.machine-row')).toHaveCount(12);
  await page.click('#load-preset-settings');
  await page.waitForTimeout(400);
  await expect(page.locator('.machine-row')).toHaveCount(12);
});

test('door de hele app klikken geeft geen JS-fouten', async ({ page }) => {
  const errors = await openApp(page);
  for (const v of VIEWS) await goto(page, v);
  await goto(page, 'home');
  await page.click('#enter-gym');
  await page.locator('.mc-header').nth(1).click();
  await page.waitForTimeout(300);
  expect(errors, errors.join(' ; ')).toEqual([]);
});
