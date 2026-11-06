// El orden de la progresión (con ?progress; las demás pruebas la tienen abierta): el granero nada
// más empezar, el trigo, las rachas de granadas (trigo nv.2), los tomates (trigo al máximo), la
// racha alienígena (tomates nv.2) y, con los tomates al máximo, el mercader y la tienda de la casa.
const { test, expect, watchErrors } = require('./helpers');

test('progresión: granero, trigo, granadas, tomates, alienígenas, mercader y tienda', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test&progress');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2.2), { timeout: 60_000 }).toBe(true);
    const gates = () => page.evaluate(() => ['barn', 'grenades', 'aliens', 'merchant', 'shop'].map((g) => game.state.open(g)));
    expect(await gates()).toEqual([false, false, false, false, false]);
    // Sin granero no se limpia el trigo; su cartel lo abre
    expect(await page.evaluate(() => [game.state.canUnlock('wheat'), game.farm.byId.barn.root.visible])).toEqual([false, false]);
    await expect(page.locator('#sign-barn')).toContainText('GRANERO');
    await page.locator('#sign-barn').click();
    expect(await page.evaluate(() => [game.state.open('barn'), game.state.canUnlock('wheat'), game.farm.byId.barn.root.visible])).toEqual([true, true, true]);
    // Trigo a nivel 2: rachas de granadas (con su cartel)
    await page.evaluate(() => { game.state.unlock('wheat'); game.state.fields.wheat.level = 1; game.updateCounts(); });
    expect(await gates()).toEqual([true, true, false, false, false]);
    await expect(page.locator('#stage')).toContainText('RACHAS DE GRANADAS');
    // Tomates a nivel 2: racha alienígena; al máximo, el mercader y la tienda
    await page.evaluate(() => { const S = game.state; S.fields.wheat.level = 4; S.unlock('tomato'); S.fields.tomato.level = 1; game.updateCounts(); });
    expect(await gates()).toEqual([true, true, true, false, false]);
    expect(await page.evaluate(() => game.merchantClock.locked)).toBe(true);
    await page.evaluate(() => { game.state.fields.tomato.level = 4; game.updateCounts(); });
    expect(await gates()).toEqual([true, true, true, true, true]);
    expect(await page.evaluate(() => game.merchantClock.locked)).toBe(false);
    await expect(page.locator('#sign-ufo')).toBeVisible();
    expect(errors).toEqual([]);
});
