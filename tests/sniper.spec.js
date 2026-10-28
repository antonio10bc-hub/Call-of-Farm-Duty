// Pruebas de el campo de tiro: controles (dedo, ratón, teclado) y colaterales.
const { test, expect, enterField, shootNext, touchPath, watchErrors } = require('./helpers');

test('primera persona: arrastrar mira, quieto apunta y soltar dispara; deslizar desde el borde cambia de torre', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    await expect(page.locator('#snipe-ui')).toBeVisible();
    // Arrastrar gira la vista y no apunta ni dispara
    const yaw0 = await page.evaluate(() => game.sniper.lookYaw);
    await touchPath(page, [['pointerdown', 200, 400, 16], ['pointermove', 160, 400, 16], ['pointermove', 120, 400, 16], ['pointerup', 120, 400, 0]]);
    expect(await page.evaluate(() => game.sniper.lookYaw)).toBeGreaterThan(yaw0 + 0.1);
    expect(await page.evaluate(() => game.state.wheat)).toBe(0);
    // Mirando a una mata, dejar el dedo quieto sube el arma y soltarlo dispara
    await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        game.sniper.lookAt(s.x, 0.9, s.z);
    });
    await touchPath(page, [['pointerdown', 200, 400, 300]]);
    await expect.poll(() => page.evaluate(() => game.sniper.scoped)).toBe(true);
    // Con la mira arriba y asentada el tiro es preciso
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 20_000 }).toBe(true);
    await touchPath(page, [['pointerup', 200, 400, 0]]);
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBeGreaterThan(0);
    // Sin mira la dispersión es grande (no scope) y un toque rápido dispara desde la cadera
    await expect.poll(() => page.evaluate(() => game.sniper.canFire && game.sniper.adsK === 0), { timeout: 10_000 }).toBe(true);
    expect(await page.evaluate(() => game.sniper.spread)).toBeGreaterThan(0.05);
    await touchPath(page, [['pointerdown', 200, 400, 40], ['pointerup', 200, 400, 0]]);
    expect(await page.evaluate(() => game.sniper.bolt)).toBeGreaterThan(0);
    // Deslizar desde el borde izquierdo hacia dentro: la torre de la izquierda
    await page.evaluate(() => { const sn = game.sniper; window.__view = { x: sn.pos.x, z: sn.pos.z, yaw: sn.lookYaw, corner: sn.corner }; });
    await touchPath(page, [['pointerdown', 6, 400, 16], ['pointermove', 60, 402, 16], ['pointermove', 120, 404, 16], ['pointerup', 120, 404, 0]]);
    // Lado (-1 izquierda, +1 derecha) en que queda la torre i respecto a la vista guardada
    const side = (i) => page.evaluate((i) => {
        const sn = game.sniper, v = window.__view, t = sn.field.towers[i];
        return Math.sign((t.x - v.x) * Math.cos(v.yaw) - (t.z - v.z) * Math.sin(v.yaw));
    }, i);
    const remember = () => page.evaluate(() => { const sn = game.sniper; window.__view = { x: sn.pos.x, z: sn.pos.z, yaw: sn.lookYaw, corner: sn.corner }; });
    await expect.poll(() => page.evaluate(() => game.sniper.corner !== window.__view.corner && !game.sniper.moving)).toBe(true);
    expect(await side(await page.evaluate(() => game.sniper.corner))).toBe(-1);
    // Q salta a la torre de la izquierda y E a la de la derecha
    for (const [key, want] of [['e', 1], ['q', -1]]) {
        await remember();
        await page.keyboard.press(key);
        await expect.poll(() => page.evaluate(() => game.sniper.corner !== window.__view.corner && !game.sniper.moving)).toBe(true);
        expect(await side(await page.evaluate(() => game.sniper.corner))).toBe(want);
    }
    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    expect(errors).toEqual([]);
});

test('ratón: botón derecho apunta y al soltar dispara; al recoger todo se vuelve a la granja', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    await shootNext(page);
    // Puede caer más de una de un tiro (colateral): lo que queda cuadra con lo recogido
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBeGreaterThan(0);
    const got = await page.evaluate(() => game.state.wheat);
    await expect(page.locator('#left-count')).toHaveText(String(total - got));
    // Se puede disparar mientras se salta de torre
    await page.evaluate(() => document.exitPointerLock());
    await page.locator('#btn-next').click();
    await page.mouse.move(195, 380);
    for (let k = 0; k < total * 3; k++) {
        if (!(await shootNext(page))) break;
    }
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('farm');
    expect(await page.evaluate(() => game.state.wheat)).toBe(total);
    await expect(page.locator('#wheat-count')).toHaveText(String(total));
    expect(errors).toEqual([]);
});

test('colateral: una bala que atraviesa dos matas recoge las dos', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    // Pone una segunda mata justo detrás de la primera, en la línea de tiro desde la torre
    await page.evaluate(() => {
        const sn = game.sniper, [a, b] = sn.field.sheaves.filter((x) => x.alive);
        const dx = a.x - sn.pos.x, dz = a.z - sn.pos.z, d = Math.hypot(dx, dz);
        b.x = a.x + (dx / d) * 0.9;
        b.z = a.z + (dz / d) * 0.9;
    });
    expect(await shootNext(page)).toBe(true);
    // Dos como poco (alguna otra mata puede quedar también en la línea de tiro)
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBeGreaterThanOrEqual(2);
    const n = await page.evaluate(() => game.state.wheat);
    // Medallas pequeñas arriba: colateral y la racha (doble kill con dos, triple con tres...)
    await expect(page.locator('#medals')).toContainText(`COLATERAL x${n}`);
    await expect(page.locator('#medals')).toContainText(n === 2 ? 'DOBLE KILL' : n === 3 ? 'TRIPLE KILL' : 'MULTI KILL');
    expect(errors).toEqual([]);
});
