// Efectos chiptune sintetizados al vuelo con WebAudio: cero archivos que cargar.
// Cuánto varía cada sonido al azar (±): los que se repiten mucho
const VARY = { snipe: 0.06, harvest: 0.05, hitmark: 0.06, bolt: 0.04, pop: 0.08, splat: 0.08, wall: 0.06 };

export class Sfx {
    constructor(volume = 0.32) {
        this.ctx = null;
        this.volume = volume;
        this.enabled = true; // efectos (la música va aparte, en core/Music.js)
    }

    // Los navegadores exigen un gesto del usuario para arrancar el audio. Se llama en cada
    // toque/tecla: crea el contexto la primera vez y lo reanuda siempre que no esté sonando
    // (en iPhone el estado puede ser "interrupted", no solo "suspended").
    unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            // Safari 16.4+: que el interruptor de silencio del iPhone no apague el juego
            try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* no disponible */ }
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.ctx.destination);
            // Los efectos pasan por su propio bus (la música va aparte)
            this.fx = this.ctx.createGain();
            this.fx.connect(this.master);
            const len = this.ctx.sampleRate;
            this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state !== 'running') {
            this.ctx.resume().catch(() => {});
            // Un sonido vacío dentro del gesto termina de desbloquear el audio en iOS
            const src = this.ctx.createBufferSource();
            src.buffer = this.ctx.createBuffer(1, 1, 22050);
            src.connect(this.ctx.destination);
            src.start(0);
        }
    }

    out(pan) {
        if (!pan || !this.ctx.createStereoPanner) return this.fx;
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        p.connect(this.fx);
        return p;
    }

    tone(type, f0, f1, dur, vol, pan = 0, delay = 0) {
        const c = this.ctx, t = c.currentTime + delay, r = this.rate || 1; // (rate: el tono del sonido de ahora)
        f0 *= r;
        f1 *= r;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.out(pan));
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    noise(dur, vol, freq, pan = 0, delay = 0) {
        const c = this.ctx, t = c.currentTime + delay;
        freq *= this.rate || 1;
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = this.noiseBuf;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(freq, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.out(pan));
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.02);
    }

    // ¡Cuac! (el pato del lacito)
    quack() {
        if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
        for (const [d, f] of [[0, 520], [0.16, 470]]) {
            this.tone('square', f, f * 0.55, 0.12, 0.09, 0, d);
            this.tone('sawtooth', f * 1.5, f * 0.8, 0.1, 0.04, 0, d);
        }
    }

    // Sonido de ambiente de la zona (pájaros, agua, viento), muy suave
    ambient(kind, vol = 1, pan = 0) {
        if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
        const v = 0.05 * vol;
        if (kind === 'bird') {
            // Un trino: dos o tres pitidos que suben y bajan
            const f = 2400 + Math.random() * 1600, n = 2 + ((Math.random() * 2) | 0);
            for (let i = 0; i < n; i++) this.tone('sine', f * (1 + i * 0.08), f * (1.25 - i * 0.05), 0.07, v * 0.9, pan, i * 0.11);
        } else if (kind === 'water') {
            this.noise(0.5 + Math.random() * 0.4, v * 0.8, 600 + Math.random() * 300, pan);
            if (Math.random() < 0.4) this.tone('sine', 700 + Math.random() * 300, 1100, 0.05, v * 0.5, pan, 0.2); // un «plop»
        } else if (kind === 'wind') {
            this.noise(1.6 + Math.random(), v * 0.9, 400 + Math.random() * 400, pan);
        }
    }

    seq(type, notes, step, vol, len = step) {
        notes.forEach((n, i) => this.tone(type, n, n, len, vol, 0, i * step));
    }

    // opts.rate: más agudo (>1) o más grave (<1); opts.vary: variación al azar (±; los disparos y la
    // cosecha, para que no suenen siempre igual)
    play(name, pan = 0, opts = null) {
        if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
        this.rate = (opts && opts.rate ? opts.rate : 1) * (1 + (Math.random() - 0.5) * 2 * (opts && opts.vary !== undefined ? opts.vary : VARY[name] || 0));
        try {
            this.playRaw(name, pan);
        } finally {
            this.rate = 1;
        }
    }

    playRaw(name, pan) {
        switch (name) {
            // Francotirador: estampido grave + chasquido, cerrojo, mira y cosecha
            case 'snipe': this.noise(0.5, 0.9, 5200, pan); this.tone('square', 220, 40, 0.35, 0.35, pan); this.tone('sine', 90, 30, 0.5, 0.5, pan); this.noise(0.9, 0.12, 900, pan, 0.09); break; // (y su eco por el valle)
            // Rachas de bajas: granada, misil Predator, bombardero y bomba nuclear
            case 'grenade': this.noise(0.25, 0.12, 2400, pan); this.tone('triangle', 500, 900, 0.18, 0.08, pan); this.tone('sine', 1500, 500, 1.3, 0.05, pan, 0.1); break;
            case 'missile': this.noise(1.2, 0.35, 1800); this.tone('sawtooth', 120, 420, 1.2, 0.08); break;
            case 'boost': this.noise(0.5, 0.4, 3200); this.tone('sawtooth', 300, 900, 0.5, 0.1); break;
            case 'plane': this.tone('sawtooth', 62, 70, 4.5, 0.09); this.tone('sawtooth', 93, 88, 4.5, 0.06); this.noise(4.5, 0.12, 500); break;
            case 'siren': this.tone('square', 880, 660, 0.45, 0.12); break;
            case 'ufo': for (let i = 0; i < 6; i++) this.tone('sine', i % 2 ? 520 : 880, i % 2 ? 880 : 520, 0.25, 0.08, 0, i * 0.25); break;
            case 'nukeFall': this.tone('sine', 1600, 160, 5, 0.06); this.noise(5, 0.08, 1200); break;
            case 'nuke': this.noise(3, 1, 700); this.tone('sine', 70, 18, 3, 0.9); this.tone('square', 140, 30, 1.2, 0.3); break;
            case 'bolt': this.tone('square', 260, 180, 0.04, 0.1, pan); this.tone('square', 420, 300, 0.05, 0.1, pan, 0.12); this.noise(0.04, 0.15, 6000, pan, 0.12); break;
            case 'scopeIn': this.tone('triangle', 300, 900, 0.12, 0.1); this.noise(0.06, 0.08, 5000); break;
            case 'scopeOut': this.tone('triangle', 900, 300, 0.1, 0.08); break;
            case 'harvest': this.noise(0.2, 0.35, 3000, pan); this.seq('square', [784, 988, 1319], 0.05, 0.12, 0.09); break;
            case 'miss': this.noise(0.12, 0.2, 1200, pan); this.tone('triangle', 300, 120, 0.12, 0.08, pan); break;
            case 'corner': this.tone('triangle', 400, 700, 0.12, 0.1); this.noise(0.3, 0.12, 1500); break;
            case 'pop': this.tone('square', 600, 1200, 0.06, 0.12, pan); break;
            // Mugido: grave, que sube y baja
            case 'moo': this.tone('sawtooth', 150, 115, 0.55, 0.09, pan); this.tone('triangle', 300, 230, 0.55, 0.05, pan); break;
            // Cacareo (dos picos cortos) y huevo cascado contra el suelo
            case 'cluck': this.tone('square', 700, 520, 0.07, 0.07, pan); this.tone('square', 760, 560, 0.09, 0.06, pan, 0.1); break;
            case 'splat': this.noise(0.14, 0.3, 900, pan); this.tone('sine', 220, 90, 0.12, 0.12, pan); break;
            case 'wall': this.tone('triangle', 420, 180, 0.05, 0.12, pan); break;
            case 'boom': this.noise(0.9, 0.9, 900, pan); this.tone('sine', 140, 28, 0.8, 0.7, pan); break;
            case 'spot': this.tone('square', 988, 988, 0.06, 0.12); this.tone('square', 1319, 1319, 0.1, 0.12, 0, 0.07); break;
            case 'drop': this.tone('sine', 260, 50, 0.22, 0.45, pan); this.noise(0.15, 0.3, 700, pan); break;
            case 'reload': this.tone('square', 300, 200, 0.06, 0.1, pan); this.tone('square', 220, 160, 0.06, 0.1, pan, 0.09); break;
            case 'reloaded': this.tone('square', 520, 520, 0.04, 0.1, pan); this.tone('square', 780, 780, 0.06, 0.1, pan, 0.06); break;
            case 'itemSpawn': this.tone('triangle', 660, 990, 0.12, 0.12, pan); break;
            case 'power': this.seq('sawtooth', [330, 440, 660, 880], 0.05, 0.12, 0.12); break;
            case 'grabOther': this.tone('square', 392, 262, 0.15, 0.12, pan); break;
            case 'crateHit': this.noise(0.08, 0.25, 900, pan); this.tone('square', 180, 120, 0.06, 0.12, pan); break;
            case 'crateBreak': this.noise(0.35, 0.5, 1400, pan); this.tone('triangle', 260, 60, 0.3, 0.3, pan); break;
            case 'boing': this.tone('sine', 300, 900, 0.12, 0.2, pan); break;
            case 'shieldGet': this.seq('triangle', [392, 523, 659, 784], 0.05, 0.16, 0.12); break;
            case 'bounceGet': this.seq('square', [523, 784, 659, 1047], 0.05, 0.12, 0.08); break;
            case 'radar': this.tone('sine', 1320, 1320, 0.08, 0.15); this.tone('sine', 1320, 1320, 0.08, 0.1, 0, 0.25); break;
            case 'coin': this.tone('square', 988, 988, 0.07, 0.14); this.tone('square', 1319, 1319, 0.2, 0.14, 0, 0.07); break;
            case 'achievement': this.seq('square', [784, 988, 1175, 1568], 0.07, 0.13, 0.14); this.seq('triangle', [392, 494, 587, 784], 0.07, 0.12, 0.14); break;
            case 'warn': this.tone('square', 880, 880, 0.08, 0.14); this.tone('square', 660, 660, 0.08, 0.14, 0, 0.12); this.tone('square', 880, 880, 0.08, 0.14, 0, 0.24); break;
            case 'laser': this.tone('sawtooth', 1400, 300, 0.25, 0.16, pan); this.tone('square', 220, 220, 1.2, 0.08, pan, 0.2); break;
            case 'whoosh': this.tone('triangle', 1600, 200, 0.5, 0.12, pan); this.noise(0.4, 0.2, 5000, pan); break;
            case 'candy': this.seq('square', [1047, 1319, 1568, 2093], 0.04, 0.1, 0.06); break;
            case 'unlock': this.seq('square', [523, 659, 784, 1047, 1319], 0.08, 0.13, 0.14); this.seq('triangle', [262, 330, 392, 523, 659], 0.08, 0.12, 0.14); break;
            case 'secret': this.seq('square', [523, 659, 784, 988, 1175, 1319, 1568, 2093], 0.09, 0.12, 0.18); this.seq('triangle', [262, 330, 392, 494, 587, 659, 784, 1047], 0.09, 0.12, 0.18); break;
            case 'step': this.tone('square', 330, 200, 0.04, 0.06); break;
            case 'tick': this.tone('square', 440, 440, 0.12, 0.14); break;
            // Bala de torreta: seca y corta (salen a ráfagas)
            case 'turret': this.noise(0.05, 0.16, 1600, pan); this.tone('square', 240, 110, 0.04, 0.05, pan); break;
            // Hitmarker: chasquido seco y agudo al dar a un alienígena
            case 'hitmark': this.noise(0.04, 0.4, 5000, pan); this.tone('square', 1500, 1300, 0.035, 0.12, pan); break;
            case 'go': this.seq('square', [880, 1175, 1760], 0.07, 0.14, 0.2); break;
            case 'ui': this.tone('square', 660, 1320, 0.09, 0.14); break;
            case 'win': this.seq('square', [523, 659, 784, 1047, 784, 1047], 0.1, 0.14, 0.16); break;
        }
    }
}
