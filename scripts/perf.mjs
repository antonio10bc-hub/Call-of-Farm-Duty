// npm run perf -- [--out archivo.json] [--compare viejo.json]: mide el coste de dibujar el juego en
// vistas fijas (con todo desbloqueado al nivel 4, todo el pueblo comprado y ampliado). Por vista:
// llamadas de dibujo, triángulos y datos subidos a la GPU por fotograma (contados enganchando
// WebGL, así vale para cualquier versión) y el tiempo de JS por fotograma (mediana y p95; con
// SwiftShader solo vale para comparar). Escribe una tabla y, con --out, el JSON; con --compare,
// la diferencia con una medida anterior.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i += 2) opt[args[i].replace(/^--/, '')] = args[i + 1];
const PORT = 3800 + Math.floor(Math.random() * 400);
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let k = 0; k < 50; k++) {
    try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 760 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
// El enganche a WebGL: cuenta llamadas, triángulos e instancias, y bytes subidos
await page.addInitScript(() => {
    const P = (window.__gl = { calls: 0, tris: 0, bytes: 0 });
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
        if (!C) continue;
        const p = C.prototype, wrap = (name, f) => { const o = p[name]; if (o) p[name] = function (...a) { f(a); return o.apply(this, a); }; };
        wrap('drawElements', (a) => { P.calls++; P.tris += a[1] / 3; });
        wrap('drawArrays', (a) => { P.calls++; P.tris += a[2] / 3; });
        wrap('drawElementsInstanced', (a) => { P.calls++; P.tris += (a[1] / 3) * a[4]; });
        wrap('drawArraysInstanced', (a) => { P.calls++; P.tris += (a[2] / 3) * a[3]; });
        wrap('bufferData', (a) => { if (a[1] && a[1].byteLength) P.bytes += a[1].byteLength; });
        wrap('bufferSubData', (a) => { if (a[2] && a[2].byteLength) P.bytes += a[2].byteLength; });
    }
});
await page.goto(`http://localhost:${PORT}/?test`);
await page.waitForFunction(() => window.game && game.farm && game.farm.introT > 2.5, null, { timeout: 180000 });
// La escena: todo al máximo
await page.evaluate(() => {
    const S = game.state;
    for (const id of ['wheat', 'tomato', 'pumpkin', 'corn', 'milk', 'wool', 'egg', 'truffle', 'fish', 'honey', 'sunflower']) {
        if (!S.fields[id]) continue;
        S.unlock(id, Date.now(), true);
        while (game.revealUnlocked());
        S.fields[id].level = 4;
        game.farm.setLevel(id, 4);
    }
    S.story.merchant = true;
    S.village = [...game.allDecor];
    S.town = game.farm.village.planCount;
    game.syncMerchantLife(false);
    game.select(null);
});
await page.waitForTimeout(3000);
// Mide n fotogramas en la vista que hay
const measure = (n = 60) => page.evaluate((n) => new Promise((done) => {
    const P = window.__gl, times = [];
    let k = 0, t0 = 0, c0 = 0, tr0 = 0, b0 = 0;
    const step = (t) => {
        if (k === 5) { c0 = P.calls; tr0 = P.tris; b0 = P.bytes; t0 = t; }
        if (k > 5) times.push(t - t0), (t0 = t);
        if (++k < n + 6) return requestAnimationFrame(step);
        times.sort((a, b) => a - b);
        done({ calls: Math.round((P.calls - c0) / n), tris: Math.round((P.tris - tr0) / n), kb: Math.round((P.bytes - b0) / n / 1024), ms: +times[times.length >> 1].toFixed(1), p95: +times[Math.floor(times.length * 0.95)].toFixed(1) });
    };
    requestAnimationFrame(step);
}), n);
const VIEWS = [
    ['granja', 15, 15, 1], ['pueblo', 41, -13, 1], ['pueblo lejos', 41, -13, 2], ['colmenar', 75, 15, 1], ['girasoles', 75, 45, 1],
    ['trigo', 105, 15, 1], ['pozo', 135, 15, 1], ['recinto', 20, 12, 1.4], ['vacas', -15, -15, 1.2],
];
const res = {};
for (const [name, x, z, zoom] of VIEWS) {
    await page.evaluate(([x, z, zoom]) => { game.rig.focus(x, z); game.rig.zoomTarget = zoom; }, [x, z, zoom]);
    await page.waitForTimeout(2500);
    res[name] = await measure();
}
await page.locator('#btn-map').click();
await page.waitForTimeout(3000);
res.mapa = await measure();
await page.locator('#btn-map').click();
await page.evaluate(() => game.harvest('honey'));
await page.waitForFunction(() => game.mode === 'snipe', null, { timeout: 60000 });
await page.waitForTimeout(4000);
res['tiro miel'] = await measure();
await browser.close();
// La tabla (y la diferencia con la medida anterior)
const old = opt.compare ? JSON.parse(readFileSync(opt.compare, 'utf8')) : null;
const d = (a, b) => (b === undefined ? '' : ` (${a - b >= 0 ? '+' : ''}${Math.round(a - b)})`);
console.log('| vista | llamadas | triángulos | KB/fot. | ms (p95) |\n|---|---|---|---|---|');
for (const [k, v] of Object.entries(res)) {
    const o = old ? old[k] : undefined;
    console.log(`| ${k} | ${v.calls}${o ? d(v.calls, o.calls) : ""} | ${Math.round(v.tris / 1000)}k${o ? d(v.tris / 1000, o.tris / 1000) : ''} | ${v.kb}${o ? d(v.kb, o.kb) : ""} | ${v.ms} (${v.p95}) |`);
}
if (opt.out) {
    mkdirSync(dirname(opt.out), { recursive: true });
    writeFileSync(opt.out, JSON.stringify(res, null, 1));
}
process.exit(0);
