// La vida del pueblo: el tráfico de la ronda (coches que frenan si tienen a otro delante, con sus
// luces de freno, y un autobús que para en sus paradas), los paseantes de los barrios (salen de una
// casa, van por la acera de la ronda y entran en otra) y, de noche, luciérnagas en los parques.
import * as THREE from 'three';
import { box, bakeGroup } from './materials.js';
import { VILLAGE } from '../content/merchants.js';

const TAU = Math.PI * 2;
const LANE = 0.55, WALK = 1.65; // (el carril, desde el centro de la ronda; la acera)
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const SKIN = [0xffc89a, 0xe8a878, 0xc88a5a, 0x9a6a4a, 0xffd8b0];
const SHIRT = [0xd84a3a, 0x3a8ad8, 0xffd23f, 0x7dff4a, 0xff7ae0, 0x5ae8c8, 0xe8e0d0, 0x8a4a8a, 0xff9a2a];
const PANTS = [0x2a3a5a, 0x3a3a4a, 0x6a4a2a, 0x4a5a3a];

export class TownLife {
    constructor(V) {
        this.V = V;
        const P = (a, r) => ({ x: VILLAGE.cx + Math.cos(a) * r, z: VILLAGE.cz + Math.sin(a) * r });
        this.P = P;
        // --- El tráfico: los coches del pueblo (render/town.js) y el autobús, por sus carriles
        this.vehicles = V.cars.map((C) => ({ ...C, cruise: C.v, len: 1.9 }));
        this.vehicles.push(this.buildBus());
        for (const C of this.vehicles) C.brake = this.brakeLights(C);
        // Las paradas del autobús: cuatro, repartidas (lejos de las calles: donde haya acera)
        this.stops = [0.35, 1.95, 3.5, 5.1];
        // --- Los paseantes de los barrios
        this.walkers = Array.from({ length: 10 }, (_, i) => this.buildWalker(i));
        this.spawnT = 1;
        // --- Las luciérnagas de los parques (de noche)
        const N = 36;
        this.flies = new THREE.InstancedMesh(box(0.12, 0.12, 0.12), V.own(new THREE.MeshBasicMaterial({ color: 0xe8ff6a })), N);
        this.flies.visible = false;
        this.flies.frustumCulled = false;
        V.root.add(this.flies);
        this.flyAt = Array.from({ length: N }, (_, i) => ({ ph: i * 1.7, w: 0.6 + (i % 5) * 0.13, x: 0, z: 0, ok: false }));
        this.flyKey = '';
        this._m = new THREE.Object3D();
    }

    buildBus() {
        const V = this.V, c = new THREE.Group();
        V.part(c, 1.15, 0.9, 3.3, 0xffb52a, 0, 0.62, 0);
        V.part(c, 1.18, 0.34, 2.9, 0x9fdcff, 0, 1.02, -0.1, false);
        V.part(c, 1.2, 0.12, 3.34, 0xe8e0d0, 0, 1.24, 0);
        V.part(c, 1.17, 0.1, 3.32, 0xd8402e, 0, 0.44, 0, false);
        for (const z of [-1.1, 1.1]) for (const x of [-0.55, 0.55]) V.part(c, 0.14, 0.36, 0.36, 0x2e2a28, x, 0.18, z, false);
        V.part(c, 0.8, 0.22, 0.05, 0x2a2a2a, 0, 1.0, 1.66, false); // (el letrero de la ruta)
        V.lit(c, 0.6, 0.12, 0.04, 0x7dff4a, 0, 1.0, 1.69);
        for (const x of [-0.38, 0.38]) V.lit(c, 0.2, 0.14, 0.04, 0xfff0a0, x, 0.5, 1.66);
        c.visible = false;
        V.root.add(c);
        V.bake([c], []);
        return { g: c, a: 3.0, dir: 1, v: 0.08, cruise: 0.08, len: 3.4, bus: true, stopT: 0, lastStop: -1 };
    }

    // Las luces de freno: un material suyo, que se enciende al frenar
    brakeLights(C) {
        const mat = this.V.own(new THREE.MeshBasicMaterial({ color: 0x5a1a14 })), z = -C.len / 2 - 0.02;
        for (const x of [-0.32, 0.32]) {
            const m = new THREE.Mesh(box(0.2, 0.14, 0.04), mat);
            m.position.set(x, C.bus ? 0.5 : 0.48, z);
            C.g.add(m);
        }
        return mat;
    }

