// Utilidades de las pruebas del juego (en un navegador de verdad: mapa de la granja → tocar
// edificios → recoger un campo → francotirador...). Todas abren el juego con ?test (se dibuja
// más barato: menos resolución, sin partículas y a 30 fps; la lógica es la misma) y al acabar
// cada prueba se para el bucle del juego.
const base = require('@playwright/test');

const test = base.test.extend({
    page: async ({ page }, use) => {
        await use(page);
        await page.evaluate(() => window.game && game.pause()).catch(() => {});
    },
});
const { expect } = base;

// Espera a que se dibujen n fotogramas (en vez de esperar un tiempo fijo)
async function frames(page, n = 2) {
    await page.evaluate((n) => new Promise((r) => {
        const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
        requestAnimationFrame(step);
    }), n);
}

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
    await page.goto('/?test');
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
    // Sin ovnis pequeños que se crucen en los disparos de las pruebas (su prueba los saca a mano)
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; });
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
    await frames(page);
    await page.mouse.up({ button: 'right' });
    return true;
}

// Apunta con la mira asentada a un punto (que se vuelve a calcular justo antes de soltar) y dispara
async function aimAndShoot(page, where) {
    const look = `(() => { const p = ${where}; if (p) game.sniper.lookAt(p.x, p.y, p.z); })()`;
    await page.evaluate(look);
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => page.evaluate(() => game.sniper.adsK === 1 && game.sniper.spread < 0.002), { timeout: 20_000 }).toBe(true);
    await page.evaluate(look);
    await frames(page);
    await page.mouse.up({ button: 'right' });
}

// Al campo de tiro con el trigo al máximo (32 matas: sitio para encadenar rachas)
async function enterBigField(page, streaks = ['grenade', 'predator']) {
    await openFarm(page);
    // Granero al máximo (todas las rachas desbloqueadas) y las pedidas equipadas
    await page.evaluate((s) => { game.state.barn.level = 5; game.state.streaks = s; }, streaks);
    await page.evaluate(() => { game.state.wheat = 12; for (let i = 0; i < 4; i++) game.upgradeField('wheat'); game.state.wheat = 0; game.select(null); });
    const bubble = page.locator('.bubble:not(.hidden)').first();
    await bubble.click();
    await expect.poll(() => page.evaluate(() => game.mode)).toBe('snipe');
    await expect.poll(() => page.evaluate(() => game.sniper.field.sheaves.every((s) => s.landed)), { timeout: 20_000 }).toBe(true);
    // Sin ovnis pequeños que se crucen en los disparos de las pruebas (su prueba los saca a mano)
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; });
}

module.exports = { test, expect, frames, watchErrors, screenOf, openFarm, enterField, touchPath, shootNext, aimAndShoot, enterBigField };
