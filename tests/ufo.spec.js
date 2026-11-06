// Pruebas de la tienda de la casa (la lleva el mercader, en oro) y de los ovnis pequeños.
const { test, expect, aimAndShoot, enterField, watchErrors } = require('./helpers');

test('tienda de la casa: con la casa al máximo sale su cartel (sin ovni estrellado) y se paga con oro', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect.poll(() => page.evaluate(() => window.game && game.farm.introT > 2.2), { timeout: 60_000 }).toBe(true);
    await expect(page.locator('#sign-ufo')).toBeHidden();
    await page.evaluate(() => { game.state.items.wheat = 999; game.state.items.tomato = 999; for (let i = 0; i < 3; i++) game.upgradeHouse(); });
    expect(await page.evaluate(() => [game.state.houseMaxed, !!game.farm.ufo, !!game.cine])).toEqual([true, false, false]);
    // Su cartel abre la tienda: CASA y PARCELA (hasta abrirla, una admiración; después, la cara del mercader)
    await expect(page.locator('#sign-ufo')).toBeVisible();
    await expect(page.locator('#sign-ufo')).toHaveText('!');
    await page.screenshot({ path: test.info().outputPath('sign-alarm.png') });
    await page.locator('#sign-ufo').click();
    await expect(page.locator('#ufo-shop')).toBeVisible();
    await expect(page.locator('#sign-ufo')).toHaveClass(/met/);
    await expect(page.locator('#sign-ufo .merchant-ico')).toHaveCount(1);
    await expect(page.locator('.ufo-tab')).toHaveText(['CASA', 'PARCELA']);
    await expect(page.locator('#shop-roof-blue')).toHaveClass(/on/);
    // Sin monedas no se compra; con ellas, el tejado rojo se pone en la casa
    await page.locator('#shop-roof-red').click();
    expect(await page.evaluate(() => game.state.home.look.roof)).toBe('roof-blue');
    await page.evaluate(() => { game.state.items.gold = 7; });
    await page.locator('#shop-roof-red').click();
    expect(await page.evaluate(() => [game.state.home.look.roof, game.state.items.gold, game.state.owns('roof-red')])).toEqual(['roof-red', 1, true]);
    expect(await page.evaluate(() => game.farm.byId.house.paint.roof[0].material.color.getHex())).toBe(0xb84a32);
    // Lo de PRONTO no se compra
    await page.locator('.ufo-cat', { hasText: 'TIPO DE CASA' }).click();
    await page.locator('#shop-type-attic').click();
    expect(await page.evaluate(() => [game.state.owns('type-attic'), game.state.items.gold])).toEqual([false, 1]);
    // PARCELA: la piscina va a su hueco al comprarla; tocarla otra vez la quita (y otra, la pone)
    await page.locator('.ufo-tab', { hasText: 'PARCELA' }).click();
    await page.evaluate(() => { game.state.items.gold = 25; });
    await page.locator('#shop-pool').click();
    expect(await page.evaluate(() => [game.state.owns('pool'), game.state.items.gold, game.farm.plot.items.pool.visible])).toEqual([true, 1, true]);
    await expect(page.locator('#shop-pool')).toHaveClass(/on/);
    await page.locator('#shop-pool').click();
    expect(await page.evaluate(() => [game.state.home.placed.includes('pool'), game.farm.plot.items.pool.visible, game.state.items.gold])).toEqual([false, false, 1]);
    await page.locator('#shop-pool').click();
    expect(await page.evaluate(() => game.farm.plot.items.pool.visible)).toBe(true);
    // Se guarda: al recargar sigue el tejado rojo y la piscina
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.farm.byId.house.paint.roof[0].material.color.getHex())).toBe(0xb84a32);
    expect(await page.evaluate(() => game.farm.plot.items.pool.visible)).toBe(true);
    await expect(page.locator('#sign-ufo')).toHaveClass(/met/);
    await page.screenshot({ path: test.info().outputPath('sign-merchant.png') });
    expect(errors).toEqual([]);
});

test('ovnis pequeños: cruzan el cielo del campo de tiro y se pueden derribar (no dan monedas)', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    const pos = await page.evaluate(() => { const f = game.sniper.flyers.spawn(false); f.dist = f.len / 2; const p = f.model.root.position; return { x: p.x, y: p.y, z: p.z }; });
    expect(pos.y).toBeGreaterThan(5);
    // (se le devuelve al centro de su vuelo y se coloca ya, para apuntar a donde está de verdad)
    await aimAndShoot(page, '(() => { const fl = game.sniper.flyers, f = fl.list.find((x) => !x.falling); if (f) { f.dist = f.len / 2; fl.place(f, game.sniper.time); } return f && f.model.root.position; })()');
    await expect(page.locator('#medals')).toContainText('OVNI DERRIBADO', { timeout: 10_000 });
    expect(await page.evaluate(() => game.state.items.gold)).toBe(0);
    expect(errors).toEqual([]);
});