    buildWalker(i) {
        const V = this.V, g = new THREE.Group(), body = new THREE.Group();
        const sk = SKIN[i % SKIN.length], sh = SHIRT[(i * 3) % SHIRT.length], pa = PANTS[i % PANTS.length];
        for (const x of [-0.07, 0.07]) V.part(body, 0.1, 0.3, 0.1, pa, x, 0.15, 0);
        V.part(body, 0.3, 0.34, 0.2, sh, 0, 0.47, 0);
        V.part(body, 0.22, 0.22, 0.22, sk, 0, 0.76, 0);
        if (i % 3 === 0) V.part(body, 0.26, 0.08, 0.26, [0x3a3a4a, 0xd8a03a, 0xd84a3a][i % 3 ? 1 : (i / 3) % 3 | 0], 0, 0.9, 0);
        if (i % 4 === 1) V.part(body, 0.08, 0.34, 0.08, 0x8a5a2a, 0.2, 0.4, 0.06); // (con bolsa)
        if (i % 5 === 2) { V.part(body, 0.04, 0.5, 0.04, 0x3a3a4a, -0.2, 0.55, 0, false); V.part(body, 0.5, 0.06, 0.5, [0xd84a3a, 0x3a8ad8][i % 2], -0.2, 0.82, 0); } // (con paraguas)
        bakeGroup(body);
        g.add(body);
        g.scale.setScalar(1.25);
        g.visible = false;
        V.root.add(g);
        return { g, body, on: false, step: Math.random() * 6 };
    }

