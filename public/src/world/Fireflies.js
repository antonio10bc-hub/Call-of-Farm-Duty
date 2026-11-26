import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { CROPS } from '../content/crops.js';

// El prado de las luciérnagas (su campo de tiro; solo se entra de noche): hierba alta y
// luciérnagas revoloteando cada una alrededor de su sitio, a su altura, encendiéndose y
// apagándose (las apagadas se ven peor, pero también valen). Todo instanciado: pueden ser muchas.
// Al darle a una, revienta en un fogonazo de luz.
const _d = new THREE.Object3D();
const _c = new THREE.Color(), _c2 = new THREE.Color();
const MAX = 300, GRASS = 3; // (matas de hierba por cada luciérnaga)

export class Fireflies {
    constructor(outlineColor) {
        this.root = new THREE.Group();
        this.list = [];
        const inst = (mat, n) => {
            const m = new THREE.InstancedMesh(box(1, 1, 1), mat, n);
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.frustumCulled = false;
            m.count = 0;
            this.root.add(m);
            return m;
        };
        const C = CROPS.corn;
        this.body = inst(toon(C.body), MAX);
        this.bodyHull = inst(outline(outlineColor), MAX);
        this.wings = inst(new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.7 }), MAX * 2);
        this.tail = inst(new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
        this.halo = inst(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }), MAX);
        this.grass = inst(toon(0xffffff), MAX * GRASS);
    }

    // Pone count luciérnagas en el campo f (SniperField) y su hierba alta
    spawn(count, f) {
        this.clear();
        count = Math.min(count, MAX);
        const C = CROPS.corn;
        for (let i = 0; i < count; i++) {
            const { x, z } = f.freeSpot(this.list, count > 120 ? 0.9 : 1.4);
            const s = { kind: 'firefly', mod: this, hx: x, hz: z, x, y: 1, z, hb: [0.3, 0.3, 0.3],
                h: 0.7 + Math.random() * 1.8, rx: 0.6 + Math.random() * 1.2, rz: 0.6 + Math.random() * 1.2, w: [0.3 + Math.random() * 0.5, 0.25 + Math.random() * 0.5, 0.5 + Math.random() * 0.8], ph: [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3],
                blink: 1.2 + Math.random() * 1.6, bph: Math.random() * 6.3, lit: 1, pop: 0,
                grassAt: Array.from({ length: GRASS }, () => ({ x: x + (Math.random() - 0.5) * 1.2, z: z + (Math.random() - 0.5) * 1.2, h: 0.5 + Math.random() * 0.7, ry: Math.random() * 3, tone: Math.random() })),
                alive: true, landed: false, grow: -0.4 - i * Math.min(0.03, 2.4 / count), flash: 0, dying: 0 };
            this.list.push(s);
            f.targets.push(s);
        }
        for (const m of [this.body, this.bodyHull, this.tail, this.halo]) m.count = count;
        this.wings.count = count * 2;
        this.grass.count = count * GRASS;
        this.list.forEach((s, i) => s.grassAt.forEach((b, k) => this.grass.setColorAt(i * GRASS + k, _c.setHex(C.leaves[(i + k) % 3]).offsetHSL(0, 0, (b.tone - 0.5) * 0.08))));
        if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
    }

    hittable(s) {
        return s.alive && s.landed && !s.gone;
    }

    update(dt, time) {
        const C = CROPS.corn;
        this.list.forEach((s, i) => {
            const g = s.landed ? 1 : Math.max(0.0001, s.g || 0.0001);
            // La hierba: brota con el campo y se mece
            s.grassAt.forEach((b, k) => {
                const sway = Math.sin(time * 1.3 + b.x * 0.5 + k) * 0.12, h = b.h * g;
                _d.position.set(b.x + Math.sin(sway) * h / 2, h / 2, b.z);
                _d.rotation.set(0, b.ry, sway);
                _d.scale.set(0.06, Math.max(0.0001, h), 0.14);
                _d.updateMatrix();
                this.grass.setMatrixAt(i * GRASS + k, _d.matrix);
            });
            // Revolotea en lazos alrededor de su sitio, subiendo y bajando
            const [w0, w1, w2] = s.w, [p0, p1, p2] = s.ph, t = time;
            const x = s.hx + Math.sin(t * w0 + p0) * s.rx + Math.sin(t * w0 * 2.3 + p1) * 0.25;
            const z = s.hz + Math.cos(t * w1 + p1) * s.rz + Math.cos(t * w1 * 1.9 + p2) * 0.25;
            const y = s.h * g + Math.sin(t * w2 + p2) * 0.35;
            const vx = Math.cos(t * w0 + p0) * s.rx * w0, vz = -Math.sin(t * w1 + p1) * s.rz * w1;
            s.x = x;
            s.y = y;
            s.z = z;
            // Se enciende y se apaga (con su fogonazo al recogerla)
            s.lit = Math.max(0, Math.min(1, Math.sin(t * s.blink + s.bph) * 2 + 1));
            const gone = s.gone || (!s.alive && s.dying <= 0);
            if (!s.alive) s.pop = Math.min(1, s.pop + dt * 5);
            const k = gone ? 0.0001 : g, ry = Math.atan2(vx, vz);
            _d.position.set(x, y, z);
            _d.rotation.set(0, ry, 0);
            _d.scale.set(0.14 * k, 0.1 * k, 0.24 * k);
            _d.updateMatrix();
            this.body.setMatrixAt(i, _d.matrix);
            _d.scale.set(0.14 * k + OUTLINE * 2, 0.1 * k + OUTLINE * 2, 0.24 * k + OUTLINE * 2);
            _d.updateMatrix();
            this.bodyHull.setMatrixAt(i, _d.matrix);
            // Las alas, aleteando
            for (const side of [-1, 1]) {
                _d.position.set(x, y + 0.06 * k, z);
                _d.rotation.set(0, ry, side * (0.4 + Math.sin(t * 38 + i) * 0.5));
                _d.translateX(side * 0.1 * k);
                _d.scale.set(0.16 * k, 0.02 * k, 0.12 * k);
                _d.updateMatrix();
                this.wings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), _d.matrix);
            }
            // La cola que brilla (detrás) y su halo
            const glow = s.alive ? 0.25 + s.lit * 0.75 : 1, burst = 1 + s.pop * 3;
            _d.position.set(x, y, z);
            _d.rotation.set(0, ry, 0);
            _d.translateZ(-0.14 * k);
            _d.scale.setScalar((0.12 + s.lit * 0.04) * k * burst);
            _d.updateMatrix();
            this.tail.setMatrixAt(i, _d.matrix);
            this.tail.setColorAt(i, _c.setHex(C.glowDark).lerp(_c2.setHex(C.glow), glow).lerp(_c2.setHex(0xffffff), s.flash));
            _d.scale.setScalar(Math.max(0.0001, (0.2 + s.lit * 0.32) * k * burst * (s.alive ? 1 : 1 - s.pop * 0.5)));
            _d.updateMatrix();
            this.halo.setMatrixAt(i, _d.matrix);
            this.halo.setColorAt(i, _c.setHex(C.glow).multiplyScalar(s.alive ? s.lit : 1 - s.pop));
        });
        for (const m of [this.body, this.bodyHull, this.wings, this.tail, this.halo, this.grass]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
    }

    clear() {
        this.list.length = 0;
        for (const m of [this.body, this.bodyHull, this.wings, this.tail, this.halo, this.grass]) m.count = 0;
    }
}
