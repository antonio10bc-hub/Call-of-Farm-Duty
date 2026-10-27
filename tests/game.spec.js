// Flujos principales en un navegador de verdad: mapa de la granja → tocar edificios →
// recoger un campo → francotirador (mantener, soltar) → volver.
const { test, expect } = require('@playwright/test');

function watchErrors(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    return errors;
}

// Punto de pantalla de una posición del mundo vista por una cámara del juego
async function screenOf(page, which, x, y, z) {
    return page.evaluate(([which, x, y, z]) => {
        const cam = which === 'map' ? game.rig.camera : game.sniper.camera;
        const v = cam.position.clone().set(x, y, z).project(cam);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z };
    }, [which, x, y, z]);
}

// Abre la granja con el trigo ya desbloqueado (como si ya se hubiera volado su chatarra)
async function openFarm(page) {
    await page.goto('/');
    await expect(page.locator('#sign-wheat')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => { game.state.unlock('wheat'); game.revealUnlocked(); });
}

async function enterField(page) {
    await openFarm(page);
    const bubble = page.locator('.bubble:not(.hidden)').first();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await bubble.click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
}

// Gesto táctil sintético (pointerType touch) sobre el lienzo: [x, y, ms de espera] por paso
async function touchPath(page, steps) {
    await page.evaluate(async (steps) => {
        const el = document.getElementById('view');
        const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
        steps.forEach(([type, x, y, wait], i) => (steps[i] = [type, x, y, wait]));
        for (const [type, x, y, wait] of steps) {
            ev(type, x, y);
            if (wait) await new Promise((r) => setTimeout(r, wait));
        }
    }, steps);
}

// Mira a la siguiente mata, mantiene el botón derecho (sube el arma) y lo suelta: un disparo
async function shootNext(page) {
    const ok = await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        if (!s) return false;
        game.sniper.lookAt(s.x, 0.9, s.z);
        return true;
    });
    if (!ok) return false;
    await expect.poll(() => page.evaluate(() => (game.sniper.canFire && !game.sniper.scoped && !game.sniper.moving) || game.sniper.ending >= 0), { timeout: 10_000 }).toBe(true);
    if (await page.evaluate(() => game.sniper.ending >= 0)) return false;
    await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        if (s) game.sniper.lookAt(s.x, 0.9, s.z);
    });
    await page.mouse.down({ button: 'right' });
    // (si mientras tanto una granada recoge lo último y se acaba el campo, ya no hay disparo)
    await expect.poll(() => page.evaluate(() => (game.sniper.adsK === 1 && game.sniper.spread < 0.002) || game.sniper.ending >= 0), { timeout: 20_000 }).toBe(true);
    if (await page.evaluate(() => game.sniper.ending >= 0)) {
        await page.mouse.up({ button: 'right' });
        return false;
    }
    // La vista puede haberse movido (salto de torre en curso): se vuelve a centrar la mata
    await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        if (s) game.sniper.lookAt(s.x, 0.9, s.z);
    });
    await page.waitForTimeout(60);
    await page.mouse.up({ button: 'right' });
    return true;
}

