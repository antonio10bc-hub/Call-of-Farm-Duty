// Pruebas de el ovni: su cinemática, su tienda y los ovnis pequeños que dan monedas.
const { test, expect, aimAndShoot, enterField, watchErrors } = require('./helpers');

test('ovni: con la casa al máximo cae del cielo (sin control), se estrella y abre su tienda', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2.2)).toBe(true);
    expect(await page.evaluate(() => game.farm.ufo)).toBeFalsy();
    await page.evaluate(() => { game.state.items.wheat = 999; game.state.items.tomato = 999; for (let i = 0; i < 3; i++) game.upgradeHouse(); });
    // Tras la calma, la cinemática bloquea el control (bandas negras)
    await expect.poll(() => page.evaluate(() => !!(game.cine && game.cine.locked)), { timeout: 10_000 }).toBe(true);
    await expect(page.locator('body')).toHaveClass(/cine/);
    await expect.poll(() => page.evaluate(() => game.state.ufo.crashed), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => !game.cine), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('body')).not.toHaveClass(/cine/);
    // Su cartel de alarma abre la tienda: CASA y PARCELA
    await expect(page.locator('#sign-ufo')).toBeVisible();
    await page.locator('#sign-ufo').click();
    await expect(page.locator('#ufo-shop')).toBeVisible();
    await expect(page.locator('.ufo-tab')).toHaveText(['CASA', 'PARCELA']);
    await expect(page.locator('#shop-roof-blue')).toHaveClass(/on/);
    // Sin monedas no se compra; con ellas, el tejado rojo se pone en la casa
    await page.locator('#shop-roof-red').click();
    expect(await page.evaluate(() => game.state.home.look.roof)).toBe('roof-blue');
    await page.evaluate(() => { game.state.items.alien = 5; });
    await page.locator('#shop-roof-red').click();
    expect(await page.evaluate(() => [game.state.home.look.roof, game.state.items.alien, game.state.owns('roof-red')])).toEqual(['roof-red', 3, true]);
    expect(await page.evaluate(() => game.farm.byId.house.paint.roof[0].material.color.getHex())).toBe(0xb84a32);
    // Lo de PRONTO no se compra
    await page.locator('.ufo-tab', { hasText: 'PARCELA' }).click();
    await page.locator('#shop-pool').click();
    expect(await page.evaluate(() => [game.state.owns('pool'), game.state.items.alien])).toEqual([false, 3]);
    // Se guarda: al recargar sigue el ovni y el tejado rojo
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && !!game.farm.ufo && game.farm.byId.house.paint.roof[0].material.color.getHex())).toBe(0xb84a32);
    expect(errors).toEqual([]);
});

test('ovnis pequeños: cruzan el cielo del campo de tiro y derribarlos da monedas alienígenas', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    const pos = await page.evaluate(() => { const f = game.sniper.flyers.spawn(); f.dist = f.len / 2; const p = f.model.root.position; return { x: p.x, y: p.y, z: p.z }; });
    expect(pos.y).toBeGreaterThan(5);
    // (se le devuelve al centro de su vuelo y se coloca ya, para apuntar a donde está de verdad)
    await aimAndShoot(page, '(() => { const fl = game.sniper.flyers, f = fl.list.find((x) => !x.falling); if (f) { f.dist = f.len / 2; fl.place(f, game.sniper.time); } return f && f.model.root.position; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.alien), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('#snipe-alien')).toBeVisible();
    await expect(page.locator('#medals')).toContainText('OVNI DERRIBADO');
    expect(errors).toEqual([]);
});
