// Pruebas de el campo de tiro: controles (dedo, ratón, teclado), colaterales y los cultivos de las
// parcelas que se compran (calabazas, maíz y las vacas del prado) y la caja sorpresa.
const { test, expect, aimAndShoot, enterBigField, enterField, frames, openFarm, shootNext, touchPath, watchErrors } = require('./helpers');

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
    // Medallas pequeñas arriba: colateral (los cultivos no cuentan para DOBLE KILL...)
    await expect(page.locator('#medals')).toContainText(`COLATERAL x${n}`);
    await expect(page.locator('#medals')).not.toContainText('KILL');
    // DOBLE / TRIPLE / MULTI KILL: solo alienígenas abatidos seguidos
    await page.evaluate(() => { game.sniper.addAlien(1); game.sniper.addAlien(1); });
    await expect(page.locator('#medals')).toContainText('DOBLE KILL');
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

test('vacas: corren por el prado; la ubre se hace gigante y botan encima; llena, un tiro a la ubre da un cubo de leche', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'milk');
    // Una vaca por cubo, corriendo (cada una se mueve)
    const n = await page.evaluate(() => game.sniper.field.targets.length);
    expect(n).toBe(await page.evaluate(() => game.state.sheaves('milk')));
    const at0 = await page.evaluate(() => game.sniper.field.targets.map((s) => [s.cx, s.cz]));
    await expect.poll(() => page.evaluate((at0) => game.sniper.field.targets.every((s, i) => Math.hypot(s.cx - at0[i][0], s.cz - at0[i][1]) > 0.2), at0)).toBe(true);
    // Con la ubre vacía no hay a qué disparar
    await page.evaluate(() => { for (const s of game.sniper.field.targets) { s.swell = 0; s.rate = 0; } });
    expect(await page.evaluate(() => game.sniper.field.targets.some((s) => game.sniper.field.hittable(s)))).toBe(false);
    // Una, quieta y con la ubre llena: a la ubre
    await page.evaluate(() => { const s = game.sniper.field.targets[0]; s.swell = 1; s.pace = s.speed = 0; s.goal = { x: s.cx, z: s.cz }; });
    expect(await page.evaluate(() => game.sniper.field.hittable(game.sniper.field.targets[0]))).toBe(true);
    // La ubre llena es gigante y la vaca va subida encima, botando
    await expect.poll(() => page.evaluate(() => { const c = game.sniper.field.targets[0].cow; return c.us >= 5.9 && c.lift > 0.9; })).toBe(true);
    await aimAndShoot(page, '(() => { const s = game.sniper.field.targets[0]; return { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.milk)).toBe(1);
    // Ordeñada: sigue ahí (no desaparece), con la ubre vaciándose
    expect(await page.evaluate(() => { const s = game.sniper.field.targets[0]; return [s.alive, s.cow.g.visible]; })).toEqual([false, true]);
    expect(errors).toEqual([]);
});

test('ovejas: corren al azar y rebotan entre ellas; el vellón se hace una bola gigante y un tiro a la bola da un ovillo', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'wool');
    const n = await page.evaluate(() => game.sniper.field.targets.length);
    expect(n).toBe(await page.evaluate(() => game.state.sheaves('wool')));
    // Se mueven (cada una a su aire)
    const at0 = await page.evaluate(() => game.sniper.field.targets.map((s) => [s.cx, s.cz]));
    await expect.poll(() => page.evaluate((at0) => game.sniper.field.targets.every((s, i) => Math.hypot(s.cx - at0[i][0], s.cz - at0[i][1]) > 0.2), at0)).toBe(true);
    // Dos que van una contra otra rebotan (no se atraviesan)
    await page.evaluate(() => {
        const [A, B] = game.sniper.field.targets, f = game.sniper.field;
        Object.assign(A, { cx: f.cx - 0.6, cz: f.cz, vx: 2, vz: 0, turn: 99 });
        Object.assign(B, { cx: f.cx + 0.6, cz: f.cz, vx: -2, vz: 0, turn: 99 });
    });
    await expect.poll(() => page.evaluate(() => { const [A, B] = game.sniper.field.targets; return A.vx < 0 && B.vx > 0; })).toBe(true);
    // Sin bola no hay a qué disparar; con la bola hecha (gigante), un tiro da un ovillo
    await page.evaluate(() => { for (const s of game.sniper.field.targets) { s.swell = 0; s.rate = 0; } });
    expect(await page.evaluate(() => game.sniper.field.targets.some((s) => game.sniper.field.hittable(s)))).toBe(false);
    await page.evaluate(() => { const s = game.sniper.field.targets[0]; s.swell = 1; s.pace = 0; s.vx = s.vz = 0; s.turn = 99; });
    await expect.poll(() => page.evaluate(() => game.sniper.field.targets[0].cow.us > 2)).toBe(true);
    await aimAndShoot(page, '(() => { const s = game.sniper.field.targets[0]; return { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.wool)).toBe(1);
    expect(errors).toEqual([]);
});