    // Las puertas de los barrios que dan a la acera de la ronda (y de qué lado), ya construidas
    doorsOnRing() {
        const V = this.V, out = [];
        for (const d of V.doors || []) {
            if (d.lv > (V.level || 0)) continue;
            const dx = d.x - VILLAGE.cx, dz = d.z - VILLAGE.cz, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx), R = V.ringAt(a);
            const sd = r > R ? 1 : -1, rs = R + sd * WALK, dist = Math.abs(r - rs);
            if (dist > 4.5 || dist < 0.2) continue;
            // (que la puerta mire hacia la acera: si no, el camino atravesaría la casa)
            const ux = (-dx / r) * sd, uz = (-dz / r) * sd;
            if ((d.nx ?? 0) * ux + (d.nz ?? 0) * uz < 0.75) continue;
            out.push({ d, a, sd });
        }
        return out;
    }

    spawnWalker(nightK) {
        const free = this.walkers.find((w) => !w.on);
        if (!free) return;
        const doors = this.doorsOnRing();
        const max = Math.round(Math.min(this.walkers.length, doors.length / 2) * (1 - nightK * 0.7));
        if (!doors.length || this.walkers.filter((w) => w.on).length >= max) return;
        const from = doors[(Math.random() * doors.length) | 0];
        const near = doors.filter((o) => o !== from && o.sd === from.sd && (() => { const d = Math.abs(Math.atan2(Math.sin(o.a - from.a), Math.cos(o.a - from.a))); return d > 0.25 && d < 1.6; })());
        const to = near.length ? near[(Math.random() * near.length) | 0] : from;
        let span = Math.atan2(Math.sin(to.a - from.a), Math.cos(to.a - from.a));
        if (to === from) span = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6); // (una vuelta y a casa)
        const w = free;
        Object.assign(w, { on: true, from, to, sd: from.sd, a: from.a, end: from.a + span, dir: Math.sign(span) || 1, phase: 'out', k: 0, back: to === from, wait: 0, pause: Math.random() < 0.4 ? 1.5 + Math.random() * 2 : 0, paused: false });
        w.g.visible = true;
    }

    update(dt, time, nightK) {
        const V = this.V, ringOn = V.ringG.visible;
        this.updateTraffic(dt, ringOn);
        // Los paseantes
        if (ringOn && (V.level || 0) >= 7 && (this.spawnT -= dt) <= 0) {
            this.spawnT = 1.5 + Math.random() * 3;
            this.spawnWalker(nightK);
        }
        for (const w of this.walkers) if (w.on) this.updateWalker(w, dt, ringOn);
        this.updateFlies(time, nightK);
    }

    updateTraffic(dt, on) {
        const V = this.V, list = this.vehicles;
        for (const C of list) {
            C.g.visible = on;
            if (!on) continue;
            // El de delante en su carril: si está cerca, frena (y si se va, vuelve a su marcha)
            let gap = Infinity, ahead = null;
            for (const O of list) {
                if (O === C || O.dir !== C.dir) continue;
                const d = wrap((O.a - C.a) * C.dir) * (V.ringAt(C.a) + C.dir * LANE) - (O.len + C.len) / 2;
                if (d < gap) { gap = d; ahead = O; }
            }
            let want = C.cruise;
            if (C.bus) {
                // (el autobús: al llegar a una parada, para un rato)
                if (C.stopT > 0) { C.stopT -= dt; want = 0; }
                else {
                    const i = this.stops.findIndex((s) => Math.abs(Math.atan2(Math.sin(s - C.a), Math.cos(s - C.a))) < 0.02);
                    if (i >= 0 && i !== C.lastStop) { C.stopT = 3.5; C.lastStop = i; want = 0; }
                }
            }
            if (ahead && gap < 4) want = Math.min(want, gap < 1.2 ? 0 : ahead.v * (gap / 4));
            const prev = C.v;
            C.v += (want - C.v) * Math.min(1, dt * (want < C.v ? 3.5 : 0.9));
            C.brake.color.setHex(C.v < prev - 1e-4 || C.v < 0.01 ? 0xff3a2a : 0x5a1a14);
            C.a = wrap(C.a + C.v * C.dir * dt);
            const R = V.ringAt(C.a) + C.dir * LANE, a2 = C.a + 0.01 * C.dir, R2 = V.ringAt(a2) + C.dir * LANE;
            const p = this.P(C.a, R), q = this.P(a2, R2);
            C.g.position.set(p.x, 0.13, p.z);
            C.g.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
        }
    }

    updateWalker(w, dt, ringOn) {
        const V = this.V;
        if (!ringOn || w.to.d.lv > (V.level || 0)) { w.on = false; w.g.visible = false; return; }
        const rs = (a) => V.ringAt(a) + w.sd * WALK;
        let x, z, tx, tz, moving = true;
        if (w.phase === 'out' || w.phase === 'in') {
            const door = w.phase === 'out' ? w.from : w.to, a = w.phase === 'out' ? w.a : w.end, s = this.P(a, rs(a));
            const dl = Math.hypot(s.x - door.d.x, s.z - door.d.z) || 1;
            w.k = Math.min(1, w.k + (dt * 1.0) / dl);
            const k = w.phase === 'out' ? w.k : 1 - w.k;
            x = door.d.x + (s.x - door.d.x) * k;
            z = door.d.z + (s.z - door.d.z) * k;
            tx = w.phase === 'out' ? s.x - door.d.x : door.d.x - s.x;
            tz = w.phase === 'out' ? s.z - door.d.z : door.d.z - s.z;
            // (sale de casa creciendo y entra en la otra encogiendo)
            const sc = Math.min(1, (w.phase === 'out' ? w.k : 1 - w.k) * 4);
            w.g.scale.setScalar(1.25 * Math.max(0.05, sc));
            if (w.k >= 1) {
                if (w.phase === 'out') { w.phase = 'walk'; w.k = 0; }
                else { w.on = false; w.g.visible = false; return; }
            }
        } else {
            // Por la acera de la ronda (a veces se para un momento, como a mirar algo)
            if (w.pause > 0 && !w.paused && Math.abs(w.end - w.a) < Math.abs(w.end - w.from.a) / 2) { w.paused = true; w.wait = w.pause; }
            if (w.wait > 0) { w.wait -= dt; moving = false; }
            else {
                const r = rs(w.a);
                w.a += (w.dir * dt * 1.05) / r;
                if ((w.end - w.a) * w.dir <= 0) { w.a = w.end; w.phase = 'in'; w.k = 0; }
            }
            const p = this.P(w.a, rs(w.a)), q = this.P(w.a + 0.02 * w.dir, rs(w.a + 0.02 * w.dir));
            x = p.x; z = p.z; tx = q.x - p.x; tz = q.z - p.z;
        }
        w.step += dt * (moving ? 11 : 0);
        w.g.position.set(x, moving ? Math.abs(Math.sin(w.step)) * 0.06 : 0, z);
        if (tx || tz) w.g.rotation.y = Math.atan2(tx, tz);
        w.body.rotation.z = moving ? Math.sin(w.step) * 0.06 : 0;
    }

    // Las luciérnagas: alrededor de los árboles, parques y jardines que ya hay, cuando es de noche
    updateFlies(time, nightK) {
        const V = this.V, on = nightK > 0.55;
        this.flies.visible = on;
        if (!on) return;
        const anchors = [];
        for (const id of ['woods', 'swings', 'gardens', 'shrubs', 'orchards', 'pond']) for (const e of V.regions[id] || []) if (e.on && e.g.visible) anchors.push(...e.shapes);
        const key = anchors.length;
        if (key !== this.flyKey) {
            this.flyKey = key;
            this.flyAt.forEach((f, i) => {
                const s = anchors[(i * 7) % Math.max(1, anchors.length)];
                f.ok = !!s;
                if (s) { f.x = s.x + Math.sin(i * 2.3) * 1.2; f.z = s.z + Math.cos(i * 1.9) * 1.2; }
            });
        }
        const m = this._m;
        this.flyAt.forEach((f, i) => {
            const t = time * f.w + f.ph, blink = Math.sin(time * 2.2 + f.ph * 3) > -0.2;
            m.position.set(f.x + Math.sin(t) * 0.9, 0.6 + Math.sin(t * 1.7) * 0.4 + 0.5, f.z + Math.cos(t * 0.8) * 0.9);
            m.scale.setScalar(f.ok && blink ? 1 : 0.0001);
            m.updateMatrix();
            this.flies.setMatrixAt(i, m.matrix);
        });
        this.flies.instanceMatrix.needsUpdate = true;
    }
}
