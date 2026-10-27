// Música chiptune generada al vuelo: bajo, arpegio, melodía y batería sobre una progresión
// de 4 compases. Cada tema elige raíz, escala, tempo y timbre; la melodía se genera con una
// semilla, así que cada escenario suena distinto pero siempre igual dentro de una partida.
// "intensity" (0..1) acelera y añade capas cuando la cosa se pone fea.
//
// Opcional, para temas con personalidad propia (los jefes de la campaña):
//   prog      progresión de 4 compases (grados de la escala)
//   bass      patrón de 16 pasos: '1' raíz, '3' tercera, '5' quinta, '8' octava, '.' silencio
//   bassType  timbre del bajo
//   drums     { k, s, h }: bombo, caja y charles en 16 pasos ('x' golpe, 'o' charles abierto)
//   arp       'chord' (por defecto), 'up' (arpegio rápido), 'stab' (acordes a contratiempo), 'none'
//   motif     melodía escrita a mano: un carácter por paso ('.' silencio, '0'-'9' grado, 'a' -1, 'b' -2)
//   harmony   segunda voz de la melodía, una tercera por debajo
//   swing     retraso de las semicorcheas impares (0..0.35)
//   octave    octava de la melodía (1 por defecto)
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    harmonic: [0, 2, 3, 5, 7, 8, 11],     // menor armónica
    hijaz: [0, 1, 4, 5, 7, 8, 10],        // frigio dominante: suena a desierto
    wholetone: [0, 2, 4, 6, 8, 10],       // tonos enteros: suena a ciencia ficción
};
const PROGRESSIONS = {
    major: [0, 5, 3, 4],
    minor: [0, 5, 2, 6],
    dorian: [0, 3, 0, 6],
    phrygian: [0, 1, 0, 6],
    mixolydian: [0, 6, 3, 0],
    lydian: [0, 1, 0, 4],
    harmonic: [0, 3, 5, 4],
    hijaz: [0, 1, 0, 6],
    wholetone: [0, 1, 2, 1],
};
const DEFAULT_BASS = '1..1..1.1..1..1.';
const DEFAULT_DRUMS = { k: 'x.......x.......', s: '....x.......x...', h: '.x.x.x.x.x.x.x.x' };
const MOTIF = { '.': null, a: -1, b: -2 };
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
    constructor(sfx) {
        this.sfx = sfx;
        this.timer = null;
        this.intensity = 0;
        this.enabled = true;
    }

    start(cfg, seed = 1) {
        this.stop();
        const ctx = this.sfx.ctx;
        if (!ctx || !this.enabled) return;
        this.cfg = { root: 57, scale: 'minor', tempo: 120, lead: 'square', ...cfg };
        this.scale = SCALES[this.cfg.scale] || SCALES.minor;
        this.prog = this.cfg.prog || PROGRESSIONS[this.cfg.scale] || PROGRESSIONS.minor;
        this.melody = this.cfg.motif ? [...this.cfg.motif].map((c) => (c in MOTIF ? MOTIF[c] : +c)) : makeMelody(seed);
        this.bassLine = this.cfg.bass || DEFAULT_BASS;
        this.drums = { ...DEFAULT_DRUMS, ...this.cfg.drums };
        this.bus = ctx.createGain();
        this.bus.gain.setValueAtTime(0, ctx.currentTime);
        this.bus.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 0.6);
        this.bus.connect(this.sfx.master);
        this.step = 0;
        this.next = ctx.currentTime + 0.08;
        this.timer = setInterval(() => this.tick(), 25);
    }

    stop(fade = 0.4) {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
        const ctx = this.sfx.ctx, bus = this.bus;
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
        bus.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
        setTimeout(() => bus.disconnect(), (fade + 0.3) * 1000);
    }

    get playing() {
        return !!this.timer;
    }

    tick() {
        const ctx = this.sfx.ctx;
        if (ctx.state !== 'running') {
            this.next = ctx.currentTime + 0.05;
            return;
        }
        const sixteenth = 60 / (this.cfg.tempo * (1 + 0.14 * this.intensity)) / 4;
        while (this.next < ctx.currentTime + 0.12) {
            const swing = this.step % 2 ? (this.cfg.swing || 0) * sixteenth : 0;
            this.schedule(this.step, this.next + swing, sixteenth);
            this.next += sixteenth;
            this.step++;
        }
    }

    note(deg, octave) {
        const s = this.scale, n = s.length;
        const o = Math.floor(deg / n);
        return this.cfg.root + 12 * (octave + o) + s[((deg % n) + n) % n];
    }

    schedule(step, t, len) {
        const s = step % 16, bar = Math.floor(step / 16) % 4;
        const deg = this.prog[bar];
        const chord = [deg, deg + 2, deg + 4];
        const hot = this.intensity > 0.5;

        const c = this.cfg;

        // Bajo
        const b = this.bassLine[s];
        if (b && b !== '.') {
            const type = c.bassType || 'triangle';
            const vol = type === 'triangle' ? 0.28 : type === 'sine' ? 0.3 : 0.1;
            const midi = b === '8' ? this.note(deg, -1) + 12 : this.note(deg + (b === '3' ? 2 : b === '5' ? 4 : 0), -1);
            this.voice(type, midi, t, len * (type === 'triangle' ? 2.2 : 1.4), vol);
        }

        // Acompañamiento
        const arp = c.arp || 'chord';
        if (arp === 'chord' && (s % 2 === 0 || hot)) this.voice('square', this.note(chord[(s >> (hot ? 0 : 1)) % 3], 1), t, len * 0.9, hot ? 0.05 : 0.04);
        else if (arp === 'up') this.voice('square', this.note(chord[s % 3] + (s % 6 >= 3 ? 7 : 0), 1), t, len * 0.7, 0.035);
        else if (arp === 'stab' && (s % 4 === 2 || (hot && s % 4 === 3))) for (const d of chord) this.voice('square', this.note(d, 1), t, len * 1.2, 0.03);

        // Melodía (y su segunda voz)
        const m = this.melody[step % this.melody.length];
        if (m !== null) {
            const oct = c.octave ?? 1;
            this.voice(c.lead, this.note(deg + m, oct), t, len * 1.8, 0.07);
            if (c.harmony) this.voice(c.harmonyLead || 'triangle', this.note(deg + m - 2, oct), t, len * 1.8, 0.05);
        }

        // Batería
        const d = this.drums;
        if (d.k[s] === 'x') this.kick(t);
        if (d.s[s] === 'x') this.hiss(t, 0.12, 0.16, 1800);
        if (d.h[s] === 'x') this.hiss(t, 0.03, hot ? 0.06 : 0.035, 7000);
        else if (d.h[s] === 'o') this.hiss(t, 0.12, 0.05, 6000);
    }

    voice(type, midi, t, dur, vol) {
        const ctx = this.sfx.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(midiToHz(midi), t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.bus);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    kick(t) {
        const ctx = this.sfx.ctx;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g).connect(this.bus);
        o.start(t);
        o.stop(t + 0.16);
    }

    hiss(t, dur, vol, freq) {
        const ctx = this.sfx.ctx;
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.sfx.noiseBuf;
        f.type = 'highpass';
        f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.bus);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.02);
    }
}

// 64 pasos de melodía: grados relativos al acorde o silencio, con un paseo aleatorio suave.
function makeMelody(seed) {
    let a = seed >>> 0;
    const rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = [];
    let deg = 2;
    for (let i = 0; i < 64; i++) {
        const strong = i % 4 === 0;
        if (rnd() < (strong ? 0.75 : 0.3)) {
            deg = Math.max(-2, Math.min(7, deg + Math.floor(rnd() * 5) - 2));
            out.push(deg);
        } else out.push(null);
    }
    return out;
}
