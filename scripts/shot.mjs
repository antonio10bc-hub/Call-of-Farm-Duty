// npm run shot -- [opciones]: capturas del juego de verdad (para revisar cambios visuales sin
// escribir un script cada vez). Arranca su propio servidor, abre el juego con ?test (de día, sin
// partículas), prepara la escena y guarda una captura por cada --at (o una sola).
//
//   --at nombre:x,z   cámara sobre (x, z) en coordenadas de parcela (se repite: una captura por cada una)
//   --zoom n          zoom de la cámara (0.6 cerca, 1 normal, 2 lejos)        [1]
//   --map             vista MAPA (todo el valle)
//   --unlock a,b      desbloquea esos campos (wheat, tomato, pumpkin, corn, milk, wool, egg)
//   --level n         pone esos campos a ese nivel (0-4)
//   --merchant        el mercader aquí (espera a que monte el puesto)
//   --trust n         confianza del mercader (puntos: 0, 4, 10, 20, 35 = niveles 1-5)
//   --own all|a,b     colección del mercader (todas o esas piezas)
//   --snipe cultivo   entra al campo de tiro de ese cultivo (lo desbloquea) y espera a que brote
//   --eval "js"       código que se ejecuta en la página antes de capturar
//   --wait ms         espera antes de cada captura                          [2500]
//   --size WxH        tamaño de la ventana                                   [900x600]
//   --mobile          390x760 (como las pruebas)
//   --scale n         píxeles por punto (2 para verla de cerca)              [1]
//   --clip x,y,w,h    solo ese trozo de la pantalla
//   --regions         además, regions.png: el reparto del valle en zonas, con sus semillas
//   --out dir         carpeta de salida                                      [test-results/shots]
//
// Ejemplos:
//   npm run shot -- --unlock milk,wool,egg --level 4 --at vacas:-15,-15 --at ovejas:75,-15 --zoom 1.4
//   npm run shot -- --merchant --trust 35 --own all --at puesto:41,-13 --zoom 0.9
//   npm run shot -- --map --regions
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2), opt = { at: [] };
for (let i = 0; i < args.length; i++) {
    const k = args[i].replace(/^--/, '');
    const flag = ['map', 'merchant', 'mobile', 'regions'].includes(k);
    const v = flag ? true : args[++i];
    if (k === 'at') opt.at.push(v);
    else opt[k] = v;
}
const out = opt.out || 'test-results/shots';
mkdirSync(out, { recursive: true });
const PORT = 3400 + Math.floor(Math.random() * 400);
const [W, H] = opt.mobile ? [390, 760] : (opt.size || '900x600').split('x').map(Number);

