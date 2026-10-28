// Pruebas de desbloquear terrenos disparando al barril (trigo y tomates).
const { test, expect, aimAndShoot, openFarm, watchErrors } = require('./helpers');

test('lo primero: el trigo es un terreno con chatarra y se desbloquea disparando al barril', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toHaveText('¡DESBLOQUEAR!', { timeout: 30_000 });
    await expect(page.locator('#sign-tomato')).toHaveText('BLOQUEADO');
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(0);
    expect(await page.evaluate(() => game.farm.fields.wheat.locked)).toBe(true);
    await page.locator('#sign-wheat').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    expect(await page.evaluate(() => game.sniper.unlocking)).toBe(true);
    await aimAndShoot(page, 'game.sniper.field.barrel');
    await expect.poll(() => page.evaluate(() => game.sniper.field.exploded)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('farm');
    // Terreno limpio y sembrado: el trigo ya está listo para recoger
    expect(await page.evaluate(() => [game.state.fields.wheat.unlocked, game.farm.fields.wheat.locked])).toEqual([true, false]);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1');
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('el montón con el barril cambia de sitio en cada desbloqueo', { tag: '@full' }, async ({ page }) => {
    await page.goto('/?test');
    await expect(page.locator('#sign-wheat')).toBeVisible({ timeout: 30_000 });
    const spots = await page.evaluate(() => {
        const f = game.sniper.field, out = [];
        for (let k = 0; k < 6; k++) {
            f.spawnJunk();
            out.push(`${f.barrel.x.toFixed(2)},${f.barrel.z.toFixed(2)}`);
        }
        f.clearSheaves();
        return out;
    });
    expect(new Set(spots).size).toBeGreaterThan(1);
});

test('tomates: con el trigo al máximo se desbloquea disparando al barril; luego se cosechan y se mejoran con trigo y tomates', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('#sign-tomato')).toBeVisible({ timeout: 30_000 });
    // Bloqueado mientras el trigo no está al máximo
    await expect(page.locator('#sign-tomato')).toHaveText('BLOQUEADO');
    await page.locator('#sign-tomato').click();
    await expect(page.locator('#panel-title')).toHaveText('TERRENO ABANDONADO');
    await expect(page.locator('#panel-action')).toBeHidden();
    await page.evaluate(() => { game.state.wheat = 40; for (let i = 0; i < 4; i++) game.upgradeField('wheat'); game.select(null); });
    expect(await page.evaluate(() => game.state.maxed('wheat'))).toBe(true);
    await expect(page.locator('#sign-tomato')).toHaveText('¡DESBLOQUEAR!');
    // El cartel lleva directo al campo de tiro del desbloqueo: una torre, chatarra y el barril
    await page.locator('#sign-tomato').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    expect(await page.evaluate(() => game.sniper.unlocking && !!game.sniper.field.barrel)).toBe(true);
    await expect(page.locator('#btn-next')).toBeHidden();
    // Desde lejos, con la mira asentada, al barril
    await aimAndShoot(page, 'game.sniper.field.barrel');
    await expect.poll(() => page.evaluate(() => game.sniper.field.exploded)).toBe(true);
    expect(await page.evaluate(() => game.state.fields.tomato.unlocked)).toBe(true);
    // Sale sola al mapa: el terreno ya está limpio, con tomates listos para recoger
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('farm');
    expect(await page.evaluate(() => game.farm.fields.tomato.locked)).toBe(false);
    await expect(page.locator('#sign-tomato')).toHaveText('NV.1');
    await expect(page.locator('#farm-tomato')).toBeVisible();
    // A cosechar: matas de tomate con tomates gigantes; disparar a un tomate lo recoge
    await page.evaluate(() => game.harvest('tomato'));
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; }); // sin ovnis pequeños de por medio
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBe(await page.evaluate(() => game.state.sheaves('tomato')));
    await aimAndShoot(page, 'game.sniper.field.sheaves.find((x) => x.alive)');
    await expect.poll(() => page.evaluate(() => game.state.items.tomato)).toBeGreaterThan(0);
    // Con el ratón bloqueado los botones no se tocan (como en el juego: Esc lo suelta)
    await page.evaluate(() => document.exitPointerLock());
    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    // La mejora pide trigo y tomates
    await page.evaluate(() => { game.state.items.wheat = 5; game.state.items.tomato = 2; game.select({ field: 'tomato' }); });
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.evaluate(() => { game.state.items.tomato = 3; });
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => [game.state.fields.tomato.level, game.state.items.wheat, game.state.items.tomato])).toEqual([1, 0, 0]);
    expect(errors).toEqual([]);
});
