// Pruebas de el menú DEBUG y borrar el progreso.
const { test, expect, enterField, openFarm, shootNext, watchErrors } = require('./helpers');

test('ajustes: borrar el progreso pide confirmación y deja la granja como al empezar', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(1, { timeout: 30_000 });
    await page.evaluate(() => { game.state.wheat = 7; game.upgradeField('wheat'); });
    expect(await page.evaluate(() => [game.state.fields.wheat.level, game.state.wheat])).toEqual([1, 4]);
    await page.locator('#btn-debug').click();
    // El primer toque solo arma el botón (hay 3 s para el segundo: los dos van seguidos en la
    // página, que con la máquina cargada el ir y venir de la prueba puede tardar más)
    const armed = await page.evaluate(() => {
        const b = document.getElementById('btn-reset');
        b.click();
        return [b.textContent, game.state.fields.wheat.level];
    });
    expect(armed).toEqual(['¿SEGURO? TOCA OTRA VEZ', 1]);
    // El segundo toque borra y recarga la página: se espera a la recarga
    await Promise.all([page.waitForEvent('load'), page.evaluate(() => document.getElementById('btn-reset').click())]);
    await expect.poll(() => page.evaluate(() => window.game && [game.state.fields.wheat.level, game.state.wheat])).toEqual([0, 0]);
    expect(errors).toEqual([]);
});

test('debug: con COSTES 0 se mejora sin gastar nada', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await page.evaluate(() => game.select({ field: 'wheat' }));
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.locator('#btn-debug').click();
    await page.locator('#toggle-free').click();
    await expect(page.locator('#toggle-free')).not.toHaveClass(/off/);
    await page.locator('#btn-debug-close').click();
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await expect(page.locator('#upgrade-cost')).toHaveText('0');
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => [game.state.fields.wheat.level, game.state.wheat])).toEqual([1, 0]);
    // Se recuerda al recargar
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.freeCosts)).toBe(true);
    expect(errors).toEqual([]);
});

test('debug: se elige cuántas bajas pide cada racha', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    await page.locator('#btn-debug').click();
    // La de fragmentación, de 5 a 1 bajas (cuatro veces -)
    const row = (id) => page.locator('.ks-row', { has: page.locator(`#ks-${id}`) });
    await expect(page.locator('#ks-frag')).toHaveText('5');
    for (let i = 0; i < 4; i++) await row('frag').locator('[data-d="-1"]').click();
    await expect(page.locator('#ks-frag')).toHaveText('1');
    await row('frag').locator('[data-d="-1"]').click();
    await expect(page.locator('#ks-frag')).toHaveText('1'); // nunca menos de 1
    await row('nuke').locator('[data-d="1"]').click();
    await expect(page.locator('#ks-nuke')).toHaveText('11');
    await page.locator('#btn-debug-close').click();
    // Con una sola baja ya sale la granada de fragmentación
    await page.evaluate(() => game.harvest('wheat'));
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; game.sniper.walkers.reset(); game.sniper.walkers.next = Infinity; }); // sin ovnis pequeños ni alienígenas a pie de por medio
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('#as-nuke b')).toHaveText('11'); // la racha alienígena, con el número nuevo
    await shootNext(page);
    await expect(page.locator('#medals')).toContainText('FRAGMENTACIÓN');
    // Se recuerda al recargar, y RACHAS POR DEFECTO lo devuelve todo a su sitio
    await page.reload();
    await expect(page.locator('#ks-frag')).toHaveText('1');
    await page.locator('#btn-debug').click();
    await page.locator('#ks-default').click();
    await expect(page.locator('#ks-frag')).toHaveText('5');
    await expect(page.locator('#ks-nuke')).toHaveText('10');
    expect(errors).toEqual([]);
});

