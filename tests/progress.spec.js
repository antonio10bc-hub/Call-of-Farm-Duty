// El orden de la progresión (con ?progress; las demás pruebas la tienen abierta): el granero (con
// todo su recinto) nada más empezar; el trigo; el trigo mágico regala las rachas de cultivos (trigo
// nv.2), las alienígenas (nv.3) y la caja sorpresa (al máximo); con los tomates al máximo llama el
// mercader y viene; tras la primera venta, el trigo mágico abre la casa y las parcelas a la venta.
const { test, expect, watchErrors } = require('./helpers');

// Lo que dice el trigo mágico, línea a línea, hasta que se va
async function listen(page) {
    await expect.poll(() => page.evaluate(() => !!game.prologue.talking), { timeout: 20_000 }).toBe(true);
    await expect.poll(async () => {
        await page.evaluate(() => game.prologue.talking && game.prologue.next());
        return page.evaluate(() => !game.prologue.active);
    }, { timeout: 30_000, intervals: [150] }).toBe(true);
}

test('progresión: granero, trigo, regalos del trigo mágico, mercader, casa y parcelas', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test&progress');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2.6), { timeout: 60_000 }).toBe(true);
    const gates = () => page.evaluate(() => ['barn', 'grenades', 'aliens', 'box', 'merchant', 'house', 'lands'].map((g) => game.state.open(g)));
    expect(await gates()).toEqual([false, false, false, false, false, false, false]);
    // Todo bloqueado: la casa y las parcelas (también las que se compran), con su candado; solo la
    // primera clase
    await expect(page.locator('#sign-house')).toBeHidden(); // (la casa, aparcada)
    await expect(page.locator('#sign-truffle')).toHaveClass(/locked/);
    await expect(page.locator('#sign-pumpkin')).toHaveClass(/locked/);
    await expect(page.locator('#sign-land-se')).toHaveClass(/locked/);
    expect(await page.evaluate(() => [0, 1, 2, 3, 4].map((i) => game.state.classOpen(i)))).toEqual([true, false, false, false, false]);
    // Sin granero no se limpia el trigo; su cartel lo abre (y con él sale todo su recinto)
    expect(await page.evaluate(() => [game.state.canUnlock('wheat'), game.farm.byId.barn.root.visible, game.farm.compoundOn])).toEqual([false, false, false]);
    await page.locator('#sign-barn').click();
    expect(await page.evaluate(() => [game.state.open('barn'), game.state.canUnlock('wheat'), game.farm.byId.barn.root.visible, game.farm.compoundOn])).toEqual([true, true, true, true]);
    // Las rachas del armamento, bloqueadas; las clases se desbloquean con oro (Esc cierra)
    await page.evaluate(() => game.select({ structure: 'barn' }));
    await expect(page.locator('.lo-sec-crop')).toHaveClass(/locked/);
    await page.locator('#class-1').click();
    expect(await page.evaluate(() => game.state.classOpen(1))).toBe(false);
    await page.evaluate(() => { game.state.items.gold = 12; });
    await page.locator('#class-1').click();
    expect(await page.evaluate(() => [game.state.classOpen(1), game.state.items.gold])).toEqual([true, 2]);
    await page.keyboard.press('Escape');
    await expect(page.locator('#streaks')).toBeHidden();
    // Trigo nv.1: sin alienígenas ni caja
    await page.evaluate(() => { game.state.unlock('wheat', Date.now(), true); while (game.revealUnlocked()); game.updateCounts(); });
    // Nv.2: el trigo mágico regala las rachas de cultivos
    await page.evaluate(() => { game.state.fields.wheat.level = 1; game.updateCounts(); });
    await listen(page);
    expect(await gates()).toEqual([true, true, false, false, false, false, false]);
    // Nv.3: las alienígenas (y desde ya vienen alienígenas a pie)
    await page.evaluate(() => { game.state.fields.wheat.level = 2; game.updateCounts(); });
    await listen(page);
    expect(await gates()).toEqual([true, true, true, false, false, false, false]);
    // Al máximo: la caja sorpresa
    await page.evaluate(() => { game.state.fields.wheat.level = 4; game.updateCounts(); });
    await listen(page);
    expect(await gates()).toEqual([true, true, true, true, false, false, false]);
    // Tomates al máximo: llama el mercader; al colgar, viene
    await page.evaluate(() => { game.state.unlock('tomato', Date.now(), true); while (game.revealUnlocked()); game.state.fields.tomato.level = 4; game.updateCounts(); });
    await expect(page.locator('#call')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#call-btn')).toHaveText('CONTESTAR');
    for (let i = 0; i < 5; i++) await page.locator('#call-btn').click();
    await expect(page.locator('#call')).toBeHidden();
    expect(await gates()).toEqual([true, true, true, true, true, false, false]);
    await expect.poll(() => page.evaluate(() => game.farm.village.byId.m0.open), { timeout: 20_000 }).toBe(true);
    // La primera venta: el trigo mágico abre la casa y las parcelas, a la venta (con su precio)
    await page.evaluate(() => { const S = game.state; S.items.wheat = S.items.tomato = 9999; S.deliver(game.merchantClock.visit, 0); game.updateCounts(); });
    await listen(page);
    expect(await gates()).toEqual([true, true, true, true, true, true, true]);
    await expect(page.locator('#sign-truffle')).toHaveClass(/for-sale/); // (la pocilga, donde estaba la casa)
    await expect(page.locator('#sign-pumpkin')).toHaveClass(/for-sale/);
    await expect(page.locator('#sign-land-se')).toHaveClass(/locked/); // (las de PRONTO, aún no)
    // Se guarda
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && JSON.stringify(game.state.story))).toBe(JSON.stringify({ crop: true, alien: true, box: true, merchant: true, sold: true, house: true }));
    expect(errors).toEqual([]);
});
