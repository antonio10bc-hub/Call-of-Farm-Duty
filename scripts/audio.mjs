// Escuchar el audio del juego sin jugar: renderiza en un navegador sin pantalla (con un contexto
// de audio sin conexión, más rápido que en tiempo real) la música de cada sitio, un recorrido de
// granja en granja y todos los efectos, y los guarda en WAV. Imprime el pico y el volumen medio de
// cada cosa (en dBFS) para revisar la mezcla.
//
//   node scripts/audio.mjs [--out dir] [--sec 22] [--only farm,wheat] [--night]
//
// Deja en --out (test-results/audio): music-<tema>.wav, tour.wav (la misma canción pasando por
// todas las granjas) y sfx.wav (todos los efectos seguidos, con su lista en sfx.txt).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) {
    const k = args[i].replace(/^--/, '');
    opt[k] = k === 'night' ? true : args[++i];
}
const out = opt.out || 'test-results/audio';
mkdirSync(out, { recursive: true });
const PORT = 3400 + Math.floor(Math.random() * 400);
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let k = 0; k < 50; k++) {
    try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(`http://localhost:${PORT}/fonts/OFL.txt`); // (cualquier página del sitio: para importar los módulos)

// Los efectos que se escuchan, en este orden (con un hueco entre uno y otro)
const SFX = [
    ['ui', 'tab', 'open', 'close', 'deny', 'tick'],
    ['coin', 'buy', 'sell', 'gift', 'itemSpawn', 'spot', 'shieldGet', 'bounceGet'],
    ['build', 'upgrade', 'power', 'unlock', 'land', 'achievement', 'village', 'market', 'win', 'secret', 'go', 'warn', 'ring'],
    ['wishCoin', 'charge', 'tierCommon', 'tierRare', 'tierEpic', 'itemPick'],
    ['snipe', 'bolt', 'scopeIn', 'scopeOut', 'reload', 'reloaded', 'miss', 'wall', 'corner', 'tink', 'hitmark', 'turret', 'stolen', 'grabOther'],
    ['harvest:wheat', 'harvest:tomato', 'harvest:pumpkin', 'harvest:corn', 'harvest:sunflower', 'harvest:milk', 'harvest:wool', 'harvest:egg', 'harvest:truffle', 'harvest:fish', 'harvest:honey'],
    ['moo', 'cluck', 'bleat', 'baa', 'oink', 'buzz', 'bubble', 'splat', 'boing', 'sand', 'metal', 'drop', 'crateHit', 'crateBreak'],
    ['dawn', 'dusk', 'vehicle:car', 'vehicle:bus', 'vehicle:mini', 'vehicle:icecream', 'vehicle:truck', 'vehicle:camper', 'vehicle:tractor', 'vehicle:mother', 'vehicle:leave'],
    ['grenade', 'boom', 'missile', 'siren', 'ufo', 'laser', 'whoosh'],
].flat();

const res = await page.evaluate(async ({ sec, only, night, sfxList }) => {
    const { Sfx } = await import('/src/core/Audio.js');
    const { Music } = await import('/src/core/Music.js');
    const { THEMES } = await import('/src/content/music.js');
    const SR = 44100;
    const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);
    const stats = (buf, a = 0, b = buf.length) => {
        let peak = 0, sum = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = a; i < b; i++) {
                const v = Math.abs(d[i]);
                if (v > peak) peak = v;
                sum += v * v;
            }
        }
        return { peak: db(peak), rms: db(Math.sqrt(sum / ((b - a) * buf.numberOfChannels))) };
    };
    // WAV de 16 bits, estéreo, en base64
    const wav = (buf) => {
        const n = buf.length, dv = new DataView(new ArrayBuffer(44 + n * 4));
        const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
        w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
        dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        for (let i = 0; i < n; i++) {
            dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
            dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
        }
        let s = '';
        const u8 = new Uint8Array(dv.buffer);
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
    };
    const music = async (plan, total) => {
        const ctx = new OfflineAudioContext(2, SR * total, SR), s = new Sfx();
        s.init(ctx);
        const m = new Music(s);
        m.night = night;
        m.start(THEMES[plan[0][0]]);
        clearInterval(m.timer);
        // (cada tema, desde su segundo: entra al compás siguiente, como en el juego)
        plan.forEach(([key, at], i) => {
            m.fill(at);
            if (i) m.set(THEMES[key]);
        });
        m.fill(total);
        return ctx.startRendering();
    };
    const out = { files: {}, stats: {} };
    const keys = only ? only.split(',') : Object.keys(THEMES);
    for (const key of keys) {
        const buf = await music([[key, 0]], sec);
        out.files[`music-${key}.wav`] = wav(buf);
        out.stats[`music-${key}`] = stats(buf, SR * 3);
    }
    if (!only) {
        // El recorrido: la misma canción, de la granja a cada campo (cada uno unos 8 s)
        const tour = ['farm', 'wheat', 'tomato', 'pumpkin', 'corn', 'sunflower', 'milk', 'wool', 'egg', 'truffle', 'fish', 'honey', 'village', 'well', 'farm'];
        const buf = await music(tour.map((k, i) => [k, i * 8.7]), tour.length * 8.7);
        out.files['tour.wav'] = wav(buf);
        out.stats.tour = stats(buf);
        // Los efectos, uno tras otro
        const GAP = 1.6, ctx = new OfflineAudioContext(2, SR * (sfxList.length * GAP + 2), SR), s = new Sfx();
        s.init(ctx);
        Object.defineProperty(s, 'ok', { value: true });
        sfxList.forEach((name, i) => ctx.suspend(0.2 + i * GAP).then(() => {
            const [a, b] = name.split(':');
            if (a === 'vehicle') s.vehicle(b === 'leave' ? 'car' : b, b !== 'leave');
            else s.play(a, 0, b ? { crop: b } : null);
            ctx.resume();
        }));
        const buf2 = await ctx.startRendering();
        out.files['sfx.wav'] = wav(buf2);
        sfxList.forEach((name, i) => (out.stats[name] = stats(buf2, Math.floor((0.2 + i * GAP) * SR), Math.floor((0.2 + (i + 1) * GAP) * SR))));
        out.sfxTimes = sfxList.map((n, i) => `${(0.2 + i * GAP).toFixed(1)}s  ${n}`);
    }
    return out;
}, { sec: +(opt.sec || 22), only: opt.only || null, night: !!opt.night, sfxList: SFX });

for (const [name, b64] of Object.entries(res.files)) writeFileSync(join(out, name), Buffer.from(b64, 'base64'));
if (res.sfxTimes) writeFileSync(join(out, 'sfx.txt'), res.sfxTimes.join('\n') + '\n');
for (const [k, v] of Object.entries(res.stats)) console.log(`${k.padEnd(20)} pico ${String(v.peak).padStart(6)} dB   medio ${String(v.rms).padStart(6)} dB`);
console.log(`→ ${out}`);
await browser.close();
process.exit(0);
