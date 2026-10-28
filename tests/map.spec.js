// Pruebas de el mapa de la granja: granero y sus niveles, mejorar campos, la casa y las partidas guardadas.
const { test, expect, openFarm, screenOf, watchErrors } = require('./helpers');

test('la granja es un mapa: el granero sube de nivel, agranda su recinto y desbloquea rachas', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#wheat-count')).toHaveText('0');
    const p = await screenOf(page, 'map', 15, 1.4, 11);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#streaks')).toBeVisible();
    // Sin mejorar: todas las rachas bloqueadas y la mejora pide trigo
    await expect(page.locator('#barn-level')).toHaveText('GRANERO NV.0/5');
    await expect(page.locator('#barn-next')).toContainText('GRANADA');
    for (const id of ['grenade', 'predator', 'bomber', 'nuke']) await expect(page.locator(`#ks-card-${id}`)).toHaveClass(/locked/);
    await expect(page.locator('#barn-upgrade')).toBeDisabled();
    await page.locator('#ks-card-grenade').click();
    await expect(page.locator('#ks-pick-info')).toContainText('NV.1');
    // Con 5 de trigo: nivel 1, la granada se desbloquea y se equipa sola; el recinto crece
    const hidden0 = await page.evaluate(() => game.farm.wild.reduce((n, e) => n + e.positions.filter((q) => q.hide).length, 0));
    await page.evaluate(() => { game.state.wheat = 5; game.select({ structure: 'barn' }); });
    await expect(page.locator('#barn-upgrade')).toBeEnabled();
    await page.locator('#barn-upgrade').click();
    await expect(page.locator('#streaks')).toBeHidden();
    expect(await page.evaluate(() => [game.state.barn.level, game.farm.barnLevel, game.state.wheat, game.state.activeStreaks])).toEqual([1, 1, 0, ['grenade']]);
    expect(await page.evaluate(() => game.farm.wild.reduce((n, e) => n + e.positions.filter((q) => q.hide).length, 0))).toBeGreaterThan(hidden0);
    // Los niveles 4 y 5 piden también tomates; el 5 da un hueco más (3 rachas a la vez)
    await page.evaluate(() => { game.state.items.wheat = 1000; game.state.items.tomato = 0; for (let i = 0; i < 3; i++) game.upgradeBarn(); });
    expect(await page.evaluate(() => [game.state.barn.level, game.state.canUpgradeBarn])).toEqual([3, false]);
    await page.evaluate(() => { game.state.items.tomato = 1000; game.upgradeBarn(); game.upgradeBarn(); game.select({ structure: 'barn' }); });
    expect(await page.evaluate(() => [game.state.barn.level, game.state.slots])).toEqual([5, 3]);
    await expect(page.locator('#barn-upgrade')).toBeHidden();
    await expect(page.locator('#barn-next')).toHaveText('NIVEL MÁXIMO');
    await page.locator('#ks-card-nuke').click();
    await expect(page.locator('#ks-pick-info')).toContainText('3/3');
    await page.locator('#ks-card-bomber').click();
    await expect(page.locator('#ks-card-bomber')).not.toHaveClass(/on/); // no cabe una cuarta
    await page.locator('#btn-streaks-close').click();
    await expect(page.locator('#streaks')).toBeHidden();
    // El cartel ARMAMENTO encima del granero también abre el menú
    await expect(page.locator('#sign-barn')).toHaveText('ARMAMENTO');
    await page.locator('#sign-barn').click();
    await expect(page.locator('#streaks')).toBeVisible();
    await page.locator('#btn-streaks-close').click();
    // Arrastrar desplaza el mapa (desde un trozo libre, sin carteles encima)
    const before = await page.evaluate(() => game.rig.fx + game.rig.fz);
    await page.mouse.move(300, 680);
    await page.mouse.down();
    await page.mouse.move(220, 580, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => game.rig.fx + game.rig.fz)).not.toBeCloseTo(before, 1);
    expect(errors).toEqual([]);
});

