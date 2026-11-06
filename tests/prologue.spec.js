// El prólogo de una partida nueva: recoger trigo a mano, el trigo mágico, el espacio, la torre
// (el rifle y dispararle), la cinemática de las rachas y el mapa con todo por hacer.
const { test, expect, watchErrors } = require('./helpers');

test('prólogo: a mano, el trigo mágico, el espacio, la torre, la cinemática y el mapa de cero', { tag: '@full' }, async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await page.goto('/?test&prologue');
    const pro = () => page.evaluate(() => [game.mode, game.prologue.phase, game.prologue.locked]);
    // Igual que pro(), pero pasando los textos del trigo mágico (no se van solos: hay que tocar)
    const talk = async () => {
        if (await page.evaluate(() => !!game.prologue.talking)) await page.keyboard.press('Enter');
        return pro();
    };
    // 1. En el campo, a mano: dos matas y aparece el trigo mágico
    await expect.poll(pro, { timeout: 30_000 }).toEqual(['prologue', 'field', false]);
    await expect(page.locator('#pro-prompt')).toBeVisible();
    for (let k = 0; k < 2; k++) {
        await page.mouse.click(200, 400);
        await expect.poll(() => page.evaluate(() => game.prologue.picked), { timeout: 30_000 }).toBe(k + 1);
        await expect.poll(() => page.evaluate(() => game.prologue.locked), { timeout: 30_000 }).toBe(false);
    }
    expect(await page.evaluate(() => game.prologue.magic.root.visible)).toBe(true);
    // 2. Al ir a por él, habla, y al espacio (sin control)
    await page.mouse.click(200, 400);
    await expect(page.locator('#pro-talk')).toBeVisible();
    await expect.poll(talk, { timeout: 60_000 }).toEqual(['prologue', 'space', true]);
    // 3. La torre: el rifle llega a las manos y te pide que le apuntes
    await expect.poll(talk, { timeout: 90_000 }).toEqual(['snipe', 'tower', true]);
    await expect.poll(async () => (await talk(), page.evaluate(() => !game.prologue.locked && !game.sniper.hideRifle)), { timeout: 60_000 }).toBe(true);
    await expect(page.locator('#pro-prompt')).toBeVisible();
    // Mirar al trigo, subir la mira y soltar: le das
    await page.evaluate(() => { const c = game.prologue.magic.center(); game.sniper.lookAt(c.x, c.y, c.z); });
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 30_000 }).toBe(true);
    await page.evaluate(() => { const c = game.prologue.magic.center(); game.sniper.lookAt(c.x, c.y, c.z); });
    await page.mouse.up({ button: 'right' });
    await expect.poll(() => page.evaluate(() => !!game.prologue.show), { timeout: 20_000 }).toBe(true);
    // 4. La cinemática acaba en la bomba nuclear; luego el mapa, con todo bloqueado
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.nuke || game.prologue.phase === 'map'), { timeout: 120_000 }).toBe(true);
    await expect.poll(pro, { timeout: 120_000 }).toEqual(['farm', 'map', true]);
    await expect.poll(talk, { timeout: 200_000 }).toEqual(['farm', null, false]);
    expect(await page.evaluate(() => game.dayNight ? game.dayNight.k : 0)).toBe(0);
    expect(await page.evaluate(() => [game.state.prologue, game.state.items.wheat, Object.values(game.state.fields).some((f) => f.unlocked)])).toEqual([true, 0, false]);
    // Las zonas bloqueadas dejan ver lo que tendrán
    expect(await page.evaluate(() => game.farm.hints.reduce((n, e) => n + e.positions.filter((p) => !p.hide).length, 0))).toBeGreaterThan(20);
    // Ya visto: no vuelve a salir
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.mode), { timeout: 30_000 }).toBe('farm');
    expect(errors).toEqual([]);
});