test('lo primero: el trigo es un terreno con chatarra y se desbloquea disparando al barril', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
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

test('el montón con el barril cambia de sitio en cada desbloqueo', async ({ page }) => {
    await page.goto('/');
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

test('la granja es un mapa: tocar el granero abre el menú de rachas de bajas (2 como mucho)', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('#sign-wheat')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#wheat-count')).toHaveText('0');
    const p = await screenOf(page, 'map', 15, 1.4, 11);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#streaks')).toBeVisible();
    // Por defecto: granada y misil Predator; cada una con sus bajas
    await expect(page.locator('#ks-card-grenade')).toHaveClass(/on/);
    await expect(page.locator('#ks-card-predator')).toHaveClass(/on/);
    await expect(page.locator('#ks-card-bomber')).toContainText('20 BAJAS');
    await expect(page.locator('#ks-card-nuke')).toContainText('30 BAJAS');
    // Con dos puestas no entra una tercera; quitando una, sí
    await page.locator('#ks-card-nuke').click();
    await expect(page.locator('#ks-card-nuke')).not.toHaveClass(/on/);
    await page.locator('#ks-card-predator').click();
    await page.locator('#ks-card-nuke').click();
    await expect(page.locator('#ks-pick-info')).toContainText('2/2');
    expect(await page.evaluate(() => game.state.streaks)).toEqual(['grenade', 'nuke']);
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

test('primera persona: arrastrar mira, quieto apunta y soltar dispara; deslizar desde el borde cambia de torre', async ({ page }) => {
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

test('ratón: botón derecho apunta y al soltar dispara; al recoger todo se vuelve a la granja', async ({ page }) => {
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

test('mejorar el campo: cuesta 3 de trigo, lo hace más grande y con más matas', async ({ page }) => {
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

test('colateral: una bala que atraviesa dos matas recoge las dos', async ({ page }) => {
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

test('ajustes: borrar el progreso pide confirmación y deja la granja como al empezar', async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await expect(page.locator('.bubble:not(.hidden)')).toHaveCount(1, { timeout: 30_000 });
    await page.evaluate(() => { game.state.wheat = 7; game.upgradeField('wheat'); });
    expect(await page.evaluate(() => [game.state.fields.wheat.level, game.state.wheat])).toEqual([1, 4]);
    await page.locator('#btn-settings').click();
    // El primer toque solo arma el botón
    await page.locator('#btn-reset').click();
    await expect(page.locator('#btn-reset')).toHaveText('¿SEGURO? TOCA OTRA VEZ');
    expect(await page.evaluate(() => game.state.fields.wheat.level)).toBe(1);
    await page.locator('#btn-reset').click();
    await page.waitForLoadState('load');
    await expect.poll(() => page.evaluate(() => window.game && [game.state.fields.wheat.level, game.state.wheat])).toEqual([0, 0]);
    expect(errors).toEqual([]);
});

// Apunta con la mira asentada a un punto (que se vuelve a calcular justo antes de soltar) y dispara
async function aimAndShoot(page, where) {
    const look = `(() => { const p = ${where}; if (p) game.sniper.lookAt(p.x, p.y, p.z); })()`;
    await page.evaluate(look);
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 20_000 }).toBe(true);
    await page.evaluate(look);
    await page.waitForTimeout(60);
    await page.mouse.up({ button: 'right' });
}

test('tomates: con el trigo al máximo se desbloquea disparando al barril; luego se cosechan y se mejoran con trigo y tomates', async ({ page }) => {
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
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBe(await page.evaluate(() => game.state.sheaves('tomato')));
    await aimAndShoot(page, 'game.sniper.field.sheaves.find((x) => x.alive)');
    await expect.poll(() => page.evaluate(() => game.state.items.tomato)).toBeGreaterThan(0);
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

test('debug: con COSTES 0 se mejora sin gastar nada', async ({ page }) => {
    const errors = watchErrors(page);
    await openFarm(page);
    await page.evaluate(() => game.select({ field: 'wheat' }));
    await expect(page.locator('#panel-upgrade')).toBeDisabled();
    await page.locator('#btn-settings').click();
    await page.locator('#toggle-free').click();
    await expect(page.locator('#toggle-free')).not.toHaveClass(/off/);
    await page.locator('#btn-settings-close').click();
    await expect(page.locator('#panel-upgrade')).toBeEnabled();
    await expect(page.locator('#upgrade-cost')).toHaveText('0');
    await page.locator('#panel-upgrade').click();
    expect(await page.evaluate(() => [game.state.fields.wheat.level, game.state.wheat])).toEqual([1, 0]);
    // Se recuerda al recargar
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.game && game.state.freeCosts)).toBe(true);
    expect(errors).toEqual([]);
});

// Al campo de tiro con el trigo al máximo (32 matas: sitio para encadenar rachas)
async function enterBigField(page, streaks) {
    await openFarm(page);
    if (streaks) await page.evaluate((s) => { game.state.streaks = s; }, streaks);
    await page.evaluate(() => { game.state.wheat = 12; for (let i = 0; i < 4; i++) game.upgradeField('wheat'); game.state.wheat = 0; game.select(null); });
    const bubble = page.locator('.bubble:not(.hidden)').first();
    await bubble.click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
}

test('racha: la barra sale al recoger, se vacía y a las 5 sale una granada que recoge lo de alrededor', async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    await shootNext(page);
    await expect.poll(() => page.evaluate(() => game.sniper.streak)).toBeGreaterThan(0);
    await expect(page.locator('#streak')).toBeVisible();
    await expect(page.locator('#streak-next')).toContainText('GRANADA');
    // Si la barra se vacía, la racha se pierde
    await page.evaluate(() => { game.sniper.streakT = 0.01; });
    await expect.poll(() => page.evaluate(() => game.sniper.streak)).toBe(0);
    await expect(page.locator('#streak')).toBeHidden();
    // A las 5: granada (sola), que recoge lo que pilla al explotar
    const before = await page.evaluate(() => game.state.wheat);
    await page.evaluate(() => game.sniper.addStreak(5));
    await expect(page.locator('#medals')).toContainText('GRANADA');
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 5_000 }).toBeGreaterThan(before);
    expect(errors).toEqual([]);
});

test('racha de 10: misil Predator con vista cenital, se guía y se acelera, y explota recogiendo', async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    await page.evaluate(() => game.sniper.addStreak(10));
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.predator)).toBe(true);
    await expect(page.locator('#predator-hud')).toBeVisible();
    // Mirando hacia abajo desde lo alto; mover la vista mueve el misil y el gatillo lo acelera
    await expect.poll(() => page.evaluate(() => game.sniper.camera.position.y)).toBeGreaterThan(20);
    const x0 = await page.evaluate(() => game.sniper.ks.predator.x + game.sniper.ks.predator.z);
    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    await page.keyboard.up('d');
    expect(await page.evaluate(() => game.sniper.ks.predator.x + game.sniper.ks.predator.z)).not.toBeCloseTo(x0, 2);
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => game.sniper.ks.predator.boost)).toBe(true);
    // Mientras se guía, la racha no se pierde
    expect(await page.evaluate(() => game.sniper.ks.paused)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.ks.predator), { timeout: 10_000 }).toBe(null);
    await expect(page.locator('#predator-hud')).toBeHidden();
    expect(await page.evaluate(() => game.state.wheat)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});

test('rachas de 20 y 30: bombardero que bombardea el campo y bomba nuclear que lo recoge todo', async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page, ['bomber', 'nuke']);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    await page.evaluate(() => game.sniper.addStreak(20));
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.plane)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.ks.bombs.length > 0), { timeout: 8_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => !game.sniper.ks.plane), { timeout: 25_000 }).toBe(true); // en el campo grande el avión tarda más en cruzar
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 5_000 }).toBeGreaterThan(0);
    // Nuclear: cuenta atrás de 5 y lo que quede, recogido (las bombas pueden haber llevado ya
    // la racha a 30 por su cuenta)
    await page.evaluate(() => { const s = game.sniper; if (!s.ks.nuke) s.addStreak(Math.max(1, 30 - s.streak)); });
    await expect(page.locator('#nuke-count')).toBeVisible();
    await expect(page.locator('#nuke-n')).toHaveText(/^[1-5]$/);
    // (con el render por software de las pruebas el campo grande va a pocos fotogramas: más margen)
    await expect.poll(() => page.evaluate(() => game.sniper.field.remaining), { timeout: 40_000 }).toBe(0);
    await expect(page.locator('#nuke-haze')).toHaveCSS('opacity', '1', { timeout: 5_000 }); // neblina radiactiva
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 15_000 }).toBe('farm');
    expect(await page.evaluate(() => game.state.wheat)).toBe(total);
    expect(errors).toEqual([]);
});

