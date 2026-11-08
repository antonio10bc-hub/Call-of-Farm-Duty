import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { KS } from '../content/killstreaks.js';
import { CROPS } from '../content/crops.js';

const W = KS.walkers;
const GOO = [0x7dff4a, 0xd8ffb0, 0xffffff, 0x3ec82a];
const BEAM = [0x7dff4a, 0x9fdcff, 0xffffff];
const SKIN = 0x7dff4a, SUIT = 0x6a4a9a, DARK = 0x3e2a5e, LAMP = 0xff3e5e;
const _ray = new THREE.Ray();
const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _max = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

// Materiales por color, compartidos (salen alienígenas a montones; de noche brillan todos a la vez)
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);
// Casco de cristal (transparente de día; de noche brilla en verde, con un pulso suave) y el aviso
// rojo de "lleva algo robado"
const HELMET = toon(0x9fdcff);
HELMET.transparent = true;
HELMET.opacity = 0.35;
HELMET.depthWrite = false;
const ALARM = new THREE.MeshBasicMaterial({ color: 0xff3e1a });

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

// Alienígenas a pie en el campo de tiro: ladrones de cosecha. Aparecen en un borde del campo
// (con un rayo verde), van hacia una mata (o un tomate), la cogen y huyen corriendo hacia fuera
// con ella a cuestas y un aviso rojo encima. Si llega al borde, se la lleva (hooks.onStolen); si
// se le abate, lo robado se recupera (hooks.onHit, como si se hubiera recogido). Si no queda nada
// que robar, cruzan el campo y se van. De noche salen muchos más y brillan en la oscuridad. Cada
// uno abatido suma a la racha alienígena (sniper.addAlien).
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

    // ¿Alguno huye con algo robado? (el campo no se da por terminado mientras tanto)
    get carrying() {
        return this.list.some((w) => w.alive && w.loot);
    }

    // Cuerpo de cubos: piernas, traje morado con cinturón, brazos, cabeza verde grande con su
    // antena (sin cara, como todo en el juego) dentro de un casco de cristal con su collar y,
    // encima, el hatillo de lo robado con su aviso rojo (escondido hasta que roba)
    build(crop) {
        const g = new THREE.Group(), ink = this.ink;
        const body = new THREE.Group();
        g.add(body);
        const legs = [-0.11, 0.11].map((x) => limb(body, ink, 0.15, 0.46, 0.16, DARK, x, 0.48, 0));
        hulled(body, ink, 0.44, 0.42, 0.28, SUIT, 0, 0.7, 0);
        hulled(body, ink, 0.46, 0.07, 0.3, 0xffe03a, 0, 0.53, 0);
        const arms = [-0.29, 0.29].map((x) => limb(body, ink, 0.12, 0.4, 0.13, SKIN, x, 0.88, 0));
        hulled(body, ink, 0.5, 0.42, 0.44, SKIN, 0, 1.15, 0);
        hulled(body, ink, 0.05, 0.22, 0.05, 0x3ec82a, 0, 1.46, 0);
        hulled(body, ink, 0.12, 0.12, 0.12, LAMP, 0, 1.6, 0);
        const helmet = new THREE.Mesh(box(0.7, 0.62, 0.64), HELMET);
        helmet.position.y = 1.2;
        helmet.renderOrder = 2;
        body.add(helmet);
        hulled(body, ink, 0.64, 0.07, 0.58, 0x9aa8b8, 0, 0.9, 0);
        const loot = new THREE.Group();
        loot.position.y = 1.55;
        const C = CROPS[crop] || CROPS.wheat;
        hulled(loot, ink, 0.5, 0.36, 0.42, C.fruit || C.ear, 0, 0.18, 0);
        hulled(loot, ink, 0.12, 0.16, 0.12, C.calyx || C.earDark, 0, 0.42, 0);
        const alarm = new THREE.Mesh(box(0.22, 0.22, 0.22), ALARM);
        alarm.position.y = 0.85;
        alarm.rotation.set(Math.PI / 4, 0, Math.PI / 4);
        loot.add(alarm);
        loot.visible = false;
        body.add(loot);
        g.scale.setScalar(1.25);
        return { g, body, legs, arms, lootMesh: loot };
    }

    // Uno nuevo: aparece en un borde del campo y va a por algo que robar
    spawn() {
        const f = this.sn.field, a = Math.random() * Math.PI * 2, r = f.radius * 0.85;
        const speed = W.speeds[(Math.random() * W.speeds.length) | 0] * rand(0.9, 1.15);
        const m = this.build(f.crop);
        this.root.add(m.g);
        const w = { ...m, speed, ph: Math.random() * 6, alive: true, dying: -1, beam: 0, mode: 'in', tgt: null, loot: null, grab: 0, x: f.cx + Math.sin(a) * r, z: f.cz + Math.cos(a) * r, to: null };
        this.list.push(w);
        this.pickTarget(w);
        this.place(w);
        this.beamFx(w);
        return w;
    }

    // A por la mata (o tomate) viva más cercana que nadie más tenga echada el ojo; si no queda
    // ninguna, cruza el campo y se va por el otro lado
    pickTarget(w) {
        const f = this.sn.field, taken = new Set(this.list.map((o) => o.tgt));
        let best = null, bd = Infinity;
        for (const s of f.targets) {
            if (!s.alive || !s.landed || taken.has(s) || s.kind === 'cow' || s.kind === 'sheep') continue; // (a las vacas y las ovejas, que corren, no las persiguen)
            const d = Math.hypot(s.x - w.x, s.z - w.z) * rand(0.7, 1.3); // no todos a la más cercana
            if (d < bd) [best, bd] = [s, d];
        }
        w.tgt = best;
        if (best) {
            w.mode = 'in';
            w.to = { x: best.x, z: best.z };
        } else {
            w.mode = 'cross';
            w.to = { x: 2 * f.cx - w.x, z: 2 * f.cz - w.z };
        }
    }

    place(w) {
        w.g.position.set(w.x, 0, w.z);
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
        return out.set(_v.set(p.x - 0.32 * s, 0, p.z - 0.32 * s), _max.set(p.x + 0.32 * s, 1.55 * s, p.z + 0.32 * s));
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

    // Abatido: salta dando vueltas, revienta en babas verdes y suma a la racha alienígena. Si
    // llevaba algo robado, se recupera
    shoot(w) {
        if (!w.alive) return;
        const p = w.g.position, sn = this.sn;
        w.alive = false;
        w.dying = 0;
        w.tgt = null;
        sn.particles.burst(p.x, 1, p.z, 40, GOO, { speed: 3.5, up: 4, size: 0.12, ttl: 0.8 });
        sn.waves.spawn(p.x, p.z, 0x7dff4a, 1.4, 0.35);
        sn.hooks.sfx.play('crateHit');
        _v.set(p.x, 1.9, p.z).project(sn.camera); // en su cabeza (el +1 sube desde ahí)
        if (sn.hooks.onAlien) sn.hooks.onAlien(_v.x, _v.y);
        if (w.loot) {
            w.lootMesh.visible = false;
            sn.particles.burst(p.x, 2, p.z, 30, (CROPS[sn.crop] || CROPS.wheat).burst, { speed: 3, up: 4, size: 0.09, ttl: 0.9 });
            if (sn.hooks.onHit) sn.hooks.onHit(w.loot, _v.x, _v.y);
            w.loot = null;
        }
        sn.addAlien(1);
    }

    // Coge lo que había ido a buscar: desaparece del campo y se lo echa a la espalda
    steal(w) {
        const s = w.tgt, sn = this.sn;
        w.tgt = null;
        if (!s || !s.alive) return this.pickTarget(w);
        s.alive = false;
        s.dying = 0.2;
        s.flash = 1;
        w.loot = s;
        w.lootMesh.visible = true;
        sn.particles.burst(s.x, s.y, s.z, 16, (CROPS[sn.crop] || CROPS.wheat).chaff, { speed: 1.6, up: 2, size: 0.07, ttl: 0.6 });
        sn.hooks.sfx.play('grabOther');
        // A correr hacia fuera, por donde le pille más cerca
        const f = sn.field, dx = w.x - f.cx, dz = w.z - f.cz, d = Math.hypot(dx, dz) || 1;
        w.mode = 'flee';
        w.to = { x: f.cx + (dx / d) * (f.radius + 1.5), z: f.cz + (dz / d) * (f.radius + 1.5) };
        w.speed = Math.max(w.speed, W.speeds[2]) * 1.1;
    }

    update(dt, time) {
        const sn = this.sn, k = sn.nightK || 0;
        const busy = sn.calm || sn.walkersOn === false || (sn.debug && sn.debug.noAliens) || sn.unlocking || sn.ending >= 0 || sn.field.remaining === 0;
        if (!busy && (this.next -= dt) <= 0) {
            // Más seguidos cuanto más grande es el campo, y muchos más de noche
            this.next = rand(W.every[0], W.every[1]) / Math.max(1, Math.sqrt(sn.field.scale || 1)) / (1 + W.night * k);
            if (this.list.filter((w) => w.alive).length < W.max + Math.round(W.nightMax * k)) this.spawn();
        }
        // De noche brillan: el casco se enciende en verde (latiendo despacio), y la piel y la
        // antena con luz propia
        const pulse = 0.75 + Math.sin(time * 3) * 0.25;
        HELMET.emissive.setHex(0x5aff3a).multiplyScalar(k * 0.7 * pulse);
        HELMET.opacity = 0.35 + 0.3 * k;
        mat(SKIN).emissive.setHex(0x2a8a1a).multiplyScalar(k * 0.6);
        mat(LAMP).emissive.setHex(0xff3e5e).multiplyScalar(k);
        ALARM.color.setHex(Math.sin(time * 14) > 0 ? 0xff3e1a : 0xffe03a);
        this.list = this.list.filter((w) => {
            w.beam = Math.max(0, w.beam - dt);
            if (w.alive) return this.walk(w, dt, time);
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

    // Un paso hacia donde va; false cuando sale del campo (con o sin botín)
    walk(w, dt, time) {
        const sn = this.sn;
        // Si lo que iba a robar ya no está (lo han recogido), a por otra cosa
        if (w.mode === 'in' && (!w.tgt || !w.tgt.alive)) this.pickTarget(w);
        if (w.mode === 'grab') {
            w.grab -= dt;
            w.body.rotation.x = 0.6; // agachado cogiéndolo
            if (w.grab <= 0) this.steal(w);
            return true;
        }
        const dx = w.to.x - w.x, dz = w.to.z - w.z, d = Math.hypot(dx, dz);
        const reach = w.mode === 'in' ? 0.7 : 0.2;
        if (d <= reach) {
            if (w.mode === 'in') {
                w.mode = 'grab';
                w.grab = 0.35;
                return true;
            }
            // Fuera del campo: se va con su rayo (y con lo robado, si lo lleva)
            this.beamFx(w);
            if (w.loot && sn.hooks.onStolen) {
                _v.set(w.x, 2, w.z).project(sn.camera);
                sn.hooks.onStolen(w.loot, _v.x, _v.y);
            }
            this.root.remove(w.g);
            return false;
        }
        const step = Math.min(d - reach + 0.01, w.speed * dt);
        w.x += (dx / d) * step;
        w.z += (dz / d) * step;
        this.place(w);
        w.g.rotation.y = Math.atan2(dx, dz);
        // Zancadas al ritmo de su paso; corriendo, más largas y con el cuerpo inclinado
        const k = Math.min(1.2, w.speed / W.speeds[2]), stride = time * w.speed * 4.2 + w.ph, swing = 0.45 + k * 0.5;
        w.legs[0].rotation.x = Math.sin(stride) * swing;
        w.legs[1].rotation.x = -Math.sin(stride) * swing;
        // Con botín, los brazos arriba sujetándolo
        const arm = w.loot ? -2.8 : 0;
        w.arms[0].rotation.x = arm + (w.loot ? 0 : -Math.sin(stride) * swing * 0.9);
        w.arms[1].rotation.x = arm + (w.loot ? 0 : Math.sin(stride) * swing * 0.9);
        w.body.position.y = Math.abs(Math.cos(stride)) * 0.06 * (0.5 + k);
        w.body.rotation.x = 0.08 + k * 0.18;
        return true;
    }
}
