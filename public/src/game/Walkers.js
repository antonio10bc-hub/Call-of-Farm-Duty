import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { KS } from '../content/killstreaks.js';

const W = KS.walkers;
const GOO = [0x7dff4a, 0xd8ffb0, 0xffffff, 0x3ec82a];
const BEAM = [0x7dff4a, 0x9fdcff, 0xffffff];
const _ray = new THREE.Ray();
const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

// Materiales por color, compartidos (salen alienígenas a montones)
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);

// Caja con su contorno de tinta
function hulled(parent, ink, w, h, d, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(box(1, 1, 1), mat(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    const o = new THREE.Mesh(box(1, 1, 1), ink);
    o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
    o.position.copy(m.position);
    parent.add(m, o);
    return m;
}

// Pieza que gira desde arriba (piernas desde la cadera, brazos desde el hombro)
function limb(parent, ink, w, h, d, color, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    hulled(g, ink, w, h, d, color, 0, -h / 2, 0);
    parent.add(g);
    return g;
}

// Alienígenas a pie en el campo de tiro: de vez en cuando aparece uno en un borde del campo (con
// un rayo verde) y lo cruza en línea recta andando, al trote o corriendo, hasta desaparecer por
// el otro lado. Cada uno abatido suma a la racha alienígena (sniper.addAlien). Su caja de
// impacto es la de su cuerpo.
export class Walkers {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.ink = outline(sniper.theme.outline);
        this.list = [];
        this.reset();
    }

    reset() {
        for (const w of this.list) this.root.remove(w.g);
        this.list = [];
        this.next = rand(1, 2.5); // el primero enseguida, para que se vea de qué va
    }

    // Cuerpo de cubos: piernas, traje morado con cinturón, brazos, cabeza verde grande con su
    // antena (sin cara, como todo en el juego)
    build() {
        const g = new THREE.Group(), ink = this.ink, SKIN = 0x7dff4a, SUIT = 0x6a4a9a, DARK = 0x3e2a5e;
        const body = new THREE.Group();
        g.add(body);
        const legs = [-0.11, 0.11].map((x) => limb(body, ink, 0.15, 0.46, 0.16, DARK, x, 0.48, 0));
        hulled(body, ink, 0.44, 0.42, 0.28, SUIT, 0, 0.7, 0);
        hulled(body, ink, 0.46, 0.07, 0.3, 0xffe03a, 0, 0.53, 0);
        const arms = [-0.29, 0.29].map((x) => limb(body, ink, 0.12, 0.4, 0.13, SKIN, x, 0.88, 0));
        hulled(body, ink, 0.5, 0.42, 0.44, SKIN, 0, 1.15, 0);
        hulled(body, ink, 0.05, 0.22, 0.05, 0x3ec82a, 0, 1.46, 0);
        hulled(body, ink, 0.12, 0.12, 0.12, 0xff3e5e, 0, 1.6, 0);
        g.scale.setScalar(1.25);
        return { g, body, legs, arms };
    }

    // Uno nuevo: entra por un borde y cruza el campo en una dirección al azar, por cualquier
    // franja (así cubren más o menos todo el campo)
    spawn() {
        const f = this.sn.field, a = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const half = f.radius * 0.8, side = rand(-0.55, 0.55) * f.radius;
        const speed = W.speeds[(Math.random() * W.speeds.length) | 0] * rand(0.9, 1.15);
        const m = this.build();
        m.g.rotation.y = a;
        this.root.add(m.g);
        const w = {
            ...m, dir, speed, len: half * 2, dist: 0, ph: Math.random() * 6, alive: true, dying: -1, beam: 0,
            x0: f.cx - dir.x * half + dir.z * side, z0: f.cz - dir.z * half - dir.x * side,
        };
        this.list.push(w);
        this.place(w);
        this.beamFx(w);
        return w;
    }

    place(w) {
        w.g.position.set(w.x0 + w.dir.x * w.dist, 0, w.z0 + w.dir.z * w.dist);
    }

    // Rayo de llegada o de salida: columna de chispas verdes y un anillo en el suelo
    beamFx(w) {
        const p = w.g.position, sn = this.sn;
        sn.particles.burst(p.x, 1, p.z, 30, BEAM, { speed: 1.2, up: 5, size: 0.1, ttl: 0.6, grav: -2 });
        sn.waves.spawn(p.x, p.z, 0x7dff4a, 1.6, 0.4);
        w.beam = 0.3;
    }

    // Caja de su cuerpo (de los pies a la antena)
    boxOf(w, out) {
        const p = w.g.position, s = w.g.scale.x;
        return out.set(_v.set(p.x - 0.32 * s, 0, p.z - 0.32 * s), new THREE.Vector3(p.x + 0.32 * s, 1.55 * s, p.z + 0.32 * s));
    }

    // El más cercano de los vivos en la línea de tiro: { walker, t } o null
    hit(origin, dir) {
        _ray.set(origin, dir);
        let best = null;
        for (const w of this.list) {
            if (!w.alive || w.beam > 0.15) continue;
            const at = _ray.intersectBox(this.boxOf(w, _box), _v);
            if (!at) continue;
            const t = at.distanceTo(origin);
            if (!best || t < best.t) best = { walker: w, t };
        }
        return best;
    }

    // Los vivos a menos de r de un punto del suelo (explosiones y fuego)
    near(x, z, r) {
        return this.list.filter((w) => w.alive && Math.hypot(w.g.position.x - x, w.g.position.z - z) <= r + 0.3);
    }

    // Abatido: salta dando vueltas, revienta en babas verdes y suma a la racha alienígena
    shoot(w) {
        if (!w.alive) return;
        const p = w.g.position, sn = this.sn;
        w.alive = false;
        w.dying = 0;
        sn.particles.burst(p.x, 1, p.z, 40, GOO, { speed: 3.5, up: 4, size: 0.12, ttl: 0.8 });
        sn.waves.spawn(p.x, p.z, 0x7dff4a, 1.4, 0.35);
        sn.hooks.sfx.play('crateHit');
        if (sn.hooks.onAlien) {
            _v.set(p.x, 1.2, p.z).project(sn.camera);
            sn.hooks.onAlien(_v.x, _v.y);
        }
        sn.addAlien(1);
    }

    update(dt, time) {
        const sn = this.sn;
        const busy = sn.unlocking || sn.ending >= 0 || sn.field.remaining === 0;
        if (!busy && (this.next -= dt) <= 0) {
            // Más seguidos cuanto más grande es el campo
            this.next = rand(W.every[0], W.every[1]) / Math.max(1, Math.sqrt(sn.field.scale || 1));
            if (this.list.filter((w) => w.alive).length < W.max) this.spawn();
        }
        this.list = this.list.filter((w) => {
            w.beam = Math.max(0, w.beam - dt);
            if (w.alive) {
                w.dist += w.speed * dt;
                this.place(w);
                // Zancadas al ritmo de su paso; corriendo, más largas y con el cuerpo inclinado
                const k = w.speed / W.speeds[2], step = time * w.speed * 4.2 + w.ph, swing = 0.45 + k * 0.5;
                w.legs[0].rotation.x = Math.sin(step) * swing;
                w.legs[1].rotation.x = -Math.sin(step) * swing;
                w.arms[0].rotation.x = -Math.sin(step) * swing * 0.9;
                w.arms[1].rotation.x = Math.sin(step) * swing * 0.9;
                w.body.position.y = Math.abs(Math.cos(step)) * 0.06 * (0.5 + k);
                w.body.rotation.x = 0.08 + k * 0.18;
                // Al llegar al otro lado, se va con su rayo
                if (w.dist < w.len) return true;
                this.beamFx(w);
                this.root.remove(w.g);
                return false;
            }
            // Abatido: sale despedido hacia arriba girando y se encoge
            w.dying += dt;
            const p = w.g.position;
            p.y = Math.sin(Math.min(1, w.dying / 0.45) * Math.PI) * 0.9;
            w.g.rotation.x += dt * 12;
            w.g.scale.setScalar(1.25 * Math.max(0.0001, 1 - w.dying / 0.45));
            if (w.dying < 0.45) return true;
            sn.particles.burst(p.x, 0.4, p.z, 30, GOO, { speed: 2.4, up: 2.4, size: 0.14, ttl: 0.6 });
            this.root.remove(w.g);
            return false;
        });
    }
}
