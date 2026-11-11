// Pruebas del campo de tiro de pruebas (en el recinto del granero): nada cuenta, los blancos
// vuelven a salir y desde su menú se cambia a cualquier arma, blanco o racha.
const { test, expect, aimAndShoot, openFarm, watchErrors } = require('./helpers');

async function enterRange(page) {
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    await page.evaluate(() => { game.goRange(); });
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect.poll(() => page.evaluate(() => game.sniper.practice && game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    // (de pie en la línea de tiro, sin torres; y los blancos son dianas)
    expect(await page.evaluate(() => [game.sniper.pos.y < 2, game.sniper.field.sheaves.every((s) => !!s.range)])).toEqual([true, true]);
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; game.sniper.walkers.reset(); game.sniper.walkers.next = Infinity; });
}

test('campo de pruebas: se entra desde el recinto, nada cuenta, los blancos vuelven y su menú cambia de arma, blancos y rachas', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterRange(page);
    await expect(page.locator('#btn-range')).toBeVisible();
    const items = await page.evaluate(() => JSON.stringify(game.state.items));
    // Un tiro de verdad a una diana fija: cae
    await aimAndShoot(page, "game.sniper.field.sheaves.find((s) => s.range === 'board' && s.alive)");
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.filter((s) => s.range === 'board' && !s.alive).length)).toBeGreaterThan(0);
    // Se tumban todas las dianas: no suma nada y al poco sale otra tanda
    await page.evaluate(() => game.sniper.harvest(game.sniper.field.sheaves.filter((s) => s.alive)));
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBe(0);
    await expect.poll(() => page.evaluate(() => game.sniper.field.remaining), { timeout: 20_000 }).toBeGreaterThan(0);
    expect(await page.evaluate(() => [game.mode, JSON.stringify(game.state.items)])).toEqual(['snipe', items]);
    // El menú: un rifle que no se tiene (cambia las cifras), otros blancos y un arma de la caja
    await page.keyboard.press('t'); // (con el ratón bloqueado, con la tecla)
    await expect(page.locator('#range-menu')).toBeVisible();
    const bolt = await page.evaluate(() => game.sniper.stats.bolt);
    await page.locator('#range-body [data-gear="rifle:semi"]').click();
    expect(await page.evaluate(() => game.sniper.loadout.rifle)).toBe('semi');
    expect(await page.evaluate(() => game.sniper.stats.bolt)).not.toBe(bolt);
    expect(await page.evaluate(() => game.state.ownsGear('rifle', 'semi'))).toBe(false); // (probarlo no lo da)
    await page.locator('#range-body [data-target="steel"]').click();
    expect(await page.evaluate(() => game.sniper.field.sheaves.every((s) => s.range === 'plate'))).toBe(true);
    await page.locator('#range-body [data-wonder="rpg"]').click();
    expect(await page.evaluate(() => game.sniper.special && game.sniper.special.id)).toBe('rpg');
    // Una racha: se cierra el menú y se lanza
    await page.locator('#range-body [data-ks="frag"]').click();
    await expect(page.locator('#range-menu')).toBeHidden();
    // Se vuelve a la granja sin nada nuevo
    await page.evaluate(() => game.goFarm());
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('farm');
    expect(await page.evaluate(() => [game.sniper.practice, document.body.classList.contains('practice')])).toEqual([false, false]);
    expect(errors).toEqual([]);
});
