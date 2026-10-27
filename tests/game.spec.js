// Flujos principales en un navegador de verdad: granja → recoger → francotirador → volver.
const { test, expect } = require('@playwright/test');

function watchErrors(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    return errors;
}

// Apunta (como un toque fuera de la mira) al primer haz vivo y devuelve cuántos quedan
async function aimNext(page) {
    return page.evaluate(() => {
        const sn = game.sniper;
        const s = sn.field.sheaves.find((x) => x.alive && x.landed);
        if (!s) return sn.field.remaining;
        sn.setScoped(false);
        sn.aimYaw = sn.aimPitch = 0;
        sn.update(0.001);
        const v = s.model.root.position.clone();
        v.y = 0.55;
        v.project(sn.camera);
        sn.scopeAt(v.x, v.y);
        return sn.field.remaining;
    });
}

test('la granja carga con el botón de recoger', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('#btn-harvest')).toBeVisible();
    await expect(page.locator('#wheat-count')).toHaveText('0');
    expect(await page.evaluate(() => game.mode)).toBe('farm');
    expect(errors).toEqual([]);
});

test('recoger lleva al francotirador y se puede volver en cualquier momento', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.locator('#btn-harvest').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect(page.locator('#snipe-ui')).toBeVisible();
    expect(await page.evaluate(() => game.sniper.field.remaining)).toBeGreaterThan(0);

    // Deslizar cambia de esquina
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.mouse.move(120, 405, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => game.sniper.corner)).toBe(1);

    await page.locator('#btn-home').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('farm');
    await expect(page.locator('#farm-ui')).toBeVisible();
    expect(errors).toEqual([]);
});

test('disparar a un haz lo recoge y al terminar se vuelve a la granja', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.locator('#btn-harvest').click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    const total = await page.evaluate(() => game.sniper.field.remaining);
    // Esperar a que todos los haces hayan caído
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 10_000 }).toBe(true);

    await aimNext(page);
    await page.waitForTimeout(400);
    await expect(page.locator('#btn-fire')).toBeVisible();
    await page.locator('#btn-fire').click();
    await expect.poll(() => page.evaluate(() => game.state.wheat)).toBe(1);
    await expect(page.locator('#left-count')).toHaveText(String(total - 1));

    for (let k = 0; k < total + 5; k++) {
        await page.waitForTimeout(800); // cerrojo
        if (!(await aimNext(page))) break;
        await page.waitForTimeout(250);
        await page.evaluate(() => game.sniper.fire());
    }
    await expect.poll(() => page.evaluate(() => game.mode), { timeout: 10_000 }).toBe('farm');
    expect(await page.evaluate(() => game.state.wheat)).toBe(total);
    await expect(page.locator('#wheat-count')).toHaveText(String(total));
    expect(errors).toEqual([]);
});
