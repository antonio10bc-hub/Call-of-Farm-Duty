// Efectos de sonido sintetizados al vuelo con WebAudio: cero archivos que cargar.
//
// Diseño de sonido: nada de chiptune. Una paleta pequeña de «instrumentos» cálidos (madera,
// marimba, campanita, cuerda pulsada, agua, golpes graves y soplos de ruido filtrado) con una
// reverb corta compartida, para que todo suene en el mismo sitio. Reglas:
//   - la interfaz suena a madera y marimba, suave y corta (no cansa aunque se toque mucho)
//   - lo bueno sube (arpegios mayores), lo que no se puede baja y se apaga (madera sorda)
//   - cuanto más importa algo, más capas: un toque < una compra < una mejora < un desbloqueo
//   - lo del mundo suena a lo que es (agua, tierra, metal, animales), con su panorama
// Los nombres de los sonidos son los de siempre (play('coin')...) más los nuevos (deny, open,
// close, buy, sell, build, tier*, vehicle...). La música va aparte (core/Music.js) y comparte la
// reverb y el compresor de salida.
import { Settings } from './Settings.js';
// Cuánto varía cada sonido al azar (±): los que se repiten mucho
const VARY = { tink: 0.12, snipe: 0.05, pistol: 0.06, smg: 0.08, shotgun: 0.05, harvest: 0.04, hitmark: 0.05, bolt: 0.04, pop: 0.08, splat: 0.08, wall: 0.06, ui: 0.03, miss: 0.08, turret: 0.06, cluck: 0.1, bleat: 0.12, oink: 0.1, moo: 0.08 };
// Notas (Hz) de la escala de la casa: fa mayor (la de la música), para que todo encaje con ella
const N = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, Bb4: 466.2, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, Bb5: 932.3, C6: 1046.5, D6: 1174.7, E6: 1318.5, F6: 1396.9, G6: 1568, A6: 1760, C7: 2093 };

export class Sfx {
    constructor(volume = 0.55) {
        this.ctx = null;
        this.volume = volume;
        this.enabled = true; // efectos (la música va aparte, en core/Music.js)
        this.level = 1; // el volumen de los efectos (Ajustes), 0..1
    }

    // El volumen de los efectos (el de Ajustes; a 0 no suenan)
    setLevel(v) {
        this.level = v;
        this.enabled = v > 0;
        if (this.fx) this.fx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
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
            this.init(new AC());
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

    // La cadena de salida sobre un contexto (el del juego o, para escucharlo en un archivo, uno
    // sin conexión: scripts/audio.mjs)
    init(c) {
        this.ctx = c;
        // Salida: el volumen general y un limitador suave (una curva que solo dobla lo que se
        // acerca al máximo: nada satura aunque suenen muchas cosas a la vez). (Sin compresor: el
        // de los navegadores sube el volumen por su cuenta y deja pasar picos)
        this.master = c.createGain();
        this.master.gain.value = this.volume;
        const lim = c.createWaveShaper(), curve = new Float32Array(2048);
        for (let i = 0; i < curve.length; i++) {
            const x = (i / (curve.length - 1)) * 2 - 1, a = Math.abs(x);
            curve[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3));
        }
        lim.curve = curve;
        this.master.connect(lim).connect(c.destination);
        // La reverb compartida (una sala pequeña y cálida): efectos y música le mandan un poco
        this.verb = c.createConvolver();
        this.verb.buffer = this.impulse(1.6);
        this.verbIn = c.createGain();
        this.verbIn.gain.value = 0.55;
        this.verbIn.connect(this.verb).connect(this.master);
        // Los efectos pasan por su propio bus (la música va aparte)
        this.fx = c.createGain();
        this.fx.gain.value = this.level;
        this.fx.connect(this.master);
        this.fxSend = c.createGain();
        this.fxSend.gain.value = 0.22;
        this.fx.connect(this.fxSend).connect(this.verbIn);
        const len = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    // Respuesta de una sala: ruido estéreo que se apaga y se oscurece
    impulse(sec) {
        const c = this.ctx, n = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, n, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            let lp = 0;
            for (let i = 0; i < n; i++) {
                const k = i / n;
                lp += (Math.random() * 2 - 1 - lp) * (0.5 - k * 0.42); // (cada vez más oscuro)
                d[i] = lp * Math.pow(1 - k, 2.6) * (i < 60 ? i / 60 : 1);
            }
        }
        return buf;
    }

    get ok() {
        return !!this.ctx && this.ctx.state === 'running' && this.enabled;
    }

    out(pan) {
        if (!pan || !this.ctx.createStereoPanner) return this.fx;
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        p.connect(this.fx);
        return p;
    }

