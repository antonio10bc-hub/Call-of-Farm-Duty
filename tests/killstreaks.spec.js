// Pruebas de las rachas de bajas: granada, misil Predator, bombardero y bomba nuclear.
const { test, expect, enterBigField, shootNext, watchErrors } = require('./helpers');

test('racha: la barra sale al recoger, se vacía y a las 5 sale una granada que recoge lo de alrededor', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    await shootNext(page);
    await expect.poll(() => page.evaluate(() => game.sniper.streak)).toBeGreaterThan(0);
    await expect(page.locator('#streak')).toBeVisible();
    await expect(page.locator('#streak-next')).toContainText('GRANADA');
    // Si la barra se vacía, la racha se pierde
    await page.evaluate(() => { game.sniper.streakT = 0.01; });
    await expect.poll(() => page.evaluate(() => game.sniper.streak)).toBe(0);
    await expect(page.locator('#streak')).toBeHidden();
    // A las 5: granada (sola), que recoge lo que pilla al explotar
    const before = await page.evaluate(() => game.state.wheat);
    await page.evaluate(() => game.sniper.addStreak(5));
    await expect(page.locator('#medals')).toContainText('GRANADA');
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 5_000 }).toBeGreaterThan(before);
    expect(errors).toEqual([]);
});

test('racha de 10: misil Predator con vista cenital, se guía y se acelera, y explota recogiendo', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    await page.evaluate(() => game.sniper.addStreak(10));
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.predator)).toBe(true);
    await expect(page.locator('#predator-hud')).toBeVisible();
    // Mirando hacia abajo desde lo alto; mover la vista mueve el misil y el gatillo lo acelera
    await expect.poll(() => page.evaluate(() => game.sniper.camera.position.y)).toBeGreaterThan(20);
    const x0 = await page.evaluate(() => game.sniper.ks.predator.x + game.sniper.ks.predator.z);
    await page.keyboard.down('d');
    await expect.poll(() => page.evaluate((x0) => Math.abs(game.sniper.ks.predator.x + game.sniper.ks.predator.z - x0) > 0.05, x0)).toBe(true);
    await page.keyboard.up('d');
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => game.sniper.ks.predator.boost)).toBe(true);
    // Mientras se guía, la racha no se pierde
    expect(await page.evaluate(() => game.sniper.ks.paused)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.ks.predator), { timeout: 10_000 }).toBe(null);
    await expect(page.locator('#predator-hud')).toBeHidden();
    expect(await page.evaluate(() => game.state.wheat)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});

test('rachas de 20 y 30: bombardero que bombardea el campo y bomba nuclear que lo recoge todo', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page, ['bomber', 'nuke']);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    await page.evaluate(() => game.sniper.addStreak(20));
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.plane)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.ks.bombs.length > 0), { timeout: 8_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => !game.sniper.ks.plane), { timeout: 25_000 }).toBe(true); // en el campo grande el avión tarda más en cruzar
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 5_000 }).toBeGreaterThan(0);
    // Nuclear: cuenta atrás de 5 y lo que quede, recogido (las bombas pueden haber llevado ya
    // la racha a 30 por su cuenta)
    await page.evaluate(() => { const s = game.sniper; if (!s.ks.nuke) s.addStreak(Math.max(1, 30 - s.streak)); });
    await expect(page.locator('#nuke-count')).toBeVisible();
    await expect(page.locator('#nuke-n')).toHaveText(/^[1-5]$/);
    // (con el render por software de las pruebas el campo grande va a pocos fotogramas: más margen)
    await expect.poll(() => page.evaluate(() => game.sniper.field.remaining), { timeout: 40_000 }).toBe(0);
    await expect(page.locator('#nuke-haze')).toHaveCSS('opacity', '1', { timeout: 5_000 }); // neblina radiactiva
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 15_000 }).toBe('farm');
    expect(await page.evaluate(() => game.state.wheat)).toBe(total);
    expect(errors).toEqual([]);
});