// El servidor (el de siempre, en un puerto libre)
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let k = 0; k < 50; k++) {
    try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(opt.scale || 1) });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?test`);
await page.waitForFunction(() => window.game && game.farm && game.farm.introT > 2.5, null, { timeout: 120000 });
const wait = (ms = +(opt.wait || 2500)) => page.waitForTimeout(ms);

// La escena
const list = (s) => (s ? String(s).split(',') : []);
await page.evaluate(([unlock, level]) => {
    for (const id of unlock) game.state.unlock(id, Date.now(), true);
    while (game.revealUnlocked());
    if (level !== null) for (const id of unlock) { game.state.fields[id].level = level; game.farm.setLevel(id, level); }
}, [list(opt.unlock), opt.level === undefined ? null : +opt.level]);
if (opt.merchant || opt.trust !== undefined || opt.own) {
    await page.evaluate(([trust, own]) => {
        const S = game.state;
        S.story.merchant = true;
        if (trust !== null) S.merchant.trust = trust;
        if (own) S.merchant.owned = own === 'all' ? ['gnome', 'duckhat', 'flamingo', 'banner', 'trophy', 'discoball', 'statue'] : own.split(',');
        S.save();
        game.merchantClock.force = 'here';
    }, [opt.trust === undefined ? null : +opt.trust, opt.own || null]);
    await page.waitForFunction(() => game.farm.camp.open, null, { timeout: 120000 });
}
if (opt.snipe) {
    await page.evaluate((id) => { game.state.unlock(id, Date.now(), true); while (game.revealUnlocked()); game.harvest(id); }, opt.snipe);
    await page.waitForFunction(() => game.mode === 'snipe' && game.sniper.field.targets.every((s) => s.landed), null, { timeout: 120000 });
    await page.evaluate(() => { game.sniper.flyers.next = Infinity; game.sniper.walkers.reset(); game.sniper.walkers.next = Infinity; });
}
if (opt.eval) await page.evaluate(opt.eval);
if (opt.map) await page.click('#btn-map');

const clip = opt.clip ? (([x, y, w, h]) => ({ x, y, width: w, height: h }))(opt.clip.split(',').map(Number)) : undefined;
const shots = [];
const shoot = async (name) => {
    const file = join(out, `${name}.png`);
    await page.screenshot({ path: file, clip });
    shots.push(file);
};
if (opt.at.length) {
    for (const a of opt.at) {
        const [name, xz] = a.includes(':') ? a.split(':') : [`at-${a}`, a];
        const [x, z] = xz.split(',').map(Number);
        await page.evaluate(([x, z, zoom]) => { game.rig.focus(x, z); game.rig.zoomTarget = zoom; }, [x, z, +(opt.zoom || 1)]);
        await wait();
        await shoot(name);
    }
} else {
    if (opt.zoom && !opt.map) await page.evaluate((z) => { game.rig.zoomTarget = z; }, +opt.zoom);
    await wait();
    await shoot(opt.map ? 'map' : opt.snipe ? `snipe-${opt.snipe}` : 'shot');
}

// El reparto del valle en zonas (como el mini-mapa, en grande y con las semillas)
if (opt.regions) {
    const url = await page.evaluate(async () => {
        const m = await import('/src/world/valley.js'), S = 4, N = 260;
        const c = document.createElement('canvas'), x = c.getContext('2d');
        c.width = c.height = N * S;
        const col = ['#d6be8c', '#e6c850', '#dc503c', '#f0aaaa', '#468232', '#c8e6a0', '#ebebe1', '#fadca0', '#f08c32', '#e6dc5a', '#b4a050', '#8c7850', '#a0c8a0', '#6a8a6a'];
        for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
            const [wx, wz] = m.toXZ(px - 20, py - 36), k = m.cellIndex(wx, wz);
            x.fillStyle = k < 0 || !m.G.inside[k] ? '#333' : m.G.water[k] ? '#4aa8e0' : m.G.reg[k] >= 0 ? col[m.G.reg[k] % col.length] : m.G.h[k] > 18 ? '#888' : '#5a7a4a';
            x.fillRect(px * S, py * S, S, S);
        }
        x.font = 'bold 22px monospace';
        x.fillStyle = '#000';
        m.REGIONS.forEach((r) => r.seeds.forEach(([u, v]) => { x.fillRect((u + 20) * S - 4, (v + 36) * S - 4, 8, 8); x.fillText(r.place, (u + 20) * S + 6, (v + 36) * S); }));
        const n = {};
        for (let k = 0; k < m.G.reg.length; k++) if (m.G.reg[k] >= 0 && m.G.inside[k]) n[m.REGIONS[m.G.reg[k]].place] = (n[m.REGIONS[m.G.reg[k]].place] || 0) + 1;
        return [c.toDataURL(), n];
    });
    writeFileSync(join(out, 'regions.png'), Buffer.from(url[0].split(',')[1], 'base64'));
    shots.push(join(out, 'regions.png'));
    console.log('celdas por zona:', JSON.stringify(url[1]));
}

console.log(shots.join('\n'));
if (errors.length) console.log('ERRORES EN LA PÁGINA:\n' + [...new Set(errors)].join('\n'));
await browser.close();
stop();
process.exit(errors.length ? 1 : 0);