    // ---------- Instrumentos ----------
    // Un oscilador con su envolvente (ataque corto, sin chasquidos) y, si se pide, un filtro
    tone(type, f0, f1, dur, vol, pan = 0, delay = 0, o = {}) {
        const c = this.ctx, t = c.currentTime + delay, r = this.rate || 1, a = o.attack ?? 0.006;
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0 * r, t);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * r), t + dur * (o.glide ?? 1));
        if (o.vib) {
            const lfo = c.createOscillator(), lg = c.createGain();
            lfo.frequency.value = o.vib[0];
            lg.gain.value = f0 * r * o.vib[1];
            lfo.connect(lg).connect(osc.frequency);
            lfo.start(t);
            lfo.stop(t + dur + 0.05);
        }
        g.gain.value = 0;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = osc;
        if (o.lp) {
            const f = c.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.setValueAtTime(o.lp, t);
            if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + dur);
            f.Q.value = o.q ?? 0.7;
            node = node.connect(f);
        }
        node.connect(g).connect(this.out(pan));
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    // Ruido filtrado: soplos, roces, salpicones, golpes (type: lowpass, bandpass, highpass)
    noise(dur, vol, freq, pan = 0, delay = 0, o = {}) {
        const c = this.ctx, t = c.currentTime + delay, a = o.attack ?? 0.004;
        freq *= this.rate || 1;
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = this.noiseBuf;
        f.type = o.type || 'lowpass';
        f.Q.value = o.q ?? (f.type === 'bandpass' ? 1.4 : 0.7);
        f.frequency.setValueAtTime(freq, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to ?? freq * 0.2), t + dur);
        g.gain.value = 0;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.out(pan));
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
    }

    // Marimba: fundamental redonda y un parcial agudo que se apaga enseguida
    mallet(f, vol, pan = 0, delay = 0, dur = 0.5) {
        this.tone('sine', f, f, dur, vol, pan, delay, { attack: 0.003 });
        this.tone('sine', f * 4, f * 4, dur * 0.18, vol * 0.25, pan, delay, { attack: 0.002 });
    }

    // Campanita (celesta): parciales inarmónicos que brillan y se apagan despacio
    bell(f, vol, pan = 0, delay = 0, dur = 1.1) {
        this.tone('sine', f, f, dur, vol, pan, delay, { attack: 0.002 });
        this.tone('sine', f * 2.76, f * 2.76, dur * 0.45, vol * 0.3, pan, delay, { attack: 0.002 });
        this.tone('sine', f * 5.4, f * 5.4, dur * 0.2, vol * 0.12, pan, delay, { attack: 0.002 });
    }

    // Cuerda pulsada (guitarra, ukelele): brillante al principio, se cierra enseguida
    pluck(f, vol, pan = 0, delay = 0, dur = 0.45) {
        this.tone('sawtooth', f, f, dur, vol * 0.5, pan, delay, { attack: 0.002, lp: Math.min(9000, f * 8), lp1: f * 1.2 });
        this.tone('triangle', f, f, dur, vol * 0.6, pan, delay, { attack: 0.002 });
    }

    // Madera (claves, caja de madera, botones): un golpecito con cuerpo
    wood(f, vol, pan = 0, delay = 0) {
        this.noise(0.035, vol * 0.8, f, pan, delay, { type: 'bandpass', q: 6, to: f * 0.9, attack: 0.001 });
        this.tone('sine', f * 0.5, f * 0.42, 0.05, vol * 0.5, pan, delay, { attack: 0.001 });
    }

    // Golpe grave y blando (algo que cae, un paso, un bombo suave)
    thud(vol, pan = 0, delay = 0, f = 130, dur = 0.22) {
        this.tone('sine', f, f * 0.36, dur, vol, pan, delay, { attack: 0.002 });
        this.noise(dur * 0.5, vol * 0.4, 500, pan, delay, { attack: 0.001 });
    }

    // Soplo de aire (barridos, telas, movimientos rápidos)
    swish(dur, vol, f0, f1, pan = 0, delay = 0) {
        this.noise(dur, vol, f0, pan, delay, { type: 'bandpass', q: 1.2, to: f1, attack: dur * 0.35 });
    }

    // Gota de agua: un «plip» que sube
    drip(f, vol, pan = 0, delay = 0) {
        this.tone('sine', f, f * 2.2, 0.09, vol, pan, delay, { attack: 0.002, glide: 0.6 });
    }

    // Arpegio con un instrumento (inst: 'mallet', 'bell', 'pluck'); step en segundos
    arp(inst, notes, step, vol, pan = 0, delay = 0, dur) {
        notes.forEach((f, i) => this[inst](f, vol, pan, delay + i * step, dur));
    }

    // ---------- Animales y ambiente ----------
    // ¡Cuac! (el pato del lacito)
    quack() {
        if (!this.ok) return;
        for (const [d, f] of [[0, 520], [0.16, 470]]) this.tone('sawtooth', f, f * 0.6, 0.13, 0.07, 0, d, { lp: 1600, lp1: 700, q: 4 });
    }

    // Sonido de ambiente de la zona, muy suave: pájaros, agua, viento; de noche grillos y búho;
    // y los animales de las granjas cercanas (pan: de qué lado)
    ambient(kind, vol = 1, pan = 0) {
        if (!this.ok) return;
        const v = 0.05 * vol;
        if (kind === 'bird') {
            // Un trino: dos o tres pitidos que suben y bajan
            const f = 2400 + Math.random() * 1600, n = 2 + ((Math.random() * 2) | 0);
            for (let i = 0; i < n; i++) this.tone('sine', f * (1 + i * 0.08), f * (1.25 - i * 0.05), 0.07, v * 0.9, pan, i * 0.11);
        } else if (kind === 'water') {
            this.noise(0.5 + Math.random() * 0.4, v * 0.8, 600 + Math.random() * 300, pan);
            if (Math.random() < 0.4) this.drip(700 + Math.random() * 300, v * 0.6, pan, 0.2);
        } else if (kind === 'wind') {
            this.noise(1.6 + Math.random(), v * 0.9, 400 + Math.random() * 400, pan, 0, { attack: 0.6 });
        } else if (kind === 'cricket') {
            // Grillo: ráfagas de chirridos agudos
            const f = 4200 + Math.random() * 600;
            for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) this.tone('sine', f, f, 0.018, v * 0.35, pan, i * 0.28 + k * 0.03, { attack: 0.003 });
        } else if (kind === 'owl') {
            for (const [d, f] of [[0, 410], [0.45, 380], [0.75, 380]]) this.tone('sine', f, f * 0.92, 0.32, v * 1.2, pan, d, { attack: 0.08 });
        } else if (['moo', 'cluck', 'bleat', 'oink', 'baa', 'buzz', 'quackSoft'].includes(kind)) {
            const rate = this.rate;
            this.rate = 1;
            this.voice(kind, pan, v * 1.4);
            this.rate = rate;
        }
    }

    // La voz de cada animal (para el campo de tiro y, más bajito, el ambiente del mapa)
    voice(kind, pan = 0, vol = 0.08) {
        if (kind === 'moo') {
            this.tone('sawtooth', 150, 112, 0.7, vol, pan, 0, { attack: 0.12, lp: 900, lp1: 500, q: 3, vib: [5, 0.02] });
        } else if (kind === 'cluck') {
            for (const [d, f] of [[0, 760], [0.09, 820], [0.2, 700]]) this.tone('sawtooth', f, f * 0.7, 0.06, vol * 0.8, pan, d, { lp: 2400, q: 5 });
        } else if (kind === 'bleat') {
            this.tone('sawtooth', 520, 470, 0.5, vol, pan, 0, { attack: 0.03, lp: 1800, lp1: 1200, q: 4, vib: [16, 0.06] });
        } else if (kind === 'baa') {
            this.tone('sawtooth', 300, 270, 0.6, vol, pan, 0, { attack: 0.05, lp: 1300, lp1: 800, q: 4, vib: [11, 0.05] });
        } else if (kind === 'oink') {
            for (const d of [0, 0.16]) this.tone('sawtooth', 240, 180, 0.11, vol, pan, d, { lp: 900, q: 6 });
        } else if (kind === 'buzz') {
            this.tone('sawtooth', 220, 230, 0.6, vol * 0.5, pan, 0, { attack: 0.1, lp: 1400, q: 2, vib: [28, 0.03] });
        } else if (kind === 'quackSoft') {
            this.tone('sawtooth', 500, 330, 0.13, vol, pan, 0, { lp: 1500, lp1: 700, q: 4 });
        }
    }

    // ---------- Llegada de cada mercader: su vehículo ----------
    // car, bus, mini, icecream, truck, camper, tractor, mother (y here: llega o se va)
    vehicle(kind, here = true) {
        if (!this.ok) return;
        const v = 0.06;
        if (!here) {
            // Se va: su motor que se aleja y dos notas que bajan
            this.noise(1.2, v * 0.6, 500, 0.4, 0, { attack: 0.1, to: 150 });
            this.arp('mallet', [N.C5, N.F4], 0.16, v * 0.8, 0, 0.1);
            return;
        }
        const horn = (f, d, dur, delay = 0) => {
            for (const m of [1, 1.26]) this.tone('sawtooth', f * m, f * m, dur, d, 0, delay, { attack: 0.02, lp: 1200, q: 1 });
        };
        if (kind === 'car') { horn(330, v * 0.5, 0.12); horn(330, v * 0.5, 0.2, 0.18); }
        else if (kind === 'bus') { horn(196, v * 0.6, 0.45); this.noise(0.5, v, 3000, 0, 0.55, { type: 'highpass', attack: 0.01 }); } // (bocina grave y el resoplido de los frenos)
        else if (kind === 'mini') { horn(520, v * 0.4, 0.07); horn(520, v * 0.4, 0.07, 0.11); horn(520, v * 0.4, 0.07, 0.22); }
        else if (kind === 'icecream') this.arp('bell', [N.C6, N.A5, N.F5, N.A5, N.C6, N.D6, N.C6], 0.16, v * 0.9); // (la musiquilla del helado)
        else if (kind === 'truck') { this.noise(1.1, v * 0.8, 260, 0, 0, { attack: 0.15 }); horn(146, v * 0.7, 0.8, 0.3); }
        else if (kind === 'camper') { horn(262, v * 0.45, 0.25); this.arp('pluck', [N.F4, N.A4, N.C5, N.F5], 0.05, v * 1.1, 0, 0.35); }
        else if (kind === 'tractor') { for (let i = 0; i < 7; i++) this.thud(v * 0.9, 0, i * 0.11, 90, 0.09); horn(294, v * 0.4, 0.18, 0.85); }
        else if (kind === 'mother') { this.tone('sine', 70, 70, 2.2, v * 1.6, 0, 0, { attack: 0.6, vib: [3, 0.03] }); this.arp('bell', [N.F5, N.C6, N.F6], 0.22, v * 0.7, 0, 0.6, 1.6); }
        // Y, para todos, su aviso: «ha llegado alguien» (dos notas que suben)
        this.arp('mallet', [N.F5, N.C6], 0.12, v * 0.9, 0, 1.0);
    }

    // opts.rate: más agudo (>1) o más grave (<1); opts.vary: variación al azar (±; los disparos y la
    // cosecha, para que no suenen siempre igual); opts.crop: de qué es la cosecha (harvest)
    play(name, pan = 0, opts = null) {
        if (!this.ok) return;
        // (sin la respuesta del disparo «sonido», cada sonido suena siempre igual)
        const varied = Settings.feelOn('feelSound');
        this.rate = varied ? (opts && opts.rate ? opts.rate : 1) * (1 + (Math.random() - 0.5) * 2 * (opts && opts.vary !== undefined ? opts.vary : VARY[name] || 0)) : 1;
        this.opts = opts || {};
        try {
            this.playRaw(name, pan);
        } finally {
            this.rate = 1;
            this.opts = null;
        }
    }

    // La cosecha de cada cosa (una capa encima del «pop» común): suena a lo que se recoge
    cropLayer(crop, pan) {
        switch (crop) {
            case 'wheat': this.noise(0.18, 0.18, 3800, pan, 0, { type: 'bandpass', q: 0.8, to: 1800 }); break; // (espigas que crujen)
            case 'tomato': this.swish(0.16, 0.12, 5000, 2500, pan); this.pluck(N.G6, 0.05, pan, 0.02, 0.2); break; // (la hebra de seda que se suelta)
            case 'pumpkin': this.tone('sine', 330, 150, 0.12, 0.14, pan); if (Math.random() < 0.35) this.voice('bleat', pan, 0.06); break; // (el queso y, a veces, la cabra)
            case 'corn': this.bell(N.C7, 0.05, pan, 0, 0.6); this.bell(N.G6, 0.04, pan, 0.06, 0.6); break; // (una luz que se apaga)
            case 'sunflower': this.bell(N.E6 * 2, 0.05, pan, 0, 0.5); this.drip(900, 0.08, pan, 0.05); break; // (perla de cristal y burbuja)
            case 'milk': this.noise(0.25, 0.2, 1300, pan, 0, { to: 400 }); this.tone('sine', 300, 180, 0.12, 0.08, pan, 0.05); break; // (chorro en el cubo)
            case 'wool': this.noise(0.3, 0.16, 900, pan, 0, { attack: 0.05, to: 300 }); break; // (un ovillo, mullido)
            case 'egg': this.wood(3200, 0.1, pan); this.wood(2600, 0.08, pan, 0.03); break; // (cáscara)
            case 'truffle': this.thud(0.18, pan, 0, 150, 0.18); break; // (terrón)
            case 'fish': this.noise(0.3, 0.22, 1800, pan, 0, { to: 300 }); this.drip(600, 0.06, pan, 0.1); break; // (salpicón)
            case 'honey': this.drip(500, 0.1, pan); this.tone('sine', 700, 1100, 0.15, 0.04, pan, 0.06); break; // (gota pegajosa)
            case 'range': this.bell(1800, 0.06, pan, 0, 0.4); break; // (diana de chapa)
        }
    }

    playRaw(name, pan) {
        switch (name) {
            // ----- Interfaz: madera y marimba -----
            case 'ui': this.wood(1900, 0.09, pan); this.mallet(N.C6, 0.025, pan, 0, 0.12); break; // tocar un botón
            case 'open': this.swish(0.14, 0.05, 1200, 3500, pan); this.arp('mallet', [N.C5, N.F5], 0.06, 0.05, pan, 0.02, 0.25); break; // se abre una hoja
            case 'close': this.swish(0.12, 0.04, 3000, 1000, pan); this.arp('mallet', [N.F5, N.C5], 0.06, 0.04, pan, 0, 0.2); break; // se cierra
            case 'tab': this.wood(2400, 0.07, pan); break; // cambiar de pestaña o de opción
            case 'deny': this.wood(700, 0.1, pan); this.wood(560, 0.09, pan, 0.09); this.tone('sine', 196, 170, 0.18, 0.05, pan, 0, { lp: 800 }); break; // no se puede (sordo y corto)
            case 'tick': this.wood(2800, 0.05, pan); break; // texto que se escribe, ruleta
            case 'step': this.thud(0.06, pan, 0, 160, 0.08); break;
            // ----- Dinero y comercio -----
            case 'coin': this.bell(N.E6, 0.06, pan, 0, 0.5); this.bell(N.A6, 0.06, pan, 0.07, 0.7); break;
            case 'buy': this.wood(1500, 0.06, pan); this.arp('bell', [N.C6, N.E6, N.G6], 0.05, 0.05, pan, 0.03, 0.6); break; // comprar algo
            case 'sell': for (let i = 0; i < 5; i++) this.bell([N.E6, N.G6, N.A6, N.C7, N.E6 * 2][i], 0.045, pan, i * 0.06, 0.5); break; // venderle al mercader (lluvia de monedas)
            case 'gift': this.arp('bell', [N.F5, N.A5, N.C6, N.F6], 0.09, 0.06, pan); this.swish(0.4, 0.04, 2000, 6000, pan); break; // un regalo
            // ----- Progreso: cuanto más importa, más capas -----
            case 'itemSpawn': this.arp('mallet', [N.C6, N.F6], 0.1, 0.05, pan, 0, 0.4); break; // un campo, listo para recoger
            case 'build': for (let i = 0; i < 3; i++) this.wood(1100 - i * 120, 0.12, pan, i * 0.13); this.thud(0.1, pan, 0.4, 110); break; // martillazos: algo se construye
            case 'upgrade': for (let i = 0; i < 2; i++) this.wood(1000 - i * 150, 0.11, pan, i * 0.11); this.arp('pluck', [N.F4, N.A4, N.C5, N.F5], 0.06, 0.09, pan, 0.26); this.bell(N.C6, 0.05, pan, 0.5); break; // mejora: dos martillazos y sube
            case 'stolen': this.swish(0.4, 0.08, 3000, 600, pan); this.arp('pluck', [N.A4, N.F4, N.C4], 0.1, 0.08, pan, 0.05); break; // ¡te lo han robado!
            case 'power': this.arp('pluck', [N.F4, N.A4, N.C5, N.F5], 0.06, 0.09, pan); this.bell(N.C6, 0.05, pan, 0.26); break; // mejora (sube)
            case 'unlock': this.arp('mallet', [N.F4, N.A4, N.C5, N.F5, N.A5], 0.08, 0.08, pan, 0, 0.7); this.bell(N.C6, 0.06, pan, 0.42, 1.4); this.thud(0.08, pan, 0.42, 90, 0.4); break; // algo nuevo se abre
            case 'achievement': this.arp('mallet', [N.C5, N.F5, N.A5], 0.07, 0.07, pan, 0, 0.5); this.arp('bell', [N.C6, N.F6], 0.12, 0.05, pan, 0.21, 1.2); break; // logro, nivel, aviso bueno
            case 'land': this.playRaw('build', pan); this.playRaw('unlock', pan); break; // comprar una parcela: se clava el cartel y se abre
            // ----- El pueblo de los mercaderes: lo comprado, sus niveles y los fuegos -----
            case 'decorIn': this.swish(0.5, 0.05, 1500, 7000, pan); this.arp('bell', [N.C6, N.E6, N.G6, N.C7], 0.07, 0.045, pan, 0.08, 1.0); this.tone('sine', N.C5, N.C6, 0.45, 0.04, pan, 0, { attack: 0.02 }); break; // sube un rayo de luz: algo nuevo en su sitio
            case 'townBuild': this.tone('sine', 110, 220, 0.9, 0.07, pan, 0, { attack: 0.2, lp: 900 }); this.noise(1.0, 0.04, 2500, pan, 0, { type: 'bandpass', to: 6000, attack: 0.3 }); this.arp('bell', [N.F5, N.A5, N.C6], 0.12, 0.04, pan, 0.5, 1.0); break; // los bloques de luz: algo grande se construye
            case 'townLevel': // fanfarria: el pueblo sube de nivel
                this.arp('pluck', [N.C4, N.E4, N.G4, N.C5], 0.09, 0.1, pan);
                this.arp('mallet', [N.C5, N.E5, N.G5, N.C6], 0.09, 0.09, pan, 0.36, 0.6);
                for (const [f, d] of [[N.C5, 0.72], [N.E5, 0.72], [N.G5, 0.72]]) this.tone('triangle', f, f, 1.4, 0.05, pan, d, { attack: 0.04, vib: [5.5, 0.006] });
                this.arp('bell', [N.C6, N.G6, N.C7], 0.12, 0.05, pan, 0.8, 1.6);
                this.thud(0.1, pan, 0.72, 90, 0.5);
                break;
            case 'shutter': this.noise(0.04, 0.12, 4000, pan, 0, { type: 'highpass' }); this.thud(0.08, pan, 0.02, 160, 0.08); this.noise(0.05, 0.09, 3000, pan, 0.09, { type: 'highpass' }); this.tone('square', 1800, 1800, 0.03, 0.02, pan, 0.1); break; // clic de cámara
            case 'fwLaunch': this.tone('sine', 700, 2400, 0.55, 0.025, pan, 0, { attack: 0.05 }); this.noise(0.5, 0.025, 3000, pan, 0, { type: 'highpass', to: 5000 }); break; // sube un cohete (silbido)
            case 'fwBoom': this.thud(0.14, pan, 0, 70, 0.6); this.noise(0.7, 0.09, 1800, pan, 0, { to: 200 }); for (let i = 0; i < 6; i++) this.noise(0.05, 0.03, 5000, pan, 0.15 + Math.random() * 0.5, { type: 'highpass' }); break; // estalla (y chisporrotea)
            case 'secret': for (let i = 0; i < 8; i++) this.bell([N.C6, N.D6, N.F6, N.G6, N.A6, N.C7, N.D6 * 2, N.F6 * 2][i], 0.035, pan, i * 0.07, 0.9); break; // magia, brillo, sorpresa
            case 'win': this.arp('mallet', [N.F4, N.C5, N.F5, N.A5], 0.09, 0.08, pan, 0, 0.6); this.arp('bell', [N.C6, N.F6], 0.18, 0.05, pan, 0.36, 1.5); this.thud(0.08, pan, 0.36, 100, 0.4); break; // campo terminado
            case 'go': this.swish(0.35, 0.08, 800, 4000, pan); this.arp('pluck', [N.C5, N.F5], 0.08, 0.08, pan, 0.15); break; // ¡al campo de tiro!
            case 'warn': for (const d of [0, 0.22]) { this.mallet(N.E5, 0.07, pan, d, 0.25); this.mallet(N.F5, 0.06, pan, d + 0.09, 0.25); } break; // atención (sin pitar)
            case 'ring': for (let i = 0; i < 8; i++) this.bell(i % 2 ? N.C6 : N.E6, 0.035, 0, i * 0.055, 0.25); break; // el teléfono del mercader
            case 'radar': this.bell(N.A5, 0.06, pan, 0, 1.4); this.bell(N.A5, 0.035, pan, 0.3, 1); break;
            case 'shieldGet': this.arp('mallet', [N.C5, N.E5, N.G5, N.C6], 0.05, 0.06, pan, 0, 0.4); break; // algo puesto o equipado
            case 'bounceGet': this.arp('bell', [N.F5, N.A5, N.C6], 0.06, 0.05, pan, 0, 0.7); break; // algo bueno, mediano
            case 'candy': this.arp('bell', [N.C6, N.E6, N.G6, N.C7], 0.04, 0.04, pan, 0, 0.5); break;
            case 'spot': this.arp('mallet', [N.A5, N.D6], 0.06, 0.05, pan, 0, 0.3); break; // medalla pequeña
            // ----- El pozo de los deseos (gacha) y sus rarezas -----
            case 'wishCoin': this.bell(N.E6, 0.05, pan, 0, 0.4); this.drip(900, 0.08, pan, 0.55); this.noise(0.4, 0.08, 1200, pan, 0.55, { to: 300 }); break; // la moneda cae al agua
            case 'charge': for (let i = 0; i < 12; i++) this.bell(N.F5 * Math.pow(2, i / 12), 0.012 + i * 0.002, pan, i * 0.13, 0.35); this.noise(1.6, 0.05, 600, pan, 0, { to: 4000, attack: 1.2 }); break; // el pozo se carga
            case 'tierCommon': this.arp('mallet', [N.C5, N.F5], 0.1, 0.07, pan, 0, 0.5); break;
            case 'tierRare': this.arp('mallet', [N.F4, N.C5, N.F5, N.A5], 0.08, 0.07, pan, 0, 0.6); this.bell(N.C6, 0.05, pan, 0.3, 1.3); break;
            case 'tierEpic': this.thud(0.14, pan, 0, 80, 0.6); this.arp('mallet', [N.F4, N.A4, N.C5, N.F5, N.A5, N.C6], 0.07, 0.07, pan, 0, 0.7); this.arp('bell', [N.F6, N.A6, N.C7], 0.1, 0.05, pan, 0.42, 1.6); this.swish(1.2, 0.05, 1500, 7000, pan, 0.2); break;
            // ----- Francotirador -----
            // Disparo: chasquido seco, cuerpo grave y la cola por el valle
            case 'snipe': this.noise(0.08, 0.7, 6000, pan, 0, { type: 'highpass', attack: 0.001 }); this.thud(0.55, pan, 0, 140, 0.32); this.noise(0.4, 0.3, 2200, pan, 0, { attack: 0.002, to: 300 }); if (Settings.feelOn('feelSound')) this.noise(1.1, 0.08, 700, pan, 0.1, { attack: 0.05, to: 200 }); break;
            // Las otras armas: la pistola (seca y corta), el subfusil (un chasquido rápido, para
            // repetirlo muchas veces) y la escopeta (estampido grave y ancho, y su corredera)
            case 'pistol': this.noise(0.05, 0.5, 5500, pan, 0, { type: 'highpass', attack: 0.001 }); this.thud(0.32, pan, 0, 200, 0.18); this.noise(0.2, 0.14, 2500, pan, 0, { attack: 0.002, to: 400 }); break;
            case 'smg': this.noise(0.035, 0.38, 5000, pan, 0, { type: 'highpass', attack: 0.001 }); this.thud(0.22, pan, 0, 180, 0.1); break;
            case 'shotgun': this.noise(0.12, 0.8, 4000, pan, 0, { type: 'highpass', attack: 0.001 }); this.thud(0.7, pan, 0, 90, 0.42); this.noise(0.55, 0.32, 1500, pan, 0, { attack: 0.002, to: 200 }); this.noise(0.05, 0.16, 1400, pan, 0.38, { type: 'bandpass', q: 4 }); this.noise(0.05, 0.16, 1000, pan, 0.5, { type: 'bandpass', q: 4 }); break;
            case 'bolt': this.noise(0.03, 0.18, 2600, pan, 0, { type: 'bandpass', q: 5 }); this.noise(0.04, 0.2, 1900, pan, 0.12, { type: 'bandpass', q: 5 }); this.tone('sine', 900, 700, 0.05, 0.04, pan, 0.12); break; // cerrojo: atrás y adelante
            case 'scopeIn': this.swish(0.12, 0.08, 1500, 4000, 0); this.wood(3000, 0.03, 0, 0.1); break;
            case 'scopeOut': this.swish(0.1, 0.06, 3500, 1200, 0); break;
            case 'reload': this.noise(0.05, 0.16, 1600, pan, 0, { type: 'bandpass', q: 4 }); this.noise(0.05, 0.14, 1200, pan, 0.11, { type: 'bandpass', q: 4 }); break; // el cargador sale
            case 'reloaded': this.noise(0.04, 0.2, 2200, pan, 0, { type: 'bandpass', q: 5 }); this.tone('sine', 1200, 1100, 0.08, 0.04, pan, 0.02); break; // y entra: ¡clac!
            case 'harvest': this.mallet((this.opts && this.opts.crop) === 'corn' ? N.C6 : N.F5, 0.05, pan, 0, 0.3); this.tone('sine', 500, 900, 0.06, 0.06, pan); this.cropLayer(this.opts && this.opts.crop, pan); break; // ¡recogido! (un «pop» y lo que es)
            case 'miss': this.thud(0.08, pan, 0, 170, 0.12); this.noise(0.15, 0.1, 900, pan, 0, { to: 250 }); break; // la bala en la tierra
            case 'wall': this.noise(0.06, 0.16, 2600, pan, 0, { type: 'bandpass', q: 3 }); this.tone('sine', 1400, 900, 0.12, 0.04, pan, 0.02); break; // rebote en piedra o chapa
            case 'corner': this.swish(0.35, 0.07, 700, 2200, 0); this.wood(900, 0.05, 0, 0.12); this.wood(1000, 0.05, 0, 0.3); break; // cambiar de torre: escalera y viento
            case 'tink': this.bell(3200, 0.03, pan, 0, 0.25); this.bell(3600, 0.02, pan, 0.07, 0.2); break; // el casquillo al caer
            case 'pop': this.tone('sine', 400, 900, 0.07, 0.07, pan); break;
            case 'hitmark': this.wood(3200, 0.1, pan); this.tone('sine', 1800, 1600, 0.05, 0.05, pan); break; // acierto a un alienígena: seco y claro
            case 'turret': this.noise(0.05, 0.12, 1800, pan, 0, { type: 'bandpass', q: 2 }); this.thud(0.05, pan, 0, 180, 0.06); break;
            case 'drop': this.thud(0.22, pan, 0, 150, 0.25); this.noise(0.15, 0.12, 700, pan); break; // algo que cae al suelo
            case 'itemPick': this.arp('bell', [N.C6, N.G6], 0.05, 0.05, pan, 0, 0.4); break;
            case 'grabOther': this.arp('pluck', [N.C5, N.A4, N.F4], 0.08, 0.08, pan); break; // un alienígena se lleva algo (baja: ¡vaya!)
            case 'crateHit': this.wood(500, 0.18, pan); this.thud(0.1, pan, 0, 180, 0.1); break; // golpe en madera
            case 'crateBreak': this.noise(0.3, 0.35, 1600, pan, 0, { to: 300 }); for (let i = 0; i < 3; i++) this.wood(700 + Math.random() * 600, 0.1, pan, 0.03 + i * 0.05); break;
            case 'metal': this.bell(620, 0.08, pan, 0, 0.6); this.noise(0.05, 0.15, 3000, pan, 0, { type: 'bandpass', q: 3 }); break; // ¡clonc! (metal)
            case 'sand': this.noise(0.25, 0.08, 1000, pan, 0, { attack: 0.03, to: 300 }); break; // barro, arena
            case 'boing': this.tone('sine', 220, 520, 0.16, 0.08, pan, 0, { glide: 0.5 }); break; // bote blando
            case 'splat': this.noise(0.16, 0.25, 1100, pan, 0, { to: 200 }); this.thud(0.08, pan, 0, 200, 0.1); break;
            case 'moo': this.voice('moo', pan, 0.09); break;
            case 'cluck': this.voice('cluck', pan, 0.07); break;
            case 'bleat': this.voice('bleat', pan, 0.07); break;
            case 'oink': this.voice('oink', pan, 0.08); break;
            case 'baa': this.voice('baa', pan, 0.07); break;
            case 'buzz': this.voice('buzz', pan, 0.07); break;
            case 'bubble': this.drip(500 + Math.random() * 300, 0.05, pan); break;
            case 'whoosh': this.swish(0.45, 0.14, 600, 5000, pan); break;
            case 'laser': this.tone('sine', 1800, 300, 0.3, 0.09, pan, 0, { vib: [30, 0.05] }); this.tone('sine', 220, 220, 1.0, 0.04, pan, 0.2, { vib: [8, 0.04] }); break;
            // ----- Rachas, ovnis y alienígenas -----
            case 'grenade': this.wood(2600, 0.08, pan); this.tone('sine', 1500, 500, 1.3, 0.035, pan, 0.1); break; // anilla y silbido que cae
            case 'missile': this.noise(1.2, 0.3, 1800, 0, 0, { attack: 0.08, to: 600 }); this.tone('sine', 120, 420, 1.2, 0.05); break;
            case 'boost': this.noise(0.5, 0.35, 3200, 0, 0, { attack: 0.03 }); this.tone('sine', 300, 900, 0.5, 0.05); break;
            case 'plane': this.tone('sawtooth', 62, 70, 4.5, 0.06, 0, 0, { attack: 1, lp: 300 }); this.tone('sawtooth', 93, 88, 4.5, 0.04, 0, 0, { attack: 1, lp: 300 }); this.noise(4.5, 0.12, 500, 0, 0, { attack: 1 }); break;
            case 'siren': this.tone('sine', 660, 880, 0.45, 0.07, 0, 0, { attack: 0.05 }); break;
            case 'ufo': this.tone('sine', 700, 700, 1.4, 0.06, 0, 0, { attack: 0.2, vib: [6, 0.18] }); this.tone('sine', 1050, 1050, 1.4, 0.025, 0, 0.1, { attack: 0.3, vib: [6, 0.18] }); break; // un theremín
            case 'nukeFall': this.tone('sine', 1600, 160, 5, 0.05); this.noise(5, 0.08, 1200, 0, 0, { attack: 2 }); break;
            case 'nuke': this.noise(3, 0.9, 700, 0, 0, { attack: 0.01, to: 80 }); this.thud(0.9, 0, 0, 70, 3); break;
            case 'boom': this.noise(0.9, 0.7, 900, pan, 0, { attack: 0.003, to: 120 }); this.thud(0.6, pan, 0, 120, 0.8); break;
            // ----- Día y noche -----
            case 'dawn': this.tone('sawtooth', 600, 900, 0.25, 0.04, 0.4, 0, { lp: 2500, q: 3, glide: 0.5 }); this.tone('sawtooth', 900, 700, 0.6, 0.04, 0.4, 0.25, { lp: 2500, q: 3, vib: [9, 0.03] }); this.arp('bell', [N.F5, N.A5, N.C6], 0.18, 0.035, 0, 0.9, 1.6); break; // el gallo y un acorde que se abre
            case 'dusk': this.arp('bell', [N.C6, N.A5, N.F5], 0.25, 0.03, 0, 0, 2); this.playRaw('cricketsOn', pan); break; // se hace de noche
            case 'cricketsOn': for (let i = 0; i < 3; i++) this.ambient('cricket', 0.8, i - 1); break;
            case 'market': this.arp('mallet', [N.C5, N.F5, N.A5, N.C6, N.A5, N.C6], 0.09, 0.06, pan, 0, 0.4); for (let i = 0; i < 8; i++) this.noise(0.05, 0.025, 6000, pan, i * 0.09, { type: 'highpass', to: 6000 }); break; // ¡día de mercado!
            case 'village': this.playRaw('build', pan); this.playRaw('achievement', pan); break; // el pueblo crece
        }
    }
}
