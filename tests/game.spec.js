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

// Mantiene pulsado sobre la siguiente mata, espera al zoom y suelta: un disparo
async function shootNext(page) {
    const t = await page.evaluate(() => {
        const s = game.sniper.field.sheaves.find((x) => x.alive);
        return s && { x: s.x, z: s.z };
    });
    if (!t) return false;
    const p = await screenOf(page, 'sniper', t.x, 0.9, t.z);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
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

test('la burbuja de un campo maduro lleva al francotirador; deslizar cambia de torre', async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    await expect(page.locator('#snipe-ui')).toBeVisible();
    await page.mouse.move(300, 420);
    await page.mouse.down();
    await page.mouse.move(120, 425);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => game.sniper.corner)).toBe(1);
    expect(await page.evaluate(() => game.state.wheat)).toBe(0); // deslizar no dispara
    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    expect(errors).toEqual([]);
});

test('mantener apunta, soltar dispara; al recoger todo se vuelve a la granja', async ({ page }) => {
    const errors = watchErrors(page);
    await enterField(page);
    const total = await page.evaluate(() => game.sniper.field.remaining);
    await shootNext(page);
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBe(1);
    await expect(page.locator('#left-count')).toHaveText(String(total - 1));
    // Se puede disparar mientras se salta de torre
    await page.locator('#btn-next').click();
    await page.waitForTimeout(800);
    for (let k = 0; k < total * 3; k++) {
        if (!(await shootNext(page))) break;
        await page.waitForTimeout(500); // cerrojo
    }
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 20_000 }).toBe('farm');
    expect(await page.evaluate(() => game.state.wheat)).toBe(total);
    await expect(page.locator('#wheat-count')).toHaveText(String(total));
    expect(errors).toEqual([]);
});
