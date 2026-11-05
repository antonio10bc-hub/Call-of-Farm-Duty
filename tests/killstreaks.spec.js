// Pruebas de las dos rachas de bajas: la de granadas (fragmentación, racimo e incendiaria, al
// recoger) y la alienígena (misil Predator, bombardero y bomba nuclear, al abatir alienígenas que
// cruzan el campo a pie).
const { test, expect, aimAndShoot, enterBigField, shootNext, watchErrors } = require('./helpers');

test('racha de granadas: la barra sale al recoger y se vacía; a las 5, 10 y 15 salen fragmentación, racimo e incendiaria', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    await shootNext(page);
    await expect.poll(() => page.evaluate(() => game.sniper.streak)).toBeGreaterThan(0);
    await expect(page.locator('#streak')).toBeVisible();
    await expect(page.locator('#streak-next')).toContainText('FRAGMENTACIÓN');
    // Si la barra se vacía, la racha se pierde
    await page.evaluate(() => { game.sniper.streakT = 0.01; });
    await expect.poll(() => page.evaluate(() => game.sniper.streak)).toBe(0);
    await expect(page.locator('#streak')).toBeHidden();
    // A las 5: fragmentación (sola), que recoge lo que pilla al explotar
    let before = await page.evaluate(() => game.state.wheat);
    await page.evaluate(() => game.sniper.addStreak(5));
    await expect(page.locator('#medals')).toContainText('FRAGMENTACIÓN');
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 5_000 }).toBeGreaterThan(before);
    // A las 10: racimo, que al caer suelta mini granadas
    await page.evaluate(() => { const s = game.sniper; s.addStreak(10 - s.streak); });
    await expect(page.locator('#medals')).toContainText('RACIMO');
    await expect.poll(() => page.evaluate(() => game.sniper.ks.bomblets.length), { timeout: 5_000 }).toBeGreaterThan(0);
    // A las 15: incendiaria; su fuego quema lo de alrededor y a un alienígena que pase por él
    await page.evaluate(() => { const s = game.sniper; s.streakT = 99; s.addStreak(15 - s.streak); });
    await expect(page.locator('#medals')).toContainText('INCENDIARIA');
    await expect.poll(() => page.evaluate(() => game.sniper.ks.fires.length), { timeout: 5_000 }).toBe(1);
    before = await page.evaluate(() => game.sniper.aliens);
    await page.evaluate(() => {
        const f = game.sniper.ks.fires[0], W = game.sniper.walkers, w = W.spawn();
        w.x0 = f.x; w.z0 = f.z; w.dist = 0; w.speed = 0; w.beam = 0; W.place(w);
    });
    await expect.poll(() => page.evaluate(() => game.sniper.aliens), { timeout: 5_000 }).toBe(before + 1);
    expect(errors).toEqual([]);
});

test('alienígenas a pie: cruzan el campo a distintas velocidades, se van por el otro lado y abatirlos llena la racha alienígena', { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    // La racha alienígena se ve desde el principio, a la izquierda, con sus 3 recompensas
    await expect(page.locator('#alien-streak')).toBeVisible();
    await expect(page.locator('#as-n')).toHaveText('0');
    await expect(page.locator('.as-mile')).toHaveCount(3);
    await expect(page.locator('.as-seg')).toHaveCount(10); // una raya por alienígena hasta la nuclear
    await expect(page.locator('.as-seg.on')).toHaveCount(0);
    // Van saliendo solos, cada uno a su paso
    await page.evaluate(() => { game.sniper.walkers.next = 0; });
    await expect.poll(() => page.evaluate(() => game.sniper.walkers.list.length)).toBeGreaterThan(0);
    const speeds = await page.evaluate(() => { const W = game.sniper.walkers; for (let i = 0; i < 12; i++) W.spawn(); return new Set(W.list.map((w) => Math.round(w.speed))).size; });
    expect(speeds).toBeGreaterThan(1);
    // Al llegar al otro lado desaparecen
    await page.evaluate(() => { game.sniper.walkers.next = Infinity; for (const w of game.sniper.walkers.list) w.dist = w.len - 0.01; });
    await expect.poll(() => page.evaluate(() => game.sniper.walkers.list.length)).toBe(0);
    // Uno quieto en el campo: se le dispara con la mira y cuenta para la racha
    await page.evaluate(() => { const w = game.sniper.walkers.spawn(); w.dist = w.len / 2; w.speed = 0; w.beam = 0; game.sniper.walkers.place(w); });
    await aimAndShoot(page, '(() => { const w = game.sniper.walkers.list.find((x) => x.alive); return w && { x: w.g.position.x, y: 1, z: w.g.position.z }; })()');
    await expect.poll(() => page.evaluate(() => game.sniper.aliens)).toBe(1);
    await expect(page.locator('#as-n')).toHaveText('1');
    await expect(page.locator('.as-seg.on')).toHaveCount(1);
    await expect(page.locator('.kill-pop')).toHaveCount(1); // su +1 encima de la cabeza
    await expect(page.locator('#hitmarker')).toHaveClass(/on/);
    await expect(page.locator('#medals')).toContainText('ALIEN ABATIDO');
    // Los ovnis pequeños también cuentan; a los 3, el misil Predator
    await page.evaluate(() => { const f = game.sniper.flyers.spawn(); game.sniper.flyers.shoot(f); game.sniper.addAlien(1); });
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.predator)).toBe(true);
    await expect(page.locator('#as-predator')).toHaveClass(/done/);
    expect(errors).toEqual([]);
});

