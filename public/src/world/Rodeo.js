import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { wrapAngle } from '../core/math.js';
import { CROPS } from '../content/crops.js';
import { buildHorse, animateHorse } from '../render/horse.js';

// El rodeo (el campo de tiro de las fichas de caballo): el jugador va montado a caballo dando
// vueltas a una pista ovalada con su valla blanca a cada lado. El caballo corre solo y salta las
// vallas de salto que hay por la pista; el jugador solo mira y dispara:
//   - obstáculos (balas de paja, barriles y cajas) que van saliendo en la pista por delante: si no
//     se les dispara a tiempo, el caballo se los come y tropieza (pierde velocidad un rato)
//   - jinetes alienígenas en caballos alienígenas (con sus caretas de cartón, como los coches de
//     los mercaderes) que vienen de frente por la pista: si llegan, te arrollan y se llevan una
//     ficha (una vuelta menos); abatidos, suman a la racha alienígena
// Cada vuelta completa da una ficha de caballo: los blancos del campo son las vueltas (lap: no se
// les dispara), y lo que se dispara (obstáculos y jinetes) no cuenta para lo recogido (noLoot).
const INK = 0x2a1a0e;
const _d = new THREE.Object3D();
const _v = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const EYE = 2.75; // la vista del jinete (a lomos del caballo)
const HALF = 1.9; // media anchura de la pista (de la valla de dentro a la de fuera)

export class Rodeo {
    constructor(outlineColor) {
        this.root = new THREE.Group();
        this.outlineColor = outlineColor;
        this.ink = outline(outlineColor);
        this.mats = new Map();
        this.list = []; // lo que se mueve (obstáculos y jinetes)
        this.decor = [];
        this.laps = [];
        this.on = false;
    }

    mat(c) {
        return this.mats.get(c) || this.mats.set(c, toon(c)).get(c);
    }

