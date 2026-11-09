import * as THREE from 'three';
import { VoxelModel } from '../render/VoxelModel.js';
import { LAKE, RIVER_PATHS, toXZ, isWater, groundAt } from './valley.js';

// La vida del agua (en coordenadas del mundo): patos que nadan en corro por el lago (uno, con su
// lacito naranja), peces que saltan en el río y en el lago y un molino de agua a la salida del
// lago, con su rueda girando.
const WHITE = 0xf6f3ea, YELLOW = 0xffd23f, ORANGE = 0xf08a1e, INK = 0x2a1a0e;

export class Life extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.level = LAKE.level - 0.22; // la superficie del agua
        // Patos: cada uno da vueltas a su ritmo por una elipse del lago
        this.ducks = [];
        for (let i = 0; i < 7; i++) {
            const bow = i === 0;
            const g = this.duck(bow);
            this.root.add(g);
            this.ducks.push({ g, a: (i / 7) * Math.PI * 2, r: 0.35 + (i % 3) * 0.18, speed: (0.05 + (i % 4) * 0.012) * (i % 2 ? 1 : -1), bob: i, mode: 'swim', wait: bow ? 20 + Math.random() * 20 : Infinity, t: 0 });
        }
        // Peces: unos pocos, cada uno salta de vez en cuando en algún sitio con agua
        this.fish = [];
        const fm = new THREE.MeshBasicMaterial({ color: 0xc8d8e0 }), om = new THREE.MeshBasicMaterial({ color: ORANGE });
        this.own(fm);
        this.own(om);
        for (let i = 0; i < 6; i++) {
            const g = new THREE.Group();
            g.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.14), i % 3 ? fm : om));
            const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.06), i % 3 ? fm : om);
            tail.position.x = -0.26;
            g.add(tail);
            g.visible = false;
            this.root.add(g);
            this.fish.push({ g, t: -Math.random() * 6, x: 0, z: 0, y: 0, ry: 0 });
        }
        this.waters = [...RIVER_PATHS.flat().filter((p) => p.w > 3), ...Array.from({ length: 40 }, (_, k) => {
            const a = (k / 40) * Math.PI * 2, [x, z] = toXZ(LAKE.u + Math.cos(a) * LAKE.ru * 0.6, LAKE.v + Math.sin(a) * LAKE.rv * 0.6);
            return { x, z, y: LAKE.level };
        })];
        this.buildMill();
    }

    // La chistera del pato del lacito (de la colección del mercader)
    setHat(on) {
        this.ducks[0].g.hat.visible = !!on;
    }

    // Un pato: cuerpo, cola, cabeza, pico y (el de la pajarita) su lacito naranja
    duck(bow) {
        const g = new THREE.Group(), body = bow ? YELLOW : WHITE;
        this.part(g, 0.62, 0.32, 0.4, body, 0, 0.12, 0);
        this.part(g, 0.2, 0.18, 0.26, body, -0.34, 0.24, 0);
        this.part(g, 0.26, 0.26, 0.24, body, 0.26, 0.42, 0);
        this.part(g, 0.16, 0.07, 0.12, ORANGE, 0.45, 0.4, 0, false);
        for (const s of [-1, 1]) this.part(g, 0.04, 0.05, 0.03, INK, 0.33, 0.47, s * 0.12, false);
        if (bow) {
            // El lacito, encima de la cabeza: dos lazos grandes y el nudo
            for (const s of [-1, 1]) this.part(g, 0.1, 0.22, 0.26, ORANGE, 0.24, 0.64, s * 0.17).rotation.x = s * 0.5;
            this.part(g, 0.12, 0.12, 0.12, 0xd86a10, 0.24, 0.63, 0);
            // La chistera (de la colección del mercader): entre los lazos, si la tienes
            g.hat = new THREE.Group();
            this.part(g.hat, 0.3, 0.04, 0.3, INK, 0.26, 0.58, 0);
            this.part(g.hat, 0.2, 0.26, 0.2, INK, 0.26, 0.73, 0);
            this.part(g.hat, 0.21, 0.05, 0.21, 0xc8402e, 0.26, 0.64, 0, false);
            g.hat.visible = false;
            g.add(g.hat);
        }
        g.scale.setScalar(1.9);
        return g;
    }

    // El molino de agua: en la orilla, justo donde el río sale del lago, con la rueda en el agua
    buildMill() {
        const R = RIVER_PATHS[RIVER_PATHS.length - 1], i = Math.min(R.length - 3, 14), p = R[i], q = R[i + 2];
        const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
        // (del lado de la orilla que esté en tierra)
        const side = isWater(p.x + nx * (p.w / 2 + 3), p.z + nz * (p.w / 2 + 3)) ? -1 : 1;
        const hx = p.x + nx * side * (p.w / 2 + 2.6), hz = p.z + nz * side * (p.w / 2 + 2.6), y = groundAt(hx, hz);
        const g = new THREE.Group();
        g.position.set(hx, y, hz);
        g.rotation.y = Math.atan2(nx * side, nz * side);
        this.root.add(g);
        this.part(g, 2.6, 2.0, 2.4, 0xe8dcc0, 0, 1.0, 0);
        this.part(g, 2.9, 0.4, 2.7, 0x8a3a2a, 0, 2.2, 0);
        this.part(g, 2.2, 0.4, 2.7, 0x8a3a2a, 0, 2.6, 0);
        this.part(g, 1.4, 0.4, 2.7, 0x8a3a2a, 0, 3.0, 0);
        this.part(g, 0.7, 1.1, 0.08, 0x7a4f2a, 0, 0.55, 1.22);
        this.part(g, 0.5, 0.5, 0.08, 0x9fdcff, 0.8, 1.3, 1.22, false);
        this.part(g, 0.3, 0.3, 2.6, 0x7a4f2a, 0, 1.2, -1.6); // el eje hacia el río
        // La rueda: en el lado del río, medio metida en el agua
        this.wheel = new THREE.Group();
        this.wheel.position.set(0, 1.1, -2.6);
        g.add(this.wheel);
        for (let k = 0; k < 8; k++) {
            const s = new THREE.Group();
            s.rotation.z = (k / 8) * Math.PI * 2;
            this.wheel.add(s);
            this.part(s, 0.14, 2.4, 0.5, 0x7a4f2a, 0, 0, 0, false);
            this.part(s, 0.5, 0.18, 0.6, 0x9a6a3a, 0, 1.15, 0);
        }
        this.part(this.wheel, 0.4, 0.4, 0.7, 0x5a3a24, 0, 0, 0);
    }

    // El paseo del pato del lacito: de vez en cuando nada hasta la orilla, sale a tierra, se da
    // una vuelta anadeando por la orilla y vuelve al agua (out, walk, in)
    stroll(d, dt) {
        d.t += dt;
        if (d.mode === 'walk') d.a += 0.07 * dt; // (anda por la orilla)
        if (d.mode === 'swim' && (d.wait -= dt) <= 0) {
            d.mode = 'out';
            d.t = 0;
            d.e0 = d.r;
        } else if (d.mode === 'out' && d.t > 4) {
            d.mode = 'walk';
            d.t = 0;
        } else if (d.mode === 'walk' && d.t > 12) {
            d.mode = 'in';
            d.t = 0;
        } else if (d.mode === 'in' && d.t > 4) {
            d.mode = 'swim';
            d.r = 0.35;
            d.wait = 40 + Math.random() * 40;
        }
    }

    // Dónde va el pato que pasea (fuera del corro): por la elipse del lago, a la distancia e
    place(d, time, c, s) {
        const e = d.mode === 'out' ? d.e0 + (1.09 - d.e0) * Math.min(1, d.t / 4) : d.mode === 'in' ? 1.09 + (0.35 - 1.09) * Math.min(1, d.t / 4) : 1.09;
        const at = (a, e) => {
            const eu = Math.cos(a) * LAKE.ru * e, ev = Math.sin(a) * LAKE.rv * e;
            return toXZ(LAKE.u + eu * c - ev * s, LAKE.v + eu * s + ev * c);
        };
        const [x, z] = at(d.a, e), ahead = d.mode === 'walk' ? at(d.a + 0.05, e) : at(d.a, d.mode === 'out' ? e + 0.05 : e - 0.05);
        const onLand = !isWater(x, z), walk = onLand && d.mode !== 'swim';
        const y = onLand ? groundAt(x, z) + Math.abs(Math.sin(time * 9)) * 0.08 : this.level + Math.sin(time * 2 + d.bob) * 0.03;
        d.g.position.set(x, y + (d.jumpY || 0), z);
        d.g.rotation.set(walk ? Math.sin(time * 9) * 0.18 : 0, Math.atan2(-(ahead[1] - z), ahead[0] - x), 0);
    }

    // Un corazón de píxeles que sube bien alto desde el pato y revienta (boom(p): el estallido)
    heart(d, boom) {
        const g = new THREE.Group(), rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
        rows.forEach((row, j) => [...row].forEach((ch, i) => {
            if (ch === 'X') this.part(g, 0.2, 0.2, 0.2, j < 2 && i % 3 === 1 ? 0xff9ac0 : 0xff4a7a, (i - 3) * 0.2, (2.5 - j) * 0.2, 0, false);
        }));
        g.position.copy(d.g.position).add(new THREE.Vector3(0, 1, 0));
        g.scale.setScalar(0.0001);
        this.root.add(g);
        (this.hearts || (this.hearts = [])).push({ g, t: 0, boom });
    }

    // El salto del pato cuando se le toca (jump: lo que le queda)
    hop(d, dt) {
        if (!d.jump) return (d.jumpY = 0);
        d.jump = Math.max(0, d.jump - dt);
        return (d.jumpY = Math.sin((1 - d.jump / 0.6) * Math.PI) * 0.9);
    }

    update(dt, time) {
        // Corazones: salen, suben unas cuatro casillas balanceándose y revientan
        for (const h of this.hearts || []) {
            h.t += dt;
            const k = Math.min(1, h.t / 1.1);
            h.g.position.y += dt * 8 * (1 - k * 0.55);
            h.g.scale.setScalar(Math.max(0.0001, Math.min(1, h.t * 4) * (1.4 + k * 0.8)));
            // (de cara a la cámara, que mira en diagonal desde arriba, balanceándose)
            h.g.rotation.set(-0.6, Math.PI / 4, Math.sin(h.t * 8) * 0.15, 'YXZ');
            if (k >= 1) {
                if (h.boom) h.boom(h.g.position);
                h.g.removeFromParent();
                h.done = true;
            }
        }
        if (this.hearts) this.hearts = this.hearts.filter((h) => !h.done);
        // Patos: dan vueltas por el lago, cabeceando con las olas
        const c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot);
        for (const d of this.ducks) {
            if (d.wait !== Infinity) this.stroll(d, dt);
            if (d.mode !== 'swim') {
                this.hop(d, dt);
                this.place(d, time, c, s);
                continue;
            }
            d.a += d.speed * dt;
            const eu = Math.cos(d.a) * LAKE.ru * d.r, ev = Math.sin(d.a) * LAKE.rv * d.r * 1.4;
            const [x, z] = toXZ(LAKE.u + eu * c - ev * s, LAKE.v + eu * s + ev * c);
            const [nx, nz] = toXZ(LAKE.u + Math.cos(d.a + Math.sign(d.speed) * 0.05) * LAKE.ru * d.r * c - Math.sin(d.a + Math.sign(d.speed) * 0.05) * LAKE.rv * d.r * 1.4 * s, LAKE.v + Math.cos(d.a + Math.sign(d.speed) * 0.05) * LAKE.ru * d.r * s + Math.sin(d.a + Math.sign(d.speed) * 0.05) * LAKE.rv * d.r * 1.4 * c);
            d.g.position.set(x, this.level + Math.sin(time * 2 + d.bob) * 0.03 + this.hop(d, dt), z);
            d.g.rotation.set(Math.sin(time * 2.2 + d.bob) * 0.06, Math.atan2(-(nz - z), nx - x), 0);
        }
        // Peces: un salto en arco y al agua; luego esperan y saltan en otro sitio
        for (const f of this.fish) {
            f.t += dt;
            if (f.t < 0) continue;
            if (!f.g.visible) {
                const w = this.waters[(Math.random() * this.waters.length) | 0];
                f.x = w.x + (Math.random() - 0.5) * 1.5;
                f.z = w.z + (Math.random() - 0.5) * 1.5;
                f.y = (w.y ?? LAKE.level) - 0.25;
                f.ry = Math.random() * Math.PI * 2;
                f.g.visible = true;
            }
            const k = f.t / 0.9;
            if (k >= 1) {
                f.g.visible = false;
                f.t = -3 - Math.random() * 6;
                continue;
            }
            const along = (k - 0.5) * 1.6;
            f.g.position.set(f.x + Math.cos(f.ry) * along, f.y + Math.sin(k * Math.PI) * 1.1, f.z - Math.sin(f.ry) * along);
            f.g.rotation.set(0, f.ry, (0.5 - k) * 2.2);
        }
        this.wheel.rotation.z = time * 0.8;
        this.updateFx(dt);
    }
}