test('gallinas: corretean y lanzan huevos al aire como platos; el blanco es el huevo (no ellas); si cae, se casca y vuelve a lanzar', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'egg');
    const n = await page.evaluate(() => game.sniper.field.targets.length);
    expect(n).toBe(await page.evaluate(() => game.state.sheaves('egg')));
    // Sin huevo en el aire no hay a qué disparar
    await page.evaluate(() => { for (const s of game.sniper.field.targets) { s.swell = 0; s.rate = 0; s.egg = null; } });
    expect(await page.evaluate(() => game.sniper.field.targets.some((s) => game.sniper.field.hittable(s)))).toBe(false);
    // Lanza uno: sube y, si no le das, cae y se casca (la gallina sigue y vuelve a cargarse)
    await page.evaluate(() => game.sniper.field.toss(game.sniper.field.targets[1]));
    expect(await page.evaluate(() => game.sniper.field.hittable(game.sniper.field.targets[1]))).toBe(true);
    await expect.poll(() => page.evaluate(() => { const s = game.sniper.field.targets[1]; return [s.egg, s.alive]; }), { timeout: 20_000 }).toEqual([null, true]);
    // Otro, parado en lo alto (en la prueba): un tiro al huevo da un huevo
    await page.evaluate(() => { const f = game.sniper.field, s = f.targets[0]; f.toss(s); f.eggGrav = 0; Object.assign(s.egg, { vx: 0, vy: 0, vz: 0, y: 3 }); s.y = 3; });
    await aimAndShoot(page, '(() => { const s = game.sniper.field.targets[0]; return { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.egg)).toBe(1);
    await expect.poll(() => page.evaluate(() => { const s = game.sniper.field.targets[0]; return [s.alive, s.egg, s.eggMesh.visible, s.cow.g.visible]; })).toEqual([false, null, false, true]);
    expect(errors).toEqual([]);
});

test('cerdos: en su barro cogen carrerilla y se deslizan de barriga; la trufa que encuentran se lleva de un tiro', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'truffle');
    expect(await page.evaluate(() => game.sniper.field.targets.length)).toBe(await page.evaluate(() => game.state.sheaves('truffle')));
    // Carrerilla y, luego, de barriga: todos acaban deslizándose (y se mueven)
    await expect.poll(() => page.evaluate(() => game.sniper.field.targets.some((s) => s.mode === 'slide' && Math.hypot(s.vx, s.vz) > 1)), { timeout: 10_000 }).toBe(true);
    // Sin trufa no hay a qué disparar; con ella, un tiro a la trufa del lomo
    await page.evaluate(() => { for (const s of game.sniper.field.targets) { s.swell = 0; s.rate = 0; } });
    expect(await page.evaluate(() => game.sniper.field.targets.some((s) => game.sniper.field.hittable(s)))).toBe(false);
    // (uno, quieto: corriendo a velocidad 0)
    await page.evaluate(() => { const s = game.sniper.field.targets[0]; s.swell = 1; s.top = 0; s.vx = s.vz = 0; s.mode = 'run'; s.t = 999; });
    await aimAndShoot(page, '(() => { const s = game.sniper.field.targets[0]; return { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.truffle)).toBe(1);
    expect(errors).toEqual([]);
});