    part(g, w, h, d, c, x, y, z, line = true) {
        const m = new THREE.Mesh(box(w, h, d), this.mat(c));
        m.position.set(x, y, z);
        g.add(m);
        if (line) {
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.ink);
            o.position.copy(m.position);
            g.add(o);
        }
        return m;
    }

    // ---------- La pista: un óvalo medido por su longitud (s, en metros) ----------
    buildTrack(f) {
        const sc = f.scale || 1, rx = 8.6 * sc, rz = 5.8 * sc, N = 720, pts = [];
        let len = 0;
        for (let i = 0; i <= N; i++) {
            const a = (i / N) * Math.PI * 2, x = f.cx + Math.cos(a) * rx, z = f.cz + Math.sin(a) * rz;
            if (i) len += Math.hypot(x - pts[i - 1].x, z - pts[i - 1].z);
            pts.push({ x, z, s: len });
        }
        this.track = { pts, len, N };
    }

    // Punto de la pista a s metros de la salida, desplazado side metros hacia fuera: { x, z, tx, tz }
    at(s, side = 0, out = {}) {
        const T = this.track, L = T.len;
        s = ((s % L) + L) % L;
        let lo = 0, hi = T.N;
        while (hi - lo > 1) {
            const m = (lo + hi) >> 1;
            if (T.pts[m].s <= s) lo = m;
            else hi = m;
        }
        const a = T.pts[lo], b = T.pts[hi], k = (s - a.s) / Math.max(1e-6, b.s - a.s), d = Math.max(1e-6, b.s - a.s);
        const tx = (b.x - a.x) / d, tz = (b.z - a.z) / d;
        // (hacia fuera: la normal que se aleja del centro; el óvalo va al revés de las agujas)
        out.x = a.x + (b.x - a.x) * k + tz * side;
        out.z = a.z + (b.z - a.z) * k - tx * side;
        out.tx = tx;
        out.tz = tz;
        return out;
    }

    // Vallas blancas a los dos lados (postes y dos travesaños), instanciadas, y la tierra de la pista
    buildFences() {
        const L = this.track.len, n = Math.round(L / 2.2), posts = [], rails = [], dirt = [];
        const p = {}, q = {};
        for (const side of [-HALF - 0.2, HALF + 0.2]) for (let i = 0; i < n; i++) {
            const s0 = (i / n) * L, s1 = ((i + 1) / n) * L;
            this.at(s0, side, p);
            this.at(s1, side, q);
            posts.push({ x: p.x, y: 0.55, z: p.z, sx: 0.16, sy: 1.1, sz: 0.16, ry: 0, c: 0x8a5a34 });
            const ry = Math.atan2(q.x - p.x, q.z - p.z), len = Math.hypot(q.x - p.x, q.z - p.z);
            for (const y of [0.5, 0.92]) rails.push({ x: (p.x + q.x) / 2, y, z: (p.z + q.z) / 2, sx: 0.08, sy: 0.12, sz: len + 0.05, ry, c: 0xfff6e8 });
        }
        // La tierra batida de la pista (más oscura que la arena del ruedo)
        for (let i = 0; i < n * 2; i++) {
            const s0 = (i / (n * 2)) * L, s1 = ((i + 1) / (n * 2)) * L;
            this.at(s0, 0, p);
            this.at(s1, 0, q);
            dirt.push({ x: (p.x + q.x) / 2, y: 0.035, z: (p.z + q.z) / 2, sx: HALF * 2, sy: 0.04, sz: Math.hypot(q.x - p.x, q.z - p.z) + 0.1, ry: Math.atan2(q.x - p.x, q.z - p.z), c: i % 2 ? 0xb8925a : 0xc09a62, flat: true });
        }
        this.instances([...posts, ...rails], true);
        this.instances(dirt, false);
    }

    instances(list, line) {
        const make = (m) => {
            const mesh = new THREE.InstancedMesh(box(1, 1, 1), m, list.length);
            list.forEach((b, i) => {
                const o = line && m === this.ink ? OUTLINE * 2 : 0;
                _d.position.set(b.x, b.y, b.z);
                _d.rotation.set(0, b.ry, 0);
                _d.scale.set(b.sx + o, b.sy + o, b.sz + o);
                _d.updateMatrix();
                mesh.setMatrixAt(i, _d.matrix);
                if (m !== this.ink) mesh.setColorAt(i, new THREE.Color(b.c));
            });
            this.root.add(mesh);
            this.decor.push(mesh);
        };
        make(toon(0xffffff));
        if (line) make(this.ink);
    }

    // Una valla de salto atravesada en la pista (postes de rayas y dos barras rojas y blancas)
    hurdle(s) {
        const g = new THREE.Group(), p = this.at(s);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = Math.atan2(p.tx, p.tz);
        for (const x of [-HALF + 0.1, HALF - 0.1]) {
            for (let k = 0; k < 4; k++) this.part(g, 0.18, 0.3, 0.18, k % 2 ? 0xffffff : 0xc8402e, x, 0.15 + k * 0.3, 0, k === 0);
            this.part(g, 0.28, 0.08, 0.28, 0xffd23f, x, 1.24, 0);
        }
        for (const [y, c] of [[0.42, 0xffffff], [0.78, 0xc8402e]]) this.part(g, HALF * 2 - 0.3, 0.1, 0.1, c, 0, y, 0);
        this.root.add(g);
        this.decor.push(g);
        this.hurdles.push({ s, g });
    }

    // La salida (y la meta): raya blanca en el suelo y su arco con el cartel y banderines
    finishLine() {
        const g = new THREE.Group(), p = this.at(0);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = Math.atan2(p.tx, p.tz);
        for (let k = 0; k < 8; k++) this.part(g, (HALF * 2) / 8, 0.04, 0.4, k % 2 ? 0xffffff : 0x2a2622, -HALF + (k + 0.5) * (HALF * 2) / 8, 0.07, 0, false);
        for (const x of [-HALF - 0.5, HALF + 0.5]) this.part(g, 0.24, 3.6, 0.24, 0x8a5a34, x, 1.8, 0);
        this.part(g, HALF * 2 + 1.6, 0.7, 0.16, 0xffd23f, 0, 3.4, 0);
        this.part(g, HALF * 2 + 1.2, 0.46, 0.18, 0xc8402e, 0, 3.4, 0, false);
        for (let k = 0; k < 7; k++) this.part(g, 0.24, 0.3, 0.04, [0x5ab4ff, 0xffd23f, 0xff7ae0, 0x7dff4a][k % 4], -HALF + k * (HALF * 2) / 6, 2.85, 0, false);
        this.root.add(g);
        this.decor.push(g);
    }

    // count: las vueltas (cada una, una ficha). f: el campo (SniperField)
    spawn(count, f) {
        this.clear();
        this.f = f;
        this.on = true;
        this.hold = false;
        this.buildTrack(f);
        this.buildFences();
        this.finishLine();
        this.hurdles = [];
        const L = this.track.len, nh = f.scale > 1.6 ? 4 : 3;
        for (let k = 0; k < nh; k++) this.hurdle(L * (k + 0.55) / nh);
        // Las vueltas (los blancos que cuentan): invisibles y lejos de todo, no brotan ni se disparan
        for (let i = 0; i < count; i++) {
            const s = { kind: 'lap', lap: true, mod: this, x: f.cx + 9999, y: -50, z: f.cz, hb: [0.01, 0.01, 0.01], alive: true, landed: false, grow: -1e9, flash: 0, dying: 0 };
            this.laps.push(s);
            f.targets.push(s);
        }
        // El caballo del jugador: se ve su cuello y su cabeza por delante
        this.mount = buildHorse(this.ink);
        this.root.add(this.mount.g);
        this.decor.push(this.mount.g);
        // La carrera: s (metros recorridos desde la salida), v (velocidad) y lo demás
        this.R = { s: 1.5, v: 0, yaw: null, stun: 0, jump: -1, lap: 0, nextObs: 3, nextRider: rand(3, 5) };
    }

    hittable(s) {
        return s.alive && s.landed && !s.lap;
    }

    get speed() {
        return CROPS.tomato.speed * Math.sqrt(this.f.scale || 1);
    }

    // ---------- Lo que sale en la pista ----------
    // Lejos de las vallas de salto, de la salida y de lo que ya hay
    freeS(s) {
        const L = this.track.len, gap = (a, b) => {
            const d = (((a - b) % L) + L) % L;
            return Math.min(d, L - d);
        };
        if (this.hurdles.some((h) => gap(h.s, s) < 4) || gap(0, s) < 3) return false;
        return !this.list.some((o) => o.alive && gap(o.s, s) < 4);
    }

    obstacle(s) {
        const g = new THREE.Group(), kind = ['hay', 'barrel', 'crate'][(Math.random() * 3) | 0];
        let hb;
        if (kind === 'hay') {
            this.part(g, 1.3, 0.8, 0.9, 0xe8c050, 0, 0.4, 0);
            for (const x of [-0.35, 0.35]) this.part(g, 0.06, 0.82, 0.92, 0x8a5a2e, x, 0.4, 0, false);
            hb = [0.7, 0.45, 0.5];
        } else if (kind === 'barrel') {
            this.part(g, 0.8, 1.0, 0.8, 0x9a6a3a, 0, 0.5, 0);
            for (const y of [0.2, 0.8]) this.part(g, 0.84, 0.08, 0.84, 0x4a3a2a, 0, y, 0, false);
            hb = [0.45, 0.55, 0.45];
        } else {
            this.part(g, 0.95, 0.95, 0.95, 0xc8955a, 0, 0.48, 0);
            for (const r of [0.6, -0.6]) {
                const m = this.part(g, 1.2, 0.1, 0.02, 0x8a5a2e, 0, 0.48, 0.49, false);
                m.rotation.z = r;
            }
            hb = [0.55, 0.55, 0.55];
        }
        const side = rand(-0.9, 0.9), p = this.at(s, side);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = Math.atan2(p.tx, p.tz) + rand(-0.3, 0.3);
        g.scale.setScalar(0.0001);
        this.root.add(g);
        const o = { kind: 'obstacle', mod: this, noLoot: true, obj: g, s, side, x: p.x, y: hb[1], z: p.z, hb, alive: true, landed: false, grow: 0, flash: 0, dying: 0, gone: 0 };
        this.list.push(o);
        this.f.targets.push(o);
    }

    // Un jinete alienígena que viene de frente por la pista (s: dónde sale)
    rider(s) {
        const h = buildHorse(this.ink, true), side = rand(-0.8, 0.8), p = this.at(s, side);
        h.g.position.set(p.x, 0, p.z);
        h.g.scale.setScalar(0.0001);
        this.root.add(h.g);
        const o = { kind: 'rider', mod: this, noLoot: true, rider: true, h, obj: h.g, s, side, v: rand(4.5, 6), x: p.x, y: 1.5, z: p.z, hb: [0.6, 1.5, 0.6], alive: true, landed: false, grow: 0, flash: 0, dying: 0, gone: 0, spin: 0 };
        this.list.push(o);
        this.f.targets.push(o);
        return o;
    }

    // ---------- La carrera (la llama Sniper en cada fotograma) ----------
    ride(dt, sn) {
        const R = this.R, L = this.track.len;
        if (!R) return;
        const done = sn.ending >= 0;
        // Velocidad: arranca poco a poco; tras un tropiezo va despacio un rato; al acabar (o con hold,
        // para las pruebas), se para
        R.stun = Math.max(0, R.stun - dt);
        const want = done || this.hold ? 0 : this.speed * (R.stun > 0 ? 0.3 : 1);
        R.v += (want - R.v) * Math.min(1, dt * (R.stun > 0 ? 6 : 1.4));
        R.s += R.v * dt;
        // Las vueltas: cada vez que se pasa por la meta, una ficha
        while (!done && R.s >= (R.lap + 1) * L) {
            R.lap++;
            const lap = this.laps.find((l) => l.alive);
            if (lap) {
                const p = this.at(R.s + 6);
                lap.x = p.x;
                lap.y = 2.6;
                lap.z = p.z;
                lap.landed = true;
                if (sn.hooks.onLap) sn.hooks.onLap(R.lap);
                sn.harvest([lap]);
                lap.x += 9999;
            }
        }
        // Las vallas de salto: el caballo salta solo al llegar (la vista sube y baja)
        const pos = R.s % L;
        if (R.jump < 0 && R.v > 1) for (const h of this.hurdles) {
            const ahead = ((h.s - pos) % L + L) % L;
            if (ahead < R.v * 0.32) {
                R.jump = 0;
                sn.hooks.sfx.play('whoosh');
                break;
            }
        }
        let air = 0;
        if (R.jump >= 0) {
            R.jump += dt / 0.75;
            air = Math.sin(Math.min(1, R.jump) * Math.PI);
            if (R.jump >= 1) {
                R.jump = -1;
                sn.dipV -= 2.6;
                sn.trauma = Math.min(1, sn.trauma + 0.15);
                sn.hooks.sfx.play('drop');
                const p = this.at(R.s);
                sn.particles.burst(p.x, 0.1, p.z, 16, [sn.theme.dust, 0xc09a62], { speed: 1.8, up: 1.4, size: 0.1, ttl: 0.5 });
            }
        }
        // La vista: a lomos del caballo, con el trote; el giro de la pista gira también la vista
        const p = this.at(R.s), k = Math.min(1, R.v / 4);
        R.step = (R.step || 0) + dt * (2 + R.v * 1.6);
        const yaw = Math.atan2(-p.tx, -p.tz);
        if (R.yaw !== null) sn.lookYaw += wrapAngle(yaw - R.yaw);
        else [sn.lookYaw, sn.lookPitch] = [yaw, -0.04]; // (al empezar, mirando al frente)
        R.yaw = yaw;
        sn.pos.set(p.x, EYE + air * 1.25 + Math.abs(Math.sin(R.step)) * 0.12 * k, p.z);
        // El caballo (debajo del jinete): se le ve el cuello y la cabeza por delante
        const M = this.mount;
        M.g.position.set(p.x - p.tx * 0.75, air * 1.25, p.z - p.tz * 0.75); // (el jinete, sentado en la silla)
        M.g.rotation.y = Math.atan2(p.tx, p.tz);
        M.step = R.step;
        animateHorse(M, 0, sn.time, R.v, air);
        M.g.rotation.x = -air * 0.25;
        if (done) return;
        // Obstáculos que salen por delante
        if (!this.hold && (R.nextObs -= dt) <= 0) {
            R.nextObs = rand(2.0, 3.4) / Math.sqrt(this.f.scale || 1);
            for (let t = 0; t < 6; t++) {
                const s = R.s + rand(20, 28) * Math.min(1.4, Math.sqrt(this.f.scale || 1));
                if (this.freeS(s)) {
                    this.obstacle(s);
                    break;
                }
            }
        }
        // Jinetes alienígenas (más de noche)
        const aliens = sn.walkersOn !== false && !(sn.debug && sn.debug.noAliens) && !sn.calm;
        if (aliens && !this.hold && (R.nextRider -= dt) <= 0) {
            R.nextRider = rand(4, 7) / (1 + (sn.nightK || 0));
            const r = this.rider(R.s + rand(30, 40) * Math.min(1.4, Math.sqrt(this.f.scale || 1)));
            if (r) sn.hooks.sfx.play('neigh');
        }
        // Lo que se le echa encima al jugador: lo que llega vivo, tropiezo (y el jinete se lleva una ficha)
        for (const o of this.list) {
            if (!o.alive) continue;
            if (o.rider && o.landed) o.s -= o.v * dt;
            const gap = o.s - R.s;
            if (gap < (o.rider ? 1.2 : 0.7)) this.crash(o, sn);
            else if (gap < -3) o.alive = false;
        }
    }

    // Choque contra algo de la pista: tropiezo, sacudida y su ruido; el jinete, además, se lleva
    // una ficha (una vuelta menos)
    crash(o, sn) {
        const R = this.R;
        o.alive = false;
        o.crashed = true;
        R.stun = o.rider ? 1.8 : 1.3;
        sn.trauma = 1;
        sn.dipV -= 3;
        sn.streak = sn.streakT = 0;
        sn.hooks.sfx.play('crateHit');
        sn.hooks.sfx.play('drop');
        sn.particles.burst(o.x, 0.6, o.z, 30, o.rider ? [0x7dff4a, 0xd8ffb0, 0xffffff] : [0xe8c050, 0x9a6a3a, sn.theme.dust], { speed: 3, up: 3, size: 0.12, ttl: 0.7 });
        if (sn.hooks.onCrash) sn.hooks.onCrash(!!o.rider);
        if (o.rider) {
            const lap = [...this.laps].reverse().find((l) => l.alive);
            if (lap) {
                lap.alive = false;
                _v.set(o.x, 2.5, o.z).project(sn.camera);
                if (sn.hooks.onStolen) sn.hooks.onStolen(lap, _v.x, _v.y);
            }
            sn.checkEnd();
        }
    }

    // Animación de lo que hay en la pista (la llama el campo en cada fotograma)
    update(dt, time) {
        if (!this.on) return;
        const p = {};
        this.list = this.list.filter((o) => {
            const k = o.landed ? 1 : Math.max(0.0001, typeof o.g === 'number' ? o.g : 0.0001);
            if (!o.alive) o.gone += dt * (o.crashed ? 3 : 1.4);
            if (o.rider) {
                this.at(o.s, o.side, p);
                o.x = p.x;
                o.z = p.z;
                // Abatido: el jinete sale volando dando vueltas y el caballo se va al galope y se encoge
                if (!o.alive && !o.crashed) {
                    o.spin += dt;
                    o.h.rider.position.y = 1.66 + Math.sin(Math.min(1, o.spin / 0.6) * Math.PI) * 1.5;
                    o.h.rider.rotation.x += dt * 14;
                }
                o.obj.position.set(o.x, 0, o.z);
                o.obj.rotation.y = Math.atan2(-p.tx, -p.tz); // (de frente: al revés que el jugador)
                animateHorse(o.h, dt, time, o.landed ? o.v : 0);
                o.s -= (!o.alive ? o.v * 0.5 : 0) * dt;
            } else if (!o.alive && !o.crashed) {
                o.obj.position.y = Math.sin(Math.min(1, o.gone * 2) * Math.PI) * 1.2;
                o.obj.rotation.x += dt * 9;
            }
            if (o.flash > 0) o.obj.position.y += o.flash * 0.05;
            o.obj.scale.setScalar(o.alive ? k : Math.max(0.0001, 1 - o.gone));
            if (o.gone >= 1) {
                this.root.remove(o.obj);
                const i = this.f.targets.indexOf(o);
                if (i >= 0) this.f.targets.splice(i, 1);
                return false;
            }
            return true;
        });
    }

    clear() {
        for (const g of [...this.list.map((o) => o.obj), ...this.decor]) this.root.remove(g);
        for (const m of this.decor) if (m.isInstancedMesh) m.dispose();
        this.list.length = 0;
        this.decor.length = 0;
        this.laps.length = 0;
        this.hurdles = [];
        this.R = null;
        this.on = false;
    }
}