test('mejorar el campo: cuesta 3 de trigo, lo hace más grande y con más matas', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(1, { timeout: 30_000 });
    const before = await page.evaluate(() => ({ w: game.farm.fields.wheat.rect.w, d: game.farm.fields.wheat.rect.d, left: game.state.fields.wheat.left, stalks: game.farm.fields.wheat.plants.length }));
    // El cartel flotante dice el nivel y al tocarlo abre la ficha del campo
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1');
    await page.locator('#sign-wheat').click();
    await expect(page.locator('#panel-title')).toHaveText('CAMPO DE TRIGO NV.1');
    // Sin trigo suficiente no se puede mejorar
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.evaluate(() => { game.state.wheat = 4; });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => game.state.fields.wheat.level)).toBe(1);
    expect(await page.evaluate(() => game.state.wheat)).toBe(1);
    const after = await page.evaluate(() => ({ w: game.farm.fields.wheat.rect.w, d: game.farm.fields.wheat.rect.d, left: game.state.fields.wheat.left, stalks: game.farm.fields.wheat.plants.length }));
    expect(after.w * after.d).toBeGreaterThan(before.w * before.d);
    expect(after.stalks).toBeGreaterThan(before.stalks);
    expect(after.left).toBeGreaterThan(before.left);
    await expect(page.locator('#panel-title')).toHaveText('CAMPO DE TRIGO NV.2');
    await expect(page.locator('#sign-wheat')).toHaveText('NV.2');
    // En el campo de tiro salen todas las matas del nivel nuevo
    await page.locator('.bubble:not(.hidden)').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBe(after.left);
    // Se guarda: al recargar sigue en el nivel 2
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.fields.wheat.level)).toBe(1);
    expect(errors).toEqual([]);
});

test('partida guardada con las cifras de antes: los campos salen con los blancos de su nivel', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    // Trigo en nivel 5 maduro con las 32 matas de antes y tomates en nivel 3 creciendo con 11
    await page.addInitScript(() => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('cofd.farm.v4', JSON.stringify({ items: { wheat: 50, tomato: 0 }, fields: { wheat: { unlocked: true, level: 4, plantedAt: 0, left: 32 }, tomato: { unlocked: true, level: 2, plantedAt: Date.now(), left: 11 } }, streaks: ['grenade'] }));
    });
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && [game.state.fields.wheat.left, game.state.fields.tomato.left]), { timeout: 30_000 }).toEqual([80, 22]);
    // Ya guardada con la revisión nueva: lo que se haya empezado a recoger se respeta
    await page.evaluate(() => { game.state.collect('wheat'); });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.fields.wheat.left), { timeout: 30_000 }).toBe(79);
    expect(errors).toEqual([]);
});

test('casa: empieza en ruinas con la parcela sucia; 3 niveles la arreglan y limpian la parcela', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2)).toBe(true);
    expect(await page.evaluate(() => [game.state.house.level, game.farm.byId.house.ruin.visible, game.farm.byId.house.whole.visible])).toEqual([0, true, false]);
    const wildHidden = () => page.evaluate(() => game.farm.wild.reduce((n, e) => n + e.positions.filter((q) => q.hide).length, 0));
    const before = await wildHidden();
    // (desde la vista de inicio la casa queda fuera de la pantalla del móvil: su ficha, directa)
    await page.evaluate(() => game.select({ structure: 'house' }));
    await expect(page.locator('#panel-title')).toHaveText('CASA NV.0/3');
    await expect(page.locator('#sign-house')).toContainText('CASA');
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.evaluate(() => { game.state.items.wheat = 100; game.state.items.tomato = 100; });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    // Nivel 1: la casita arreglada y limpio alrededor
    expect(await page.evaluate(() => [game.state.house.level, game.farm.byId.house.ruin.visible, game.farm.byId.house.whole.visible])).toEqual([1, false, true]);
    const l1 = await wildHidden();
    expect(l1).toBeGreaterThan(before);
    await page.locator('#panel-upgrade').click();
    await page.locator('#panel-upgrade').click();
    await expect(page.locator('#panel-title')).toHaveText('CASA NV.3/3');
    expect(await wildHidden()).toBeGreaterThan(l1);
    // Al nivel 3 la parcela entera está limpia: nada abandonado dentro
    expect(await page.evaluate(() => game.farm.floor.tiles.filter((t) => t.k && t.k.wild && t.r < 0).length)).toBe(0);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.house.level)).toBe(3);
    expect(errors).toEqual([]);
});
