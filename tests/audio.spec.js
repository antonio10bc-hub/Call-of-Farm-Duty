// El sonido: cada efecto y cada tema de música suenan (no se quedan en silencio), sin errores y
// sin saturar. Se renderizan con un contexto de audio sin conexión (más rápido que en tiempo real)
const { test, expect, watchErrors } = require('./helpers');

test('sonido: cada efecto y cada tema de música suenan sin errores y sin saturar', { tag: '@full' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/fonts/OFL.txt'); // (una página del sitio cualquiera: para importar los módulos)
    const r = await page.evaluate(async () => {
        const { Sfx } = await import('/src/core/Audio.js');
        const { Music } = await import('/src/core/Music.js');
        const { THEMES } = await import('/src/content/music.js');
        const SR = 22050, peakOf = (buf, a = 0, b = buf.length) => {
            let p = 0;
            for (let ch = 0; ch < 2; ch++) {
                const d = buf.getChannelData(ch);
                for (let i = a; i < b; i++) p = Math.max(p, Math.abs(d[i]) || (Number.isNaN(d[i]) ? 9 : 0));
            }
            return p;
        };
        // Todos los efectos (los nombres, de su switch) y las llegadas de los mercaderes
        const src = await (await fetch('/src/core/Audio.js')).text();
        // (los de los cultivos son las capas de la cosecha: suenan dentro de harvest)
        const crops = ['wheat', 'tomato', 'pumpkin', 'corn', 'sunflower', 'milk', 'wool', 'egg', 'truffle', 'fish', 'honey', 'range'];
        const names = [...src.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]).filter((n) => !crops.includes(n));
        const list = [...new Set(names)].map((n) => ['play', n]).concat(['car', 'bus', 'mini', 'icecream', 'truck', 'camper', 'tractor', 'mother'].map((v) => ['vehicle', v]));
        const GAP = 1.2, ctx = new OfflineAudioContext(2, SR * (list.length * GAP + 1), SR), s = new Sfx();
        s.init(ctx);
        Object.defineProperty(s, 'ok', { value: true });
        list.forEach(([how, n], i) => ctx.suspend(0.1 + i * GAP).then(() => {
            if (how === 'vehicle') s.vehicle(n, true);
            else s.play(n, 0, { crop: 'wheat' });
            ctx.resume();
        }));
        const buf = await ctx.startRendering();
        const sfx = list.map(([, n], i) => [n, peakOf(buf, Math.floor((0.1 + i * GAP) * SR), Math.floor((0.1 + (i + 1) * GAP) * SR))]);
        // Cada tema de música, y el paso de uno a otro sin cortarse
        const music = [];
        for (const key of Object.keys(THEMES)) {
            const c = new OfflineAudioContext(2, SR * 6, SR), s2 = new Sfx();
            s2.init(c);
            const m = new Music(s2);
            m.start(THEMES[key]);
            clearInterval(m.timer);
            m.fill(3);
            m.set(THEMES.farm);
            m.fill(6);
            const b = await c.startRendering();
            music.push([key, peakOf(b, SR * 2), m.theme === THEMES.farm]);
        }
        return { sfx, music, count: list.length };
    });
    expect(r.count).toBeGreaterThan(80);
    // Que suenen (algo por encima de -60 dB) y sin saturar (por debajo de 0 dB)
    expect(r.sfx.filter(([, p]) => !(p > 0.001 && p < 1)).map(([n]) => n)).toEqual([]);
    expect(r.music.filter(([, p, switched]) => !(p > 0.003 && p < 1) || !switched).map(([n]) => n)).toEqual([]);
    expect(errors.filter((e) => !e.includes('404'))).toEqual([]); // (el icono de la pestaña, que esta página no tiene)
});
