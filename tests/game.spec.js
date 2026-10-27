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

async function enterField(page) {
    await page.goto('/');
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
    await expect.poll(() => page.evaluate(() => game.sniper.canFire && !game.sniper.scoped && !game.sniper.moving), { timeout: 10_000 }).toBe(true);
    await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        if (s) game.sniper.lookAt(s.x, 0.9, s.z);
    });
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 5_000 }).toBe(true);
    // La vista puede haberse movido (salto de torre en curso): se vuelve a centrar la mata
    await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        if (s) game.sniper.lookAt(s.x, 0.9, s.z);
    });
    await page.waitForTimeout(60);
    await page.mouse.up({ button: 'right' });
    return true;
}

test('la granja es un mapa: tocar el granero abre su ficha', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.bubble:not(.hidden)').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#wheat-count')).toHaveText('0');
    const p = await screenOf(page, 'map', 15, 1.4, 11);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#panel')).toBeVisible();
    await expect(page.locator('#panel-title')).toHaveText('GRANERO');
    await page.locator('#panel-close').click();
    await expect(page.locator('#panel')).toBeHidden();
    // Arrastrar desplaza el mapa
    const before = await page.evaluate(() => game.rig.fx + game.rig.fz);
    await page.mouse.move(200, 400);
    await page.mouse.down();
    await page.mouse.move(120, 300, { steps: 6 });
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
    expect(await page.evaluate(() => game.sniper.scoped)).toBe(true);
    // Con la mira arriba y asentada el tiro es preciso
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 5_000 }).toBe(true);
    await touchPath(page, [['pointerup', 200, 400, 0]]);
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBe(1);
    // Sin mira la dispersión es grande (no scope) y un toque rápido dispara desde la cadera
    await expect.poll(() => page.evaluate(() => game.sniper.canFire && game.sniper.adsK === 0), { timeout: 10_000 }).toBe(true);
    expect(await page.evaluate(() => game.sniper.spread)).toBeGreaterThan(0.05);
    await touchPath(page, [['pointerdown', 200, 400, 40], ['pointerup', 200, 400, 0]]);
    expect(await page.evaluate(() => game.sniper.bolt)).toBeGreaterThan(0);
    // Deslizar desde el borde izquierdo hacia dentro: torre anterior
    await touchPath(page, [['pointerdown', 6, 400, 16], ['pointermove', 60, 402, 16], ['pointermove', 120, 404, 16], ['pointerup', 120, 404, 0]]);
    await expect.poll(() => page.evaluate(() => game.sniper.corner)).toBe(3);
    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    expect(errors).toEqual([]);
});

test('ratón: botón derecho apunta y al soltar dispara; al recoger todo se vuelve a la granja', async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    await shootNext(page);
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBe(1);
    await expect(page.locator('#left-count')).toHaveText(String(total - 1));
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
