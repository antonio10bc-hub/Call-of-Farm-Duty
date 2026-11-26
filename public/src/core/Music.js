// Música generada al vuelo con WebAudio (sin archivos). No es chiptune: instrumentos cálidos
// sintetizados (pad, bajo redondo, piano eléctrico, marimba, guitarra, flauta, acordeón...),
// mezclados bajitos para que acompañe sin llamar la atención.
//
// Es UNA sola canción que no se corta: la base es común a todo el juego (fa mayor, la progresión
// I-vi-IV-V con séptimas, el mismo tempo y el mismo bajo), y cada sitio (content/music.js) cambia
// solo una capa: su instrumento con su motivo, su percusión y el carácter del bajo. Al cambiar de
// sitio (set), el cambio entra al empezar el compás siguiente, así que se pasa de una granja a
// otra sin saltos. De noche (night), todo más oscuro y sin percusión fuerte.
//
// Un tema (THEMES en content/music.js):
//   keys    acompañamiento del piano eléctrico: 'chords' (acorde largo), 'stab' (a contratiempo),
//           'arp' (arpegio lento) o 'none'
//   bass    'soft' (raíz larga), 'walk' (raíz y quinta), 'bounce' (saltarín), 'oompah' (a dos)
//   bassInst  timbre del bajo: 'round' (por defecto) o 'tuba'
//   perc    'none', 'shaker', 'groove' (bombo blando, aro y shaker), 'brush', 'hooves' (cascos de
//           madera), 'tick' (picoteo)
//   sig     { inst, motif, oct, vol }: la capa propia. inst: 'pluck', 'mallet', 'bell', 'flute',
//           'accordion', 'keys', 'koto', 'buzz', 'pizz'; motif: 32 pasos (dos compases), un
//           carácter por semicorchea: '.' silencio, '0'-'9' grado sobre el acorde, 'a' -1, 'b' -2
//   drops   gotas de agua sueltas (las de la laguna y la piscifactoría)
//   dark    siempre como de noche (las luciérnagas)
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const PROG = [0, 5, 3, 4]; // I - vi - IV - V
const ROOT = 53; // fa
const TEMPO = 88;
const SWING = 0.14;
const MOTIF = { '.': null, a: -1, b: -2 };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const parse = (s) => (s ? [...s].map((c) => (c in MOTIF ? MOTIF[c] : +c)) : null);

export class Music {
    constructor(sfx) {
        this.sfx = sfx;
        this.timer = null;
        this.enabled = true;
        this.night = false;
        this.theme = null;
        this.pending = null;
    }

    get playing() {
        return !!this.timer;
    }

