import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { CROPS } from '../content/crops.js';

// La piscifactoría de perlas (el campo de tiro de las perlas): una balsa en medio del campo, con
// su muro de hormigón y el agua por encima, y almejas en el fondo. Cada almeja está cerrada y, de
// vez en cuando, se abre hacia un lado: solo se le puede dar a la perla abierta y de cara a tu
// torre (hittable, con el ojo del tirador). A ratos se van nadando a otro sitio a palmadas,
// soltando burbujas (onBubble). Al darle, la perla salta y la almeja se cierra y se hunde.
const _d = new THREE.Object3D();
const _v = new THREE.Vector3();
const r = (a) => a[0] + Math.random() * (a[1] - a[0]);
const SCALE = 1.55;

export class Clams {
    constructor(outlineColor) {
        this.root = new THREE.Group();
        this.outlineColor = outlineColor;
        this.mats = new Map();
        this.list = [];
        this.decor = [];
        this.meshes = [];
    }

    mat(c) {
        // (la perla brilla: sin luz)
        return this.mats.get(c) || this.mats.set(c, c === CROPS.sunflower.pearl ? new THREE.MeshBasicMaterial({ color: c }) : toon(c)).get(c);
    }

    part(g, w, h, d, c, x, y, z, line = true) {
        const m = new THREE.Mesh(box(w, h, d), this.mat(c));
        m.position.set(x, y, z);
        g.add(m);
        if (line) {
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.lineMat || (this.lineMat = outline(this.outlineColor)));
            o.position.copy(m.position);
            g.add(o);
        }
        return m;
    }

    // Una almeja: la concha de abajo con su interior rosa, la de arriba (con bisagra atrás, -z) y la
    // perla. Se abre hacia +z
    clam(i) {
        const C = CROPS.sunflower, g = new THREE.Group(), shell = C.shell[i % C.shell.length];
        this.part(g, 0.7, 0.14, 0.62, shell, 0, 0.07, 0);
        this.part(g, 0.58, 0.03, 0.5, C.inside, 0, 0.155, 0.02, false);
        const lid = new THREE.Group();
        lid.position.set(0, 0.14, -0.31);
        g.add(lid);
        this.part(lid, 0.72, 0.12, 0.64, shell, 0, 0.06, 0.32);
        for (const z of [0.18, 0.42]) this.part(lid, 0.74, 0.03, 0.05, C.shellDark, 0, 0.13, z, false); // (las estrías)
        this.part(lid, 0.58, 0.03, 0.5, C.inside, 0, -0.005, 0.32, false);
        const pearl = this.part(g, 0.24, 0.24, 0.24, C.pearl, 0, 0.27, 0.06);
        const pearlHull = g.children[g.children.length - 1];
        g.scale.setScalar(SCALE);
        this.root.add(g);
        return { g, lid, pearl, pearlHull };
    }

    // Pone count almejas en la piscina del campo f (SniperField: su laguna con borde recto)
    spawn(count, f) {
        this.clear();
        this.f = f;
        const C = CROPS.sunflower, water = [], rim = [];
        for (const t of f.tiles) {
            if (!t.soil) continue;
            const x = t.c + 0.5, z = t.r + 0.5;
            if (f.inPond(x, z)) water.push({ x, z });
            else if (f.inPond(x, z, 1.3)) rim.push({ x, z });
        }
        // El muro de la piscina (hormigón) y el agua: una lámina azul transparente por encima
        // de las almejas
        const wall = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, rim.length));
        rim.forEach((p, i) => {
            _d.position.set(p.x, 0.27, p.z);
            _d.scale.set(1, 0.55, 1);
            _d.updateMatrix();
            wall.setMatrixAt(i, _d.matrix);
            wall.setColorAt(i, new THREE.Color([0xc8c4b8, 0xb8b4a8][(Math.floor(p.x) + Math.floor(p.z)) & 1]));
        });
        const surf = new THREE.InstancedMesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0.32, depthWrite: false }), Math.max(1, water.length));
        water.forEach((p, i) => {
            _d.position.set(p.x, 0.44, p.z);
            _d.scale.set(1, 0.02, 1);
            _d.updateMatrix();
            surf.setMatrixAt(i, _d.matrix);
        });
        surf.renderOrder = 2;
        for (const m of [wall, surf]) {
            m.frustumCulled = false;
            this.root.add(m);
            this.meshes.push(m);
        }
        for (let i = 0; i < count; i++) {
            const at = this.spot(), c = this.clam(i);
            const s = { kind: 'clam', mod: this, clam: c, cx: at.x, cz: at.z, x: at.x, y: 0.3, z: at.z, hb: [0.3, 0.3, 0.3], ry: Math.random() * Math.PI * 2,
                mode: 'closed', t: r(C.closed) * Math.random(), open: 0, swim: null, sink: 0,
                alive: true, landed: false, grow: -0.5 - i * Math.min(0.08, 2.4 / count), flash: 0, dying: 0 };
            this.list.push(s);
            f.targets.push(s);
        }
    }

    // Un sitio del fondo de la piscina (lejos del muro y de las demás, si se puede)
    spot() {
        const f = this.f;
        let best = null;
        for (let k = 0; k < 20; k++) {
            const p = f.pondSpot(0.9);
            if (!this.list.some((s) => Math.hypot(s.cx - p.x, s.cz - p.z) < 1.4)) return p;
            best = p;
        }
        return best;
    }

    // ¿Te mira? (la almeja abierta, de cara al tirador)
    facing(s, eye) {
        if (!eye) return true;
        const dx = eye.x - s.cx, dz = eye.z - s.cz, d = Math.hypot(dx, dz) || 1;
        return (Math.sin(s.ry) * dx + Math.cos(s.ry) * dz) / d > 0.2;
    }

    hittable(s, eye) {
        return s.alive && s.landed && !s.gone && s.open > 0.7 && this.facing(s, eye);
    }

    update(dt, time) {
        const C = CROPS.sunflower;
        for (const s of this.list) {
            const c = s.clam;
            c.g.visible = !s.gone && s.sink < 1;
            if (!c.g.visible) continue;
            if (!s.alive) {
                // Sin perla: se cierra y se hunde
                s.sink = Math.min(1, s.sink + dt * 1.5);
                s.open = Math.max(0, s.open - dt * 5);
            } else if (s.landed) {
                s.t -= dt;
                if (s.mode === 'closed' && s.t <= 0) {
                    s.mode = 'opening';
                    // (a veces se gira antes de abrirse: hacia un lado cualquiera)
                    if (Math.random() < 0.5) s.ry = Math.random() * Math.PI * 2;
                    if (this.f.onBubble) this.f.onBubble(s.cx, s.cz, 1);
                } else if (s.mode === 'opening' && (s.open = Math.min(1, s.open + dt * 3)) >= 1) {
                    s.mode = 'open';
                    s.t = r(C.open);
                } else if (s.mode === 'open' && s.t <= 0) s.mode = 'closing';
                else if (s.mode === 'closing' && (s.open = Math.max(0, s.open - dt * 4)) <= 0) {
                    // Cerrada: espera, o se va nadando a otro sitio
                    if (Math.random() < C.swim) {
                        const to = this.spot();
                        s.mode = 'swim';
                        s.swim = { x0: s.cx, z0: s.cz, x1: to.x, z1: to.z, t: 0, T: 1.2 + Math.hypot(to.x - s.cx, to.z - s.cz) * 0.25, bub: 0 };
                        s.ry = Math.atan2(to.x - s.cx, to.z - s.cz) + Math.PI; // (nadan de culo: la bisagra delante)
                    } else {
                        s.mode = 'closed';
                        s.t = r(C.closed);
                    }
                } else if (s.mode === 'swim') {
                    const W = s.swim;
                    W.t += dt;
                    const k = Math.min(1, W.t / W.T);
                    s.cx = W.x0 + (W.x1 - W.x0) * k;
                    s.cz = W.z0 + (W.z1 - W.z0) * k;
                    s.open = 0.25 + Math.sin(W.t * 18) * 0.2; // (las palmadas)
                    if ((W.bub -= dt) <= 0 && this.f.onBubble) {
                        W.bub = 0.25;
                        this.f.onBubble(s.cx, s.cz, 0);
                    }
                    if (k >= 1) {
                        s.mode = 'closed';
                        s.open = 0;
                        s.t = r(C.closed);
                        s.swim = null;
                    }
                }
            }
            const g = s.landed ? 1 : s.g || 0.0001, lift = s.mode === 'swim' ? Math.sin(Math.min(1, s.swim.t / s.swim.T) * Math.PI) * 0.18 : 0;
            c.g.position.set(s.cx, 0.03 + lift - s.sink * 0.3, s.cz);
            c.g.rotation.y = s.ry;
            c.g.scale.setScalar(SCALE * g * (1 - s.sink * 0.6) * (1 + s.flash * 0.2));
            c.lid.rotation.x = -s.open * 1.05;
            c.pearl.visible = c.pearlHull.visible = s.alive && s.open > 0.15;
            // La perla, en el mundo (el blanco)
            c.g.updateMatrixWorld();
            c.pearl.getWorldPosition(_v);
            s.x = _v.x;
            s.y = _v.y;
            s.z = _v.z;
        }
    }

    clear() {
        for (const g of [...this.list.map((s) => s.clam.g), ...this.decor]) this.root.remove(g);
        for (const m of this.meshes) {
            this.root.remove(m);
            m.dispose();
            m.material.dispose();
        }
        this.meshes = [];
        this.list.length = 0;
        this.decor.length = 0;
    }
}