test('peces: en la laguna del centro saltan fuera del agua (de tres tamaños); en el aire, un tiro y es pescado', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'fish');
    expect(await page.evaluate(() => game.sniper.field.targets.length)).toBe(await page.evaluate(() => game.state.sheaves('fish')));
    expect(await page.evaluate(() => !!game.sniper.field.pond)).toBe(true);
    // Saltan (cada uno cuando quiere); bajo el agua no hay a qué disparar
    await expect.poll(() => page.evaluate(() => game.sniper.field.targets.some((s) => s.jump && s.jump.y > 0.5)), { timeout: 10_000 }).toBe(true);
    await page.evaluate(() => { for (const s of game.sniper.field.targets) { s.jump = null; s.swell = 0; s.rate = 0; } });
    expect(await page.evaluate(() => game.sniper.field.targets.some((s) => game.sniper.field.hittable(s)))).toBe(false);
    // Uno, quieto en el aire (sin gravedad): un tiro y es pescado
    await page.evaluate(() => { const f = game.sniper.field, s = f.targets[0]; f.fishGrav = 0; s.jump = { x: f.pond.x, y: 2, z: f.pond.z, vx: 0, vy: 0, vz: 0 }; });
    await frames(page, 3); // (que se coloque en el aire antes de apuntarle)
    await aimAndShoot(page, '(() => { const s = game.sniper.field.targets[0]; return { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.fish)).toBe(1);
    expect(errors).toEqual([]);
});

test('caja sorpresa: sale en otra torre; desde lejos no se abre, desde su torre da un arma y al gastarla vuelve el rifle', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    // Aparece en una torre que no es la tuya, con su aviso y la torre marcada
    const i = await page.evaluate(() => game.sniper.box.spawn());
    expect(i).not.toBe(await page.evaluate(() => game.sniper.corner));
    // En la plataforma pequeña de la barandilla izquierda de su torre
    expect(await page.evaluate((k) => { const p = game.sniper.box.holder.position, L = game.sniper.field.towers[k].ledge; return [p.y > 3, Math.hypot(p.x - L.x, p.z - L.z) < 0.01]; }, i)).toEqual([true, true]);
    await expect(page.locator('#stage')).toContainText('CAJA SORPRESA');
    await expect(page.locator('#corners i.box')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => game.sniper.box.pop)).toBeGreaterThan(0.9);
    const center = '(() => { const p = game.sniper.box.holder.position; return { x: p.x, y: p.y + 0.25, z: p.z }; })()';
    // Desde otra torre, el tiro no la abre
    await aimAndShoot(page, center);
    await expect(page.locator('#medals')).toContainText('DESDE SU TORRE');
    expect(await page.evaluate(() => game.sniper.box.state)).toBe('idle');
    // Desde la suya, se abre, giran las armas y la que toca pasa a las manos
    await page.evaluate((k) => { game.sniper.corner = k; game.sniper.eyeOf(k, game.sniper.pos); }, i);
    await expect.poll(() => page.evaluate(() => game.sniper.canFire && !game.sniper.moving)).toBe(true);
    await aimAndShoot(page, center);
    // (gira o, si ya ha girado, ha dado el arma)
    await expect.poll(() => page.evaluate(() => game.sniper.box.state === 'spin' || !!game.sniper.special), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.special && game.sniper.special.id), { timeout: 40_000 }).toBeTruthy();
    await expect(page.locator('#ammo')).toHaveClass(/special/);
    const name = await page.evaluate(() => game.sniper.special.name);
    await expect(page.locator('#ammo-name')).toHaveText(name);
    // La bazuca: sin mirilla de francotirador (se apunta con la suya), el cohete vuela y revienta
    // lo que pilla
    await page.evaluate(() => { game.sniper.endSpecial(); game.sniper.box.pick = 0; game.sniper.giveSpecial(game.sniper.box.weapon); });
    await expect(page.locator('#ammo-name')).toHaveText('BAZUCA');
    const before = await page.evaluate(() => game.state.wheat);
    const sheaf = '(() => { const s = game.sniper.field.sheaves.find((x) => x.alive); return s && { x: s.x, y: 0.9, z: s.z }; })()';
    await expect.poll(() => page.evaluate(() => game.sniper.canFire)).toBe(true);
    await page.evaluate((s) => { const p = eval(s); game.sniper.lookAt(p.x, p.y, p.z); }, sheaf);
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => page.evaluate(() => game.sniper.adsK)).toBe(1);
    await frames(page, 4);
    expect(await page.evaluate(() => [document.body.classList.contains('scoped'), game.sniper.rifle.root.visible, game.sniper.fov > 30])).toEqual([false, true, true]);
    await expect(page.locator('#scope')).toBeHidden();
    await page.mouse.up({ button: 'right' });
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 20_000 }).toBeGreaterThan(before);
    // La ballesta: el virote se clava en un alienígena (y va pegado a él) y luego revienta
    await page.evaluate(() => {
        // (en la esquina vecina del campo, donde no hay cultivos que tapen)
        const sn = game.sniper, W = sn.walkers, w = W.spawn(), f = sn.field, c = f.poly[(sn.corner + 1) % f.poly.length];
        sn.endSpecial(); sn.box.pick = 2; sn.giveSpecial(sn.box.weapon);
        w.x = c.x + (f.cx - c.x) * 0.03; w.z = c.z + (f.cz - c.z) * 0.03; w.speed = 0; w.beam = 0; W.place(w); window._alien = w;
    });
    const aliens = await page.evaluate(() => game.sniper.aliens);
    await expect.poll(() => page.evaluate(() => game.sniper.canFire)).toBe(true);
    await aimAndShoot(page, '(() => { const p = window._alien.g.position; return { x: p.x, y: p.y + 1.1, z: p.z }; })()');
    await expect.poll(() => page.evaluate(() => game.sniper.box.shots.some((x) => x.stick && x.fuse >= 0 && !!x.lamp))).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.aliens), { timeout: 25_000 }).toBe(aliens + 1);
    await page.evaluate(() => { const sn = game.sniper; sn.endSpecial(); sn.box.pick = 0; sn.giveSpecial(sn.box.weapon); });
    // Sin munición, otra vez el rifle
    await page.evaluate(() => { game.sniper.ammo = 1; });
    await expect.poll(() => page.evaluate(() => game.sniper.canFire)).toBe(true);
    await aimAndShoot(page, sheaf);
    await expect.poll(() => page.evaluate(() => game.sniper.special)).toBe(null);
    expect(await page.evaluate(() => game.sniper.box.thrown.length)).toBe(1); // (la bazuca, tirada torre abajo)
    await expect(page.locator('#ammo')).not.toHaveClass(/special/);
    await expect(page.locator('#medals')).toContainText('OTRA VEZ EL RIFLE');
    expect(errors).toEqual([]);
});

