import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { CROPS } from '../content/crops.js';

// Los blancos del colmenar en el campo de tiro: abejas que dan vueltas alrededor de sus colmenas,
// cada una con una gota de miel brillante colgando: se le dispara a la gota. Al darle, la gota
// revienta y la abeja se va volando. Los blancos son de la lista del campo (targets), con su caja
// de impacto (hb) en la gota.
const INK = 0x2a1a0e;

export class Bees {
    constructor(outlineColor) {
        this.root = new THREE.Group();
        this.outlineColor = outlineColor;
        this.mats = new Map();
        this.list = [];
        this.decor = [];
        this.glow = new THREE.MeshBasicMaterial({ color: 0xffb020 });
    }

    part(g, w, h, d, c, x, y, z, line = true) {
        const mat = c === 'glow' ? this.glow : this.mats.get(c) || this.mats.set(c, toon(c)).get(c);
        const m = new THREE.Mesh(box(w, h, d), mat);
        m.position.set(x, y, z);
        g.add(m);
        if (line) {
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.lineMat || (this.lineMat = outline(this.outlineColor)));
            o.position.copy(m.position);
            g.add(o);
        }
        return m;
    }

    // Una colmena (decorado: no se le dispara): cajas apiladas con su tejadillo, sobre un poyete
    hive(x, z) {
        const g = new THREE.Group(), H = CROPS.honey;
        g.position.set(x, 0, z);
        this.part(g, 1.1, 0.3, 0.9, 0x8a5a2a, 0, 0.15, 0);
        for (let k = 0; k < 3; k++) this.part(g, 0.95 - k * 0.01, 0.42, 0.78 - k * 0.01, k % 2 ? H.hive : 0xe0c070, 0, 0.51 + k * 0.42, 0);
        this.part(g, 1.15, 0.14, 1.0, H.roof, 0, 1.4, 0);
        this.part(g, 0.4, 0.08, 0.05, INK, 0, 0.4, 0.41, false);
        this.root.add(g);
        this.decor.push(g);
        return g;
    }

    // Pone count abejas en el campo f (SniperField: freeSpot y su lista de blancos)
    spawn(count, f) {
        this.clear();
        // Las colmenas (una por cada 6 abejas, como mucho 6) y sus abejas alrededor
        const hives = [];
        for (let i = 0; i < Math.min(6, Math.max(2, Math.ceil(count / 6))); i++) {
            const { x, z } = f.freeSpot(hives, 4.5);
            hives.push({ x, z });
            this.hive(x, z);
        }
        for (let i = 0; i < count; i++) {
            const h = hives[i % hives.length], g = new THREE.Group(), body = new THREE.Group();
            g.add(body);
            this.part(body, 0.34, 0.26, 0.42, 0xffd23f, 0, 0, 0);
            this.part(body, 0.36, 0.28, 0.08, INK, 0, 0, 0.04, false);
            this.part(body, 0.36, 0.28, 0.08, INK, 0, 0, -0.12, false);
            this.part(body, 0.1, 0.08, 0.14, INK, 0, 0, 0.26, false);
            for (const s of [-1, 1]) this.part(body, 0.3, 0.04, 0.2, 0xeaf6ff, s * 0.26, 0.16, 0, false).userData.wing = s;
            const drop = new THREE.Group();
            drop.position.y = -0.42;
            g.add(drop);
            this.part(drop, 0.3, 0.32, 0.3, 'glow', 0, 0, 0);
            this.part(drop, 0.16, 0.14, 0.16, 0xffe08a, 0, -0.2, 0, false);
            this.root.add(g);
            const s = { kind: 'bee', bee: true, mod: this, x: h.x, y: 2, z: h.z, hb: [0.32, 0.32, 0.32], obj: g, body, drop, hive: h,
                r: 1.4 + Math.random() * 2.2, hh: 1.6 + Math.random() * 1.8, w: (0.5 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1), a: Math.random() * 6.3, ph: Math.random() * 6.3,
                alive: true, landed: false, grow: -0.4 - i * Math.min(0.08, 2 / count), flash: 0, dying: 0, gone: 0 };
            this.list.push(s);
            f.targets.push(s);
        }
    }

    hittable(s) {
        return s.alive && s.landed;
    }

    update(dt, time) {
        for (const s of this.list) {
            const k = s.landed ? 1 : Math.max(0.0001, typeof s.g === 'number' ? s.g : 0.0001);
            if (!s.alive) s.gone = Math.min(1, s.gone + dt * 1.6);
            // Vueltas alrededor de su colmena, subiendo y bajando; sin gota, se va al cielo
            if (s.alive) s.a += s.w * dt;
            s.x = s.hive.x + Math.cos(s.a) * s.r;
            s.z = s.hive.z + Math.sin(s.a) * s.r;
            s.y = s.hh + Math.sin(time * 1.7 + s.ph) * 0.35 + s.gone * s.gone * 18;
            s.obj.position.set(s.x, s.y + 0.42, s.z);
            s.obj.rotation.y = s.a * Math.sign(s.w) + (s.w > 0 ? 0 : Math.PI);
            s.obj.scale.setScalar(k);
            s.drop.visible = s.alive;
            for (const c of s.body.children) if (c.userData.wing) c.rotation.z = c.userData.wing * (0.3 + Math.sin(time * 40 + s.ph) * 0.4);
            s.obj.visible = s.gone < 1;
        }
        this.glow.color.setHSL(0.1, 1, 0.55 + Math.sin(time * 5) * 0.08);
    }

    clear() {
        for (const g of [...this.list.map((s) => s.obj), ...this.decor]) this.root.remove(g);
        this.list.length = 0;
        this.decor.length = 0;
    }
}