    // Empieza (o, si ya suena, cambia de tema al compás siguiente)
    start(theme) {
        if (!theme) return;
        if (this.playing) return this.set(theme);
        const ctx = this.sfx.ctx;
        if (!ctx || !this.enabled) return;
        this.use(theme);
        this.pending = null;
        // Bus: un filtro (el día abierto, la noche oscura), el volumen y algo de reverb
        this.bus = ctx.createGain();
        this.bus.gain.setValueAtTime(0, ctx.currentTime);
        this.bus.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 2.5);
        this.tone = ctx.createBiquadFilter();
        this.tone.type = 'lowpass';
        this.tone.frequency.value = this.cutoff();
        this.bus.connect(this.tone).connect(this.sfx.master);
        this.send = ctx.createGain();
        this.send.gain.value = 0.35;
        this.tone.connect(this.send).connect(this.sfx.verbIn);
        this.step = 0;
        this.next = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.tick(), 25);
    }

    // Cambia de tema (entra al empezar el compás siguiente)
    set(theme) {
        if (theme && theme !== this.theme && theme !== this.pending) this.pending = theme;
    }

    use(theme) {
        this.theme = theme;
        this.motif = parse(theme.sig && theme.sig.motif);
    }

    stop(fade = 0.8) {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
        const ctx = this.sfx.ctx, bus = this.bus;
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
        bus.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
        setTimeout(() => bus.disconnect(), (fade + 0.3) * 1000);
        this.theme = this.pending = null;
    }

    dark() {
        return this.night || (this.theme && this.theme.dark);
    }

    cutoff() {
        return this.dark() ? 1500 : 5200;
    }

    tick() {
        const ctx = this.sfx.ctx;
        if (ctx.state !== 'running') {
            this.next = ctx.currentTime + 0.05;
            return;
        }
        // (de día a noche y al revés: el filtro se abre o se cierra poco a poco)
        this.tone.frequency.setTargetAtTime(this.cutoff(), ctx.currentTime, 1.5);
        this.fill(ctx.currentTime + 0.15);
    }

    // Programa las notas hasta el segundo until (el juego, poco a poco; scripts/audio.mjs, de golpe
    // para escucharla en un archivo)
    fill(until) {
        const six = 60 / TEMPO / 4;
        while (this.next < until) {
            if (this.step % 16 === 0 && this.pending) {
                this.use(this.pending);
                this.pending = null;
            }
            const swing = this.step % 2 ? SWING * six : 0;
            this.schedule(this.step, this.next + swing, six);
            this.next += six;
            this.step++;
        }
    }

    note(deg, oct) {
        const n = SCALE.length, o = Math.floor(deg / n);
        return ROOT + 12 * (oct + o) + SCALE[((deg % n) + n) % n];
    }

    schedule(step, t, six) {
        const th = this.theme, s = step % 16, bar = Math.floor(step / 16) % 4, deg = PROG[bar], night = this.dark();
        const chord = [deg, deg + 2, deg + 4, deg + 6], barLen = six * 16;

        // Pad: el acorde entero, largo y suave (la cama de todo)
        if (s === 0) for (const d of chord.slice(0, 3)) this.pad(this.note(d, 1), t, barLen * 1.05, 0.018);

        // Bajo (el mismo en todas partes; cambia solo su carácter)
        const B = th.bass || 'walk', root = this.note(deg, -1), fifth = this.note(deg + 4, -1);
        const bn = B === 'soft' ? { 0: root }
            : B === 'bounce' ? { 0: root, 6: root, 8: fifth, 12: root + 12, 14: fifth }
            : B === 'oompah' ? { 0: root, 8: fifth }
            : { 0: root, 10: fifth };
        if (bn[s] !== undefined) this.bass(bn[s], t, B === 'soft' ? barLen : B === 'bounce' ? six * 1.6 : six * 6, th.bassInst);

        // Piano eléctrico
        const K = th.keys || 'chords';
        if (K === 'chords' && s === 0) for (const d of chord) this.keys(this.note(d, 1), t, barLen * 0.9, 0.022);
        else if (K === 'stab' && (s === 4 || s === 12)) for (const d of chord.slice(0, 3)) this.keys(this.note(d, 1), t, six * 2, 0.026);
        else if (K === 'arp' && s % 4 === 0) this.keys(this.note(chord[(s / 4) % 4], 1), t, six * 6, 0.03);

        // La capa propia del sitio
        const sig = th.sig;
        if (sig && this.motif) {
            const m = this.motif[step % this.motif.length];
            if (m !== null) this.inst(sig.inst, this.note(deg + m, sig.oct ?? 1), t, six, (sig.vol ?? 1) * (night ? 0.85 : 1));
        }
        if (th.drops && Math.random() < 0.06) this.drop(t);

        // Percusión (de noche, solo lo más suave)
        const P = night && th.perc !== 'none' ? 'shaker' : th.perc || 'none';
        if (P === 'shaker' && s % 2 === 0) this.shaker(t, s % 4 === 0 ? 0.012 : 0.007);
        if (P === 'groove') {
            if (s === 0 || s === 10) this.kick(t, 0.22);
            if (s === 4 || s === 12) this.rim(t, 0.05);
            if (s % 2 === 0) this.shaker(t, s % 4 === 2 ? 0.014 : 0.008);
        }
        if (P === 'brush') {
            if (s === 0) this.kick(t, 0.14);
            if (s === 4 || s === 12) this.brush(t, 0.03);
            if (s % 4 === 2) this.shaker(t, 0.008);
        }
        if (P === 'hooves' && 'x.x...x.x.x...x.'[s] === 'x') this.block(t, s % 4 === 0 ? 900 : 700, 0.05);
        if (P === 'tick' && s % 2 === 1) this.block(t, 2400, 0.022);
        if ((P === 'hooves' || P === 'tick') && s === 0) this.kick(t, 0.16);
    }

    // ---------- Instrumentos ----------
    osc(type, midi, t, dur, vol, o = {}) {
        const ctx = this.sfx.ctx, f = hz(midi);
        const v = ctx.createOscillator(), g = ctx.createGain();
        v.type = type;
        v.frequency.setValueAtTime(f * (o.bend ? 0.97 : 1), t);
        if (o.bend) v.frequency.exponentialRampToValueAtTime(f, t + 0.06);
        if (o.detune) v.detune.value = o.detune;
        if (o.vib) {
            const l = ctx.createOscillator(), lg = ctx.createGain();
            l.frequency.value = o.vib[0];
            lg.gain.value = f * o.vib[1];
            l.connect(lg).connect(v.frequency);
            l.start(t);
            l.stop(t + dur + 0.1);
        }
        const a = o.attack ?? 0.005, r = o.release ?? dur;
        g.gain.value = 0;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + a);
        if (o.sustain) g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = v;
        if (o.lp) {
            const fl = ctx.createBiquadFilter();
            fl.type = 'lowpass';
            fl.frequency.setValueAtTime(o.lp, t);
            if (o.lp1) fl.frequency.exponentialRampToValueAtTime(o.lp1, t + dur);
            fl.Q.value = o.q ?? 0.7;
            node = node.connect(fl);
        }
        node.connect(g).connect(this.bus);
        v.start(t);
        v.stop(t + dur + 0.1);
    }

    pad(m, t, dur, vol) {
        for (const d of [-7, 7]) this.osc('sawtooth', m, t, dur, vol, { attack: dur * 0.35, sustain: true, release: dur * 0.4, detune: d, lp: 900 });
    }

    bass(m, t, dur, inst) {
        if (inst === 'tuba') return this.osc('sawtooth', m, t, dur, 0.11, { attack: 0.03, lp: 420, q: 1 });
        this.osc('sine', m, t, dur, 0.16, { attack: 0.01 });
        this.osc('triangle', m, t, dur * 0.6, 0.05, { attack: 0.01 });
    }

    // Piano eléctrico: redondo, con un poco de brillo al tocar
    keys(m, t, dur, vol) {
        this.osc('sine', m, t, dur, vol, { attack: 0.004 });
        this.osc('sine', m + 12, t, dur * 0.3, vol * 0.25, { attack: 0.003 });
    }

    inst(kind, m, t, six, k) {
        switch (kind) {
            case 'pluck': this.osc('sawtooth', m, t, six * 3, 0.03 * k, { attack: 0.002, lp: 3500, lp1: 500 }); this.osc('triangle', m, t, six * 3, 0.03 * k, { attack: 0.002 }); break; // guitarra
            case 'koto': this.osc('triangle', m, t, six * 5, 0.05 * k, { attack: 0.002, bend: true }); this.osc('sine', m + 12, t, six * 1.5, 0.012 * k); break;
            case 'mallet': this.osc('sine', m, t, six * 3, 0.06 * k, { attack: 0.002 }); this.osc('sine', m + 24, t, six * 0.6, 0.012 * k, { attack: 0.002 }); break; // marimba
            case 'bell': this.osc('sine', m, t, six * 10, 0.035 * k, { attack: 0.002 }); this.osc('sine', m + 17.6, t, six * 3, 0.01 * k, { attack: 0.002 }); break; // celesta
            case 'flute': this.osc('sine', m, t, six * 3.5, 0.045 * k, { attack: 0.06, sustain: true, release: six, vib: [5, 0.006] }); break;
            case 'accordion': for (const d of [-6, 6]) this.osc('sawtooth', m, t, six * 3.5, 0.016 * k, { attack: 0.04, sustain: true, release: six, detune: d, lp: 1500 }); break;
            case 'keys': this.keys(m, t, six * 5, 0.04 * k); break;
            case 'buzz': this.osc('sawtooth', m, t, six * 5, 0.02 * k, { attack: 0.08, sustain: true, release: six * 2, lp: 1100, vib: [6, 0.012] }); break; // abejorro
            case 'pizz': this.osc('triangle', m, t, six * 0.9, 0.05 * k, { attack: 0.002 }); break;
        }
    }

    kick(t, vol) {
        const ctx = this.sfx.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
        g.gain.value = 0;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(this.bus);
        o.start(t);
        o.stop(t + 0.25);
    }

    hiss(t, dur, vol, freq, type = 'highpass', q = 0.7) {
        const ctx = this.sfx.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.sfx.noiseBuf;
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        g.gain.value = 0;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.bus);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
    }

    shaker(t, vol) {
        this.hiss(t, 0.05, vol, 7500);
    }

    brush(t, vol) {
        this.hiss(t, 0.18, vol, 3000, 'bandpass', 0.8);
    }

    rim(t, vol) {
        this.hiss(t, 0.03, vol, 1700, 'bandpass', 5);
    }

    block(t, f, vol) {
        this.hiss(t, 0.04, vol, f, 'bandpass', 7);
    }

    drop(t) {
        const m = this.note(7 + ((Math.random() * 5) | 0), 2);
        this.osc('sine', m, t, 0.12, 0.025, { attack: 0.002 });
    }
}