test('racha alienígena de 3: misil Predator con vista cenital, se guía y se acelera, y explota recogiendo', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    await page.evaluate(() => game.sniper.addAlien(3));
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.predator)).toBe(true);
    await expect(page.locator('#predator-hud')).toBeVisible();
    await expect(page.locator('#medals')).toContainText('MISIL PREDATOR');
    // Mirando hacia abajo desde lo alto; mover la vista mueve el misil y el gatillo lo acelera
    await expect.poll(() => page.evaluate(() => game.sniper.camera.position.y)).toBeGreaterThan(20);
    const x0 = await page.evaluate(() => game.sniper.ks.predator.x + game.sniper.ks.predator.z);
    await page.keyboard.down('d');
    await expect.poll(() => page.evaluate((x0) => Math.abs(game.sniper.ks.predator.x + game.sniper.ks.predator.z - x0) > 0.05, x0)).toBe(true);
    await page.keyboard.up('d');
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => game.sniper.ks.predator.boost)).toBe(true);
    // Mientras se guía, la racha de granadas no se pierde
    expect(await page.evaluate(() => game.sniper.ks.paused)).toBe(true);
    // Un alienígena justo debajo: el misil también lo abate
    await page.evaluate(() => {
        const p = game.sniper.ks.predator, W = game.sniper.walkers, w = W.spawn();
        w.x0 = p.x; w.z0 = p.z; w.dist = 0; w.speed = 0; w.beam = 0; W.place(w);
        window.predLow = 99;
        const tick = () => { const q = game.sniper.ks.predator; if (q) { window.predLow = Math.min(window.predLow, q.y); requestAnimationFrame(tick); } };
        tick();
    });
    await expect.poll(() => page.evaluate(() => game.sniper.ks.predator), { timeout: 10_000 }).toBe(null);
    await expect(page.locator('#predator-hud')).toBeHidden();
    expect(await page.evaluate(() => game.sniper.aliens)).toBe(4);
    // La vista del misil se corta al tocar el suelo (no vuelve a subir para ver la explosión)
    expect(await page.evaluate(() => window.predLow)).toBeLessThan(5);
    expect(await page.evaluate(() => game.state.wheat)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});

test('racha alienígena de 6 y 10: bombardero que bombardea el campo y bomba nuclear que lo recoge todo', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await enterBigField(page);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    // (de 3 en 3 saldría antes el Predator: se llega a 6 de golpe desde 5)
    await page.evaluate(() => { game.sniper.aliens = 5; game.sniper.addAlien(1); });
    await expect.poll(() => page.evaluate(() => !!game.sniper.ks.plane)).toBe(true);
    await expect.poll(() => page.evaluate(() => game.sniper.ks.bombs.length > 0), { timeout: 8_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => !game.sniper.ks.plane), { timeout: 25_000 }).toBe(true); // en el campo grande el avión tarda más en cruzar
    await expect.poll(() => page.evaluate(() => game.state.wheat), { timeout: 5_000 }).toBeGreaterThan(0);
    // Nuclear a los 10: cuenta atrás de 5 y lo que quede, recogido; también caen los alienígenas
    // del campo y los ovnis del cielo
    await page.evaluate(() => { game.sniper.aliens = 9; game.sniper.addAlien(1); });
    await page.evaluate(() => { const W = game.sniper.walkers, w = W.spawn(); w.speed = 0; w.beam = 0; game.sniper.flyers.spawn(); });
    const aliens = await page.evaluate(() => game.sniper.aliens);
    await expect(page.locator('#nuke-count')).toBeVisible();
    await expect(page.locator('#nuke-n')).toHaveText(/^[1-5]$/);
    await expect.poll(() => page.evaluate(() => game.sniper.field.remaining), { timeout: 40_000 }).toBe(0);
    expect(await page.evaluate(() => game.sniper.aliens)).toBe(aliens + 2);
    await expect(page.locator('#nuke-haze')).toHaveCSS('opacity', '1', { timeout: 5_000 }); // neblina radiactiva
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 15_000 }).toBe('farm');
    expect(await page.evaluate(() => game.state.wheat)).toBe(total);
    expect(errors).toEqual([]);
});
