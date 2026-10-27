// Efectos chiptune sintetizados al vuelo con WebAudio: cero archivos que cargar.
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
            this.ctx.onstatechange = () => this.onStateChange && this.onStateChange(this.ctx.state);
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.ctx.destination);
            // Los efectos pasan por su propio bus con un eco opcional (la música va aparte)
            this.fx = this.ctx.createGain();
            this.fx.connect(this.master);
            this.delay = this.ctx.createDelay(1);
            this.feedback = this.ctx.createGain();
            this.wet = this.ctx.createGain();
            this.feedback.gain.value = 0;
            this.wet.gain.value = 0;
            this.fx.connect(this.delay);
            this.delay.connect(this.feedback).connect(this.delay);
            this.delay.connect(this.wet).connect(this.master);
            this.setAmbience(this.ambience);
            const len = this.ctx.sampleRate;
            this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state !== 'running' && !this.held) {
            this.ctx.resume().catch(() => {});
            // Un sonido vacío dentro del gesto termina de desbloquear el audio en iOS
            const src = this.ctx.createBufferSource();
            src.buffer = this.ctx.createBuffer(1, 1, 22050);
            src.connect(this.ctx.destination);
            src.start(0);
        }
    }

    // Pausa: suspende el audio y evita que un toque lo reanude mientras dura.
    hold(on) {
        this.held = on;
        if (!this.ctx) return;
        if (on) this.ctx.suspend().catch(() => {});
        else this.ctx.resume().catch(() => {});
    }

    // Acústica del escenario: tipo de suelo (cambia el ruido de las orugas) y eco
    // (la ciudad entre edificios, la cueva del volcán, el vacío del espacio...).
    setAmbience(amb = {}) {
        this.ambience = amb;
        this.ground = amb.ground || 'grass';
        if (!this.ctx) return;
        const t = this.ctx.currentTime, echo = amb.echo || 0;
        this.delay.delayTime.setValueAtTime(echo || 0.1, t);
        this.feedback.gain.setValueAtTime(echo ? 0.32 : 0, t);
        this.wet.gain.setValueAtTime(echo ? 0.32 : 0, t);
    }

    out(pan) {
        if (!pan || !this.ctx.createStereoPanner) return this.fx;
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        p.connect(this.fx);
        return p;
    }

    // Orugas sobre el suelo del escenario (vol: 1 tu tanque, menos para los rivales cercanos)
    tread(pan = 0, vol = 1, surface = this.ground) {
        if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
        const v = 0.7 * vol;
        switch (surface) {
            case 'sand': this.noise(0.06, 0.07 * v, 3200, pan); break;
            case 'snow': this.noise(0.08, 0.09 * v, 1800, pan); this.tone('triangle', 130, 80, 0.04, 0.04 * v, pan); break;
            case 'candy': this.tone('square', 900 + Math.random() * 300, 1300, 0.03, 0.025 * v, pan); break;
            case 'rock': this.tone('sine', 95, 50, 0.06, 0.1 * v, pan); this.noise(0.04, 0.05 * v, 700, pan); break;
            case 'metal': this.tone('square', 240, 190, 0.03, 0.035 * v, pan); this.noise(0.03, 0.04 * v, 6500, pan); break;
            case 'ice': this.noise(0.14, 0.05 * v, 7500, pan); break;
            case 'bush': this.noise(0.1, 0.08 * v, 2600, pan); break;
            default: this.noise(0.05, 0.06 * v, 1000, pan); // hierba
        }
    }

    tone(type, f0, f1, dur, vol, pan = 0, delay = 0) {
        const c = this.ctx, t = c.currentTime + delay;
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

    seq(type, notes, step, vol, len = step) {
        notes.forEach((n, i) => this.tone(type, n, n, len, vol, 0, i * step));
    }

    play(name, pan = 0) {
        if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
        switch (name) {
            // Francotirador: estampido grave + chasquido, cerrojo, mira y cosecha
            case 'snipe': this.noise(0.5, 0.9, 5200, pan); this.tone('square', 220, 40, 0.35, 0.35, pan); this.tone('sine', 90, 30, 0.5, 0.5, pan); break;
            // Rachas de bajas: granada, misil Predator, bombardero y bomba nuclear
            case 'grenade': this.noise(0.25, 0.12, 2400, pan); this.tone('triangle', 500, 900, 0.18, 0.08, pan); this.tone('sine', 1500, 500, 1.3, 0.05, pan, 0.1); break;
            case 'missile': this.noise(1.2, 0.35, 1800); this.tone('sawtooth', 120, 420, 1.2, 0.08); break;
            case 'boost': this.noise(0.5, 0.4, 3200); this.tone('sawtooth', 300, 900, 0.5, 0.1); break;
            case 'plane': this.tone('sawtooth', 62, 70, 4.5, 0.09); this.tone('sawtooth', 93, 88, 4.5, 0.06); this.noise(4.5, 0.12, 500); break;
            case 'siren': this.tone('square', 880, 660, 0.45, 0.12); break;
            case 'nuke': this.noise(3, 1, 700); this.tone('sine', 70, 18, 3, 0.9); this.tone('square', 140, 30, 1.2, 0.3); break;
            case 'bolt': this.tone('square', 260, 180, 0.04, 0.1, pan); this.tone('square', 420, 300, 0.05, 0.1, pan, 0.12); this.noise(0.04, 0.15, 6000, pan, 0.12); break;
            case 'scopeIn': this.tone('triangle', 300, 900, 0.12, 0.1); this.noise(0.06, 0.08, 5000); break;
            case 'scopeOut': this.tone('triangle', 900, 300, 0.1, 0.08); break;
            case 'harvest': this.noise(0.2, 0.35, 3000, pan); this.seq('square', [784, 988, 1319], 0.05, 0.12, 0.09); break;
            case 'miss': this.noise(0.12, 0.2, 1200, pan); this.tone('triangle', 300, 120, 0.12, 0.08, pan); break;
            case 'corner': this.tone('triangle', 400, 700, 0.12, 0.1); this.noise(0.3, 0.12, 1500); break;
            case 'pop': this.tone('square', 600, 1200, 0.06, 0.12, pan); break;
            case 'shot': this.tone('square', 900, 160, 0.09, 0.2, pan); this.noise(0.06, 0.25, 4000, pan); break;
            case 'shotEnemy': this.tone('square', 520, 110, 0.11, 0.16, pan); this.noise(0.07, 0.22, 2500, pan); break;
            case 'wall': this.tone('triangle', 420, 180, 0.05, 0.12, pan); break;
            case 'hit': this.noise(0.18, 0.5, 2200, pan); this.tone('square', 330, 70, 0.14, 0.22, pan); break;
            case 'hurt': this.noise(0.25, 0.6, 1400); this.tone('sawtooth', 220, 45, 0.3, 0.3); break;
            case 'boom': this.noise(0.9, 0.9, 900, pan); this.tone('sine', 140, 28, 0.8, 0.7, pan); break;
            case 'spot': this.tone('square', 988, 988, 0.06, 0.12); this.tone('square', 1319, 1319, 0.1, 0.12, 0, 0.07); break;
            case 'drop': this.tone('sine', 260, 50, 0.22, 0.45, pan); this.noise(0.15, 0.3, 700, pan); break;
            case 'reload': this.tone('square', 300, 200, 0.06, 0.1, pan); this.tone('square', 220, 160, 0.06, 0.1, pan, 0.09); break;
            case 'reloaded': this.tone('square', 520, 520, 0.04, 0.1, pan); this.tone('square', 780, 780, 0.06, 0.1, pan, 0.06); break;
            case 'itemSpawn': this.tone('triangle', 660, 990, 0.12, 0.12, pan); break;
            case 'itemGone': this.tone('triangle', 500, 250, 0.1, 0.08, pan); break;
            case 'heal': this.seq('square', [523, 659, 784, 1047], 0.05, 0.12, 0.1); break;
            case 'power': this.seq('sawtooth', [330, 440, 660, 880], 0.05, 0.12, 0.12); break;
            case 'grabOther': this.tone('square', 392, 262, 0.15, 0.12, pan); break;
            case 'crateHit': this.noise(0.08, 0.25, 900, pan); this.tone('square', 180, 120, 0.06, 0.12, pan); break;
            case 'crateBreak': this.noise(0.35, 0.5, 1400, pan); this.tone('triangle', 260, 60, 0.3, 0.3, pan); break;
            case 'boing': this.tone('sine', 300, 900, 0.12, 0.2, pan); break;
            case 'shield': this.tone('square', 1200, 300, 0.2, 0.15, pan); this.noise(0.2, 0.3, 5000, pan); break;
            case 'shieldGet': this.seq('triangle', [392, 523, 659, 784], 0.05, 0.16, 0.12); break;
            case 'turbo': this.tone('sawtooth', 200, 1200, 0.3, 0.12); break;
            case 'bounceGet': this.seq('square', [523, 784, 659, 1047], 0.05, 0.12, 0.08); break;
            case 'radar': this.tone('sine', 1320, 1320, 0.08, 0.15); this.tone('sine', 1320, 1320, 0.08, 0.1, 0, 0.25); break;
            case 'pause': this.tone('square', 660, 440, 0.08, 0.12); break;
            case 'streak2': this.seq('square', [784, 1047], 0.07, 0.14, 0.12); break;
            case 'streak3': this.seq('square', [784, 988, 1319], 0.07, 0.14, 0.12); break;
            case 'streak4': this.seq('square', [784, 988, 1175, 1568], 0.06, 0.14, 0.12); break;
            case 'streak5': this.seq('square', [523, 659, 784, 1047, 1319, 1568, 2093], 0.06, 0.14, 0.16); this.seq('sawtooth', [262, 330, 392, 523], 0.09, 0.08, 0.2); break;
            case 'triple': this.seq('square', [880, 1175, 1568], 0.04, 0.12, 0.08); break;
            case 'decoy': this.tone('triangle', 300, 900, 0.25, 0.14); this.noise(0.3, 0.25, 3000); break;
            case 'decoyPop': this.tone('square', 700, 120, 0.2, 0.14, pan); this.noise(0.25, 0.3, 2500, pan); break;
            case 'nukeGet': this.seq('square', [196, 262, 330, 392, 523], 0.06, 0.14, 0.12); break;
            case 'nukeLaunch': this.tone('square', 220, 90, 0.25, 0.25, pan); this.tone('sine', 1400, 300, 1.35, 0.12, pan, 0.05); break;
            case 'nuke': this.noise(1.8, 1, 700, pan); this.tone('sine', 110, 22, 1.6, 0.9, pan); this.noise(0.4, 0.8, 4000, pan); break;
            case 'coin': this.tone('square', 988, 988, 0.07, 0.14); this.tone('square', 1319, 1319, 0.2, 0.14, 0, 0.07); break;
            case 'achievement': this.seq('square', [784, 988, 1175, 1568], 0.07, 0.13, 0.14); this.seq('triangle', [392, 494, 587, 784], 0.07, 0.12, 0.14); break;
            // Jefes
            case 'warn': this.tone('square', 880, 880, 0.08, 0.14); this.tone('square', 660, 660, 0.08, 0.14, 0, 0.12); this.tone('square', 880, 880, 0.08, 0.14, 0, 0.24); break;
            case 'roar': this.tone('sawtooth', 160, 50, 0.9, 0.35); this.tone('square', 110, 40, 0.9, 0.25, 0, 0.05); this.noise(0.8, 0.5, 900); break;
            case 'charge': this.tone('sawtooth', 90, 260, 0.5, 0.25, pan); this.noise(0.5, 0.35, 1200, pan); break;
            case 'wave': this.noise(1.6, 0.55, 2400); this.tone('sine', 220, 90, 1.4, 0.2); break;
            case 'storm': this.noise(1.4, 0.45, 3200); this.tone('triangle', 300, 900, 0.9, 0.08); break;
            case 'laser': this.tone('sawtooth', 1400, 300, 0.25, 0.16, pan); this.tone('square', 220, 220, 1.2, 0.08, pan, 0.2); break;
            case 'siren': for (let i = 0; i < 3; i++) { this.tone('square', 700, 1100, 0.2, 0.1, 0, i * 0.4); this.tone('square', 1100, 700, 0.2, 0.1, 0, i * 0.4 + 0.2); } break;
            case 'plane': this.tone('sawtooth', 70, 110, 1.6, 0.07); this.tone('square', 140, 210, 1.6, 0.04); this.noise(1.4, 0.12, 900); break;
            case 'whoosh': this.tone('triangle', 1600, 200, 0.5, 0.12, pan); this.noise(0.4, 0.2, 5000, pan); break;
            case 'crash': this.noise(0.5, 0.7, 1600, pan); this.tone('square', 180, 50, 0.3, 0.3, pan); break;
            case 'candy': this.seq('square', [1047, 1319, 1568, 2093], 0.04, 0.1, 0.06); break;
            case 'unlock': this.seq('square', [523, 659, 784, 1047, 1319], 0.08, 0.13, 0.14); this.seq('triangle', [262, 330, 392, 523, 659], 0.08, 0.12, 0.14); break;
            case 'secret': this.seq('square', [523, 659, 784, 988, 1175, 1319, 1568, 2093], 0.09, 0.12, 0.18); this.seq('triangle', [262, 330, 392, 494, 587, 659, 784, 1047], 0.09, 0.12, 0.18); break;
            case 'step': this.tone('square', 330, 200, 0.04, 0.06); break;
            case 'tick': this.tone('square', 440, 440, 0.12, 0.14); break;
            case 'go': this.seq('square', [880, 1175, 1760], 0.07, 0.14, 0.2); break;
            case 'ui': this.tone('square', 660, 1320, 0.09, 0.14); break;
            case 'win': this.seq('square', [523, 659, 784, 1047, 784, 1047], 0.1, 0.14, 0.16); break;
            case 'lose': this.seq('triangle', [392, 330, 262, 196], 0.16, 0.22, 0.24); break;
        }
    }
}