test('debug: se elige cuántas bajas pide cada racha', async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    await page.locator('#btn-settings').click();
    // La granada, de 5 a 1 bajas (cuatro veces -)
    await expect(page.locator('#ks-grenade')).toHaveText('5');
    for (let i = 0; i < 4; i++) await page.locator('.ks-row', { has: page.locator('#ks-grenade') }).locator('[data-d="-1"]').click();
    await expect(page.locator('#ks-grenade')).toHaveText('1');
    await page.locator('.ks-row', { has: page.locator('#ks-grenade') }).locator('[data-d="-1"]').click();
    await expect(page.locator('#ks-grenade')).toHaveText('1'); // nunca menos de 1
    await page.locator('.ks-row', { has: page.locator('#ks-nuke') }).locator('[data-d="1"]').click();
    await expect(page.locator('#ks-nuke')).toHaveText('31');
    await page.locator('#btn-settings-close').click();
    // Con una sola baja ya sale la granada
    await page.evaluate(() => game.harvest('wheat'));
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('#streak-next')).toBeHidden();
    await shootNext(page);
    await expect(page.locator('#medals')).toContainText('GRANADA');
    // Se recuerda al recargar, y RACHAS POR DEFECTO lo devuelve todo a su sitio
    await page.reload();
    await expect(page.locator('#ks-grenade')).toHaveText('1');
    await page.locator('#btn-settings').click();
    await page.locator('#ks-default').click();
    await expect(page.locator('#ks-grenade')).toHaveText('5');
    await expect(page.locator('#ks-nuke')).toHaveText('30');
    expect(errors).toEqual([]);
});