test('debug: DESBLOQUEAR TODO limpia todos los terrenos sin requisitos', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toHaveText('¡DESBLOQUEAR!', { timeout: 30_000 });
    await expect(page.locator('#sign-tomato')).toHaveText('BLOQUEADO');
    await page.locator('#btn-debug').click();
    await page.locator('#btn-unlock-all').click();
    await expect(page.locator('#debug')).toBeHidden();
    expect(await page.evaluate(() => [game.state.fields.wheat.unlocked, game.state.fields.tomato.unlocked])).toEqual([true, true]);
    expect(await page.evaluate(() => [game.farm.fields.wheat.locked, game.farm.fields.tomato.locked])).toEqual([false, false]);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1');
    await expect(page.locator('#sign-tomato')).toHaveText('NV.1');
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(4); // trigo, tomates, calabazas y maíz
    expect(await page.evaluate(() => game.state.lands)).toEqual({ west: true, east: true });
    await expect(page.locator('#farm-tomato')).toBeVisible();
    expect(errors).toEqual([]);
});

test('debug: desbloquear de uno en uno los terrenos y la armería', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toHaveText('¡DESBLOQUEAR!', { timeout: 30_000 });
    await page.locator('#btn-debug').click();
    // Solo los tomates: el trigo sigue con su chatarra
    await expect(page.locator('#unlock-field-tomato')).toHaveText('DESBLOQUEAR');
    await page.locator('#unlock-field-tomato').click();
    await expect(page.locator('#debug')).toBeHidden();
    expect(await page.evaluate(() => [game.state.fields.tomato.unlocked, game.farm.fields.tomato.locked, game.state.fields.wheat.unlocked])).toEqual([true, false, false]);
    await expect(page.locator('#sign-tomato')).toHaveText('NV.1');
    await expect(page.locator('#sign-wheat')).toHaveText('¡DESBLOQUEAR!');
    // Toda la armería
    await page.locator('#btn-debug').click();
    await expect(page.locator('#unlock-field-tomato')).toHaveText('YA');
    await page.locator('#unlock-arsenal').click();
    await expect(page.locator('#unlock-arsenal')).toHaveText('YA');
    // Se guarda
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && [game.state.fields.tomato.unlocked, game.state.ownsGear('rifle', 'alien')])).toEqual([true, true]);
    expect(errors).toEqual([]);
});

test('debug de la casa: costes 0, nivel, monedas, el ovni y la tienda entera', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 0), { timeout: 30_000 }).toBe(true);
    await page.locator('#btn-debug').click();
    await expect(page.locator('#debug-home')).toBeVisible();
    // Costes 0 solo para la casa y la tienda (los campos siguen costando)
    await page.locator('#toggle-free-home').click();
    expect(await page.evaluate(() => [game.state.freeHome, game.state.freeCosts, Object.values(game.state.houseCost()).every((n) => n === 0), game.state.cost('wheat').wheat > 0])).toEqual([true, false, true, true]);
    // Nivel de la casa con +
    await expect(page.locator('#home-level')).toHaveText('0');
    await page.locator('#home-level-row [data-d="1"]').click();
    await expect(page.locator('#home-level')).toHaveText('1');
    expect(await page.evaluate(() => [game.state.house.level, game.farm.byId.house.whole.visible])).toEqual([1, true]);
    // Toda la tienda comprada y lo de la parcela puesto (y la casa al máximo)
    await page.locator('#btn-home-all').click();
    await expect(page.locator('#debug')).toBeHidden();
    expect(await page.evaluate(() => [game.state.home.placed.length, game.state.house.level])).toEqual([40, 3]);
    await expect(page.locator('#sign-ufo')).toBeVisible();
    // Casa de serie: la parcela vacía
    await page.locator('#btn-debug').click();
    await page.locator('#btn-home-reset').click();
    expect(await page.evaluate(() => [game.state.home.placed.length, game.state.home.owned.length])).toEqual([0, 0]);
    // Bajar de nivel recarga y vuelve a abrir el debug
    await Promise.all([page.waitForEvent('load'), page.locator('#home-level-row [data-d="-1"]').click()]);
    await expect(page.locator('#debug')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#home-level')).toHaveText('2');
    expect(await page.evaluate(() => [game.state.house.level, game.state.freeHome])).toEqual([2, true]);
    expect(errors).toEqual([]);
});
