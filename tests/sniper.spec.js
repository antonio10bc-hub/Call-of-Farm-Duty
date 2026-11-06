// Pruebas de el campo de tiro: controles (dedo, ratón, teclado), colaterales y los cultivos de las
// parcelas que se compran (calabazas y maíz).
const { test, expect, aimAndShoot, enterField, openFarm, shootNext, touchPath, watchErrors } = require('./helpers');

// Al campo de tiro de un cultivo de las parcelas que se compran (desbloqueado a la fuerza)
async function enterCrop(page, id) {
    await openFarm(page);
    await expect(page.locator('#sign-wheat')).toHaveText('NV.1', { timeout: 30_000 });
    await page.evaluate((id) => { game.state.unlock(id, Date.now(), true); while (game.revealUnlocked()); game.harvest(id); }, id);
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; game.sniper.walkers.reset(); game.sniper.walkers.next = Infinity; });
}

test('primera persona (táctil): arrastrar mira, el botón de mira apunta y al soltarlo dispara; las flechas cambian de torre', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    await expect(page.locator('#snipe-ui')).toBeVisible();
    // Arrastrar gira la vista y no apunta ni dispara (aunque el dedo se quede quieto un rato)
    const yaw0 = await page.evaluate(() => game.sniper.lookYaw);
    await touchPath(page, [['pointerdown', 200, 400, 16], ['pointermove', 160, 400, 16], ['pointermove', 120, 400, 400], ['pointerup', 120, 400, 0]]);
    expect(await page.evaluate(() => game.sniper.lookYaw)).toBeGreaterThan(yaw0 + 0.1);
    expect(await page.evaluate(() => [game.state.wheat, game.sniper.scoped, game.sniper.bolt])).toEqual([0, false, 0]);
    // Mirando a una mata, mantener el botón de mira sube el arma y soltarlo dispara
    await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        game.sniper.lookAt(s.x, 0.9, s.z);
    });
    await touchPath(page, [['pointerdown', 380, 560, 50]], 'btn-aim', 9);
    await expect.poll(() => page.evaluate(() => game.sniper.scoped)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 20_000 }).toBe(true);
    await touchPath(page, [['pointerup', 380, 560, 0]], 'btn-aim', 9);
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBeGreaterThan(0);
    // Sin mira la dispersión es grande (no scope) y un toque rápido dispara desde la cadera
    await expect.poll(() => page.evaluate(() => game.sniper.canFire && game.sniper.adsK === 0), { timeout: 10_000 }).toBe(true);
    expect(await page.evaluate(() => game.sniper.spread)).toBeGreaterThan(0.05);
    await touchPath(page, [['pointerdown', 200, 400, 40], ['pointerup', 200, 400, 0]]);
    expect(await page.evaluate(() => game.sniper.bolt)).toBeGreaterThan(0);
    // La flecha de la izquierda: la torre de la izquierda
    await page.evaluate(() => { const sn = game.sniper; window.__view = { x: sn.pos.x, z: sn.pos.z, yaw: sn.lookYaw, corner: sn.corner }; });
    await page.locator('#btn-prev').click();
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
    await shootNext(page);
    // (lo demás, menos una, de golpe: con el trigo de ahora serían muchos tiros) y la última a tiro
    await page.evaluate(() => { const f = game.sniper.field, alive = f.targets.filter((x) => x.alive); game.sniper.harvest(alive.slice(1), true); });
    for (let k = 0; k < 6; k++) {
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

test('calabazas: aguantan 3 tiros (cada uno las resquebraja) y paran la bala', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'pumpkin');
    // (a la más cercana a la torre: así no hay otra delante que se lleve el tiro)
    const first = await page.evaluate(() => { const f = game.sniper.field, p = game.sniper.pos; let best = 0; f.sheaves.forEach((s, i) => { const b = f.sheaves[best]; if (Math.hypot(s.x - p.x, s.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z)) best = i; }); return best; });
    const at = `(() => { const s = game.sniper.field.sheaves[${first}]; return { x: s.x, y: s.size * 0.4, z: s.z }; })()`;
    await aimAndShoot(page, at);
    await expect.poll(() => page.evaluate((i) => game.sniper.field.sheaves[i].hp, first)).toBe(2);
    expect(await page.evaluate((i) => [game.sniper.field.sheaves[i].alive, game.state.items.pumpkin], first)).toEqual([true, 0]);
    await aimAndShoot(page, at);
    await expect.poll(() => page.evaluate((i) => game.sniper.field.sheaves[i].hp, first)).toBe(1);
    await aimAndShoot(page, at);
    await expect.poll(() => page.evaluate(() => game.state.items.pumpkin)).toBe(1);
    expect(await page.evaluate((i) => game.sniper.field.sheaves[i].alive, first)).toBe(false);
    expect(errors).toEqual([]);
});

test('maíz: matas altas en hileras con sus mazorcas arriba', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'corn');
    // Dos mazorcas por mata, a media altura de unas matas de más de 2 m
    expect(await page.evaluate(() => { const f = game.sniper.field; return [f.targets.length, f.plants.every((p) => p.h > 2), f.targets.every((s) => s.y > 1)]; })).toEqual([16, true, true]);
    await aimAndShoot(page, '(() => { const s = game.sniper.field.sheaves.find((x) => x.alive); return s && { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.corn)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});