test('abejas y girasoles: se le dispara a la gota de miel de la abeja; al girasol, solo cuando te mira', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterCrop(page, 'honey');
    expect(await page.evaluate(() => game.sniper.field.sheaves.every((s) => s.bee))).toBe(true);
    await page.evaluate(() => game.sniper.field.sheaves.forEach((s) => { s.w = 0; s.hb = [0.6, 0.8, 0.6]; })); // (quietas y con la gota más grande: que no se escapen de la mira con la máquina cargada)
    await aimAndShoot(page, '(() => { const s = game.sniper.field.sheaves.find((x) => x.alive); return s && { x: s.x, y: s.y, z: s.z }; })()');
    await expect.poll(() => page.evaluate(() => game.state.items.honey)).toBeGreaterThan(0);
    // Girasoles: de espaldas no se les puede dar; de cara, sí
    await page.evaluate(() => game.goFarm());
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('farm');
    await enterCrop(page, 'sunflower');
    const r = await page.evaluate(() => {
        const f = game.sniper.field, s = f.sheaves.find((x) => x.alive), eye = game.sniper.pos;
        const yaw = Math.atan2(eye.x - s.x, eye.z - s.z);
        s.head.rotation.y = yaw + Math.PI;
        const back = f.hittable(s);
        s.head.rotation.y = yaw;
        return [back, f.hittable(s)];
    });
    expect(r).toEqual([false, true]);
    expect(errors).toEqual([]);
});
