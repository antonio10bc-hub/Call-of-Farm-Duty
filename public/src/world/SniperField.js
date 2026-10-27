import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { Tower } from '../render/structures.js';
import { CROPS } from '../content/crops.js';
import { FIELD } from '../content/field.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _w = new THREE.Color(0xffffff);
const CLUMP = 20; // tallos por mata madura

// Punto dentro del polígono (regla del rayo)
function inside(poly, x, z) {
    let ok = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ok = !ok;
    }
    return ok;
}

// Distancia de un punto al borde del polígono
function edgeDist(poly, x, z) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j], b = poly[i];
        const vx = b.x - a.x, vz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
        best = Math.min(best, Math.hypot(x - a.x - vx * t, z - a.z - vz * t));
    }
    return best;
}

// Campo de tiro: un campo de trigo en forma de cuadrilátero de lados distintos, con una
// torre de vigía en cada esquina. Las matas maduras son los blancos.
export class SniperField {
    constructor(theme) {
        this.theme = theme;
        this.poly = FIELD.corners;
        this.cx = this.poly.reduce((s, p) => s + p.x, 0) / this.poly.length;
        this.cz = this.poly.reduce((s, p) => s + p.z, 0) / this.poly.length;
        this.root = new THREE.Group();
        this.animated = [];
        this.targets = [];
        this.introT = 0;
        // Torres: un poco por fuera de cada esquina, girada hacia el centro
        this.towers = this.poly.map((p) => {
            const dx = p.x - this.cx, dz = p.z - this.cz, d = Math.hypot(dx, dz);
            const t = new Tower(theme.outline, true);
            const x = p.x + (dx / d) * FIELD.towerOut, z = p.z + (dz / d) * FIELD.towerOut;
            t.root.position.set(x, 0, z);
            t.root.rotation.y = Math.atan2(this.cx - x, this.cz - z) + Math.PI;
            this.root.add(t.root);
            return { x, z, floor: 3.2, model: t };
        });
        this.build();
    }

    build() {
        const { theme, root } = this;
        const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(theme.grassFar));
        far.rotation.x = -Math.PI / 2;
        far.position.set(this.cx, -0.31, this.cz);
        root.add(far);

        // Casillas alrededor del campo: dentro tierra arada, fuera hierba
        const xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z);
        const c0 = Math.floor(Math.min(...xs)) - 7, c1 = Math.ceil(Math.max(...xs)) + 7;
        const r0 = Math.floor(Math.min(...zs)) - 7, r1 = Math.ceil(Math.max(...zs)) + 7;
        const tiles = [];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) tiles.push({ c, r, soil: inside(this.poly, c + 0.5, r + 0.5) });
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), toon(0xffffff), tiles.length);
        tiles.forEach(({ c, r, soil }, i) => floor.setColorAt(i, _c.setHex(soil ? theme.soil[r & 1] : theme.grass[(c * 5 + r * 3) % 3]).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter)));
        this.addAnimated(floor, tiles.map(({ c, r, soil }) => ({ x: c + 0.5, y: soil ? -0.12 : -0.15, z: r + 0.5 })));

        // Rastrojo: trigo bajo por todo el campo (decorado, no se dispara)
        const stub = [];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
            for (let k = 0; k < 3; k++) {
                const x = c + Math.random(), z = r + Math.random();
                if (!inside(this.poly, x, z)) continue;
                const h = 0.1 + Math.random() * 0.18;
                stub.push({ x, y: h / 2, z, sx: 0.05, sy: h, sz: 0.05, ry: 0, tone: Math.random() });
            }
        }
        const sm = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, stub.length));
        stub.forEach((s, i) => sm.setColorAt(i, _c.setHex(s.tone < 0.7 ? 0xb8a050 : CROPS.wheat.stages[1]).offsetHSL(0, 0, (s.tone - 0.5) * 0.1)));
        this.addAnimated(sm, stub);

        // Valla a lo largo de los bordes del campo
        const posts = [];
        for (let i = 0; i < this.poly.length; i++) {
            const a = this.poly[i], b = this.poly[(i + 1) % this.poly.length];
            const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 1.2);
            for (let k = 0; k <= n; k++) posts.push({ x: a.x + ((b.x - a.x) * k) / n, y: 0.3, z: a.z + ((b.z - a.z) * k) / n, sx: 0.12, sy: 0.6, sz: 0.12 });
        }
        this.addHulled(0x9a6a3a, posts);

        // Árboles alrededor, y colinas a lo lejos
        const trunks = [], leaves = [];
        for (let k = 0; k < 60; k++) {
            const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 16, s = 0.9 + Math.random() * 0.7;
            const x = this.cx + Math.sin(a) * d, z = this.cz + Math.cos(a) * d;
            trunks.push({ x, y: 0.5 * s, z, sx: 0.3 * s, sy: s, sz: 0.3 * s });
            leaves.push({ x, y: 1.35 * s, z, sx: 1.5 * s, sy: 0.9 * s, sz: 1.5 * s, ry: k, k: 0 });
            leaves.push({ x, y: 2.0 * s, z, sx: 1.05 * s, sy: 0.7 * s, sz: 1.05 * s, ry: k + 0.4, k: 1 });
        }
        this.addHulled(0x7a4f2a, trunks);
        const lm = this.addHulled(0xffffff, leaves);
        leaves.forEach((p, i) => lm.setColorAt(i, _c.setHex(theme.leaves[(p.k + i) % 3])));
        // Nubes
        const mat = toon(theme.clouds), hullMat = outline(theme.outline);
        this.clouds = [];
        for (let i = 0; i < 10; i++) {
            const g = new THREE.Group();
            const parts = 3 + (i % 3);
            for (let k = 0; k < parts; k++) {
                const w = 1.8 + Math.random() * 2, h = 0.8 + Math.random() * 0.5, d = 1.4 + Math.random();
                const m = new THREE.Mesh(box(1, 1, 1), mat);
                m.scale.set(w, h, d);
                m.position.set(k * 1.4 - parts * 0.7, Math.random() * 0.4, (Math.random() - 0.5) * 0.8);
                const o = new THREE.Mesh(box(1, 1, 1), hullMat);
                o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
                o.position.copy(m.position);
                g.add(m, o);
            }
            const a = (i / 10) * Math.PI * 2;
            g.position.set(this.cx + Math.sin(a) * (30 + Math.random() * 15), 10 + Math.random() * 6, this.cz + Math.cos(a) * (30 + Math.random() * 15));
            g.userData.speed = 0.3 + Math.random() * 0.4;
            root.add(g);
            this.clouds.push(g);
        }

        // Matas maduras (los blancos): tallos y espigas instanciados, se rellenan en spawn()
        const max = 64 * CLUMP;
        this.tStalks = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), max);
        this.tEars = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), max);
        for (const m of [this.tStalks, this.tEars]) {
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.frustumCulled = false;
            m.count = 0;
            root.add(m);
        }
    }

    addHulled(color, pts) {
        const n = Math.max(1, pts.length);
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), toon(color), n);
        const hull = new THREE.InstancedMesh(box(1, 1, 1), outline(this.theme.outline), n);
        this.addAnimated(mesh, pts);
        this.addAnimated(hull, pts.map((p) => ({ ...p, sx: (p.sx || 1) + OUTLINE * 2, sy: (p.sy || 1) + OUTLINE * 2, sz: (p.sz || 1) + OUTLINE * 2 })));
        return mesh;
    }

    addAnimated(mesh, positions) {
        mesh.frustumCulled = false;
        mesh.count = positions.length;
        const delays = positions.map((p) => Math.min(1.2, Math.hypot(p.x - this.cx, p.z - this.cz) * 0.03));
        const entry = { mesh, positions, delays };
        this.animated.push(entry);
        this.root.add(mesh);
        this.layout(entry, 0);
        return entry;
    }

    layout({ mesh, positions, delays }, t) {
        positions.forEach((p, i) => {
            const k = Math.min(1, Math.max(0, (t - delays[i]) / 0.45));
            const s = k <= 0 ? 0.0001 : easeOutBack(k);
            _d.position.set(p.x, p.y - (1 - k) * 3, p.z);
            _d.rotation.set(0, p.ry || 0, 0);
            _d.scale.set(p.sx || 1, (p.sy || 1) * s, p.sz || 1);
            _d.updateMatrix();
            mesh.setMatrixAt(i, _d.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
    }

    // Coloca una mata por cada haz que quede (plots: [{ plot, count }])
    spawnSheaves(plots) {
        this.targets.length = 0;
        const list = [];
        for (const { plot, count } of plots) for (let k = 0; k < count; k++) list.push(plot);
        const xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z);
        list.slice(0, 64).forEach((plot, i) => {
            let x = 0, z = 0;
            for (let tries = 0; tries < 80; tries++) {
                x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
                z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
                if (!inside(this.poly, x, z) || edgeDist(this.poly, x, z) < FIELD.margin) continue;
                if (this.targets.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
                break;
            }
            const stalks = Array.from({ length: CLUMP }, () => {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.38;
                return { ox: Math.sin(a) * r, oz: Math.cos(a) * r, h: 1.2 + Math.random() * 0.45 - r * 0.6, tilt: (Math.random() - 0.5) * 0.25, dir: Math.random() * Math.PI * 2, ph: Math.random() * 6, tone: Math.random() };
            });
            this.targets.push({ plot, x, z, stalks, alive: true, grow: -0.5 - i * 0.06, landed: false, flash: 0, dying: 0 });
        });
        this.tStalks.count = this.tEars.count = this.targets.length * CLUMP;
    }

    clearSheaves() {
        this.targets.length = 0;
        this.tStalks.count = this.tEars.count = 0;
    }

    get sheaves() {
        return this.targets;
    }

    get remaining() {
        return this.targets.reduce((n, s) => n + (s.alive ? 1 : 0), 0);
    }

    // Rayo contra las cajas de las matas vivas: devuelve la más cercana o null
    raycast(origin, dir) {
        let best = null, bestT = Infinity;
        for (const s of this.targets) {
            if (!s.alive || !s.landed) continue;
            // La caja se ciñe a la silueta de la mata (tallos y espigas)
            const t = rayBox(origin, dir, s.x - 0.36, 0, s.z - 0.36, s.x + 0.36, 1.55, s.z + 0.36);
            if (t !== null && t < bestT) { bestT = t; best = s; }
        }
        return best ? { sheaf: best, t: bestT } : null;
    }

    // onLand(target): cuando una mata termina de brotar
    update(dt, time, eye, onLand) {
        if (this.introT < 2.2) {
            this.introT += dt;
            for (const a of this.animated) this.layout(a, this.introT);
        }
        this.targets.forEach((s, ti) => {
            if (!s.landed) {
                s.grow += dt;
                const k = Math.min(1, Math.max(0, s.grow / 0.5));
                s.g = k <= 0 ? 0.0001 : easeOutBack(k);
                if (k >= 1) {
                    s.landed = true;
                    if (onLand) onLand(s);
                }
            }
            if (s.dying > 0) s.dying = Math.max(0, s.dying - dt);
            const gone = !s.alive && s.dying <= 0;
            const pop = !s.alive ? 1 + (0.14 - s.dying) * 2.5 : 1;
            s.flash = Math.max(0, s.flash - dt * 6);
            s.stalks.forEach((st, k) => {
                const i = ti * CLUMP + k;
                const h = st.h * (s.g || 0.0001) * (gone ? 0.0001 : 1);
                // Viento: se mecen en ola, más las de arriba
                const sway = st.tilt + Math.sin(time * 1.8 - s.x * 0.4 + st.ph * 0.2) * 0.1;
                const sx = Math.sin(st.dir) * Math.sin(sway), sz = Math.cos(st.dir) * Math.sin(sway);
                _d.position.set(s.x + st.ox * pop + sx * h / 2, Math.cos(sway) * h / 2, s.z + st.oz * pop + sz * h / 2);
                _d.rotation.set(Math.cos(st.dir) * sway, 0, -Math.sin(st.dir) * sway);
                _d.scale.set(0.06 * pop, Math.max(0.0001, h), 0.06 * pop);
                _d.updateMatrix();
                this.tStalks.setMatrixAt(i, _d.matrix);
                _c.setHex(CROPS.wheat.stages[3]).offsetHSL(0, 0, (st.tone - 0.5) * 0.1).lerp(_w, s.flash);
                this.tStalks.setColorAt(i, _c);
                const e = gone ? 0.0001 : (s.g || 0.0001) * pop;
                _d.position.set(s.x + st.ox * pop + sx * (h + 0.12), Math.cos(sway) * (h + 0.12), s.z + st.oz * pop + sz * (h + 0.12));
                _d.scale.set(0.11 * e, 0.28 * e, 0.11 * e);
                _d.updateMatrix();
                this.tEars.setMatrixAt(i, _d.matrix);
                _c.setHex(st.tone < 0.5 ? CROPS.wheat.ear : CROPS.wheat.earDark).lerp(_w, s.flash);
                this.tEars.setColorAt(i, _c);
            });
        });
        for (const m of [this.tStalks, this.tEars]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        for (const t of this.towers) t.model.update(dt);
        for (const c of this.clouds) {
            const a = Math.atan2(c.position.x - this.cx, c.position.z - this.cz) + c.userData.speed * dt * 0.015;
            const d = Math.hypot(c.position.x - this.cx, c.position.z - this.cz);
            c.position.x = this.cx + Math.sin(a) * d;
            c.position.z = this.cz + Math.cos(a) * d;
        }
    }

    restartIntro() {
        this.introT = 0;
    }
}

// Rayo contra caja alineada con los ejes (método de las franjas). Devuelve t o null.
function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = Infinity;
    for (const [oa, da, lo, hi] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
        if (Math.abs(da) < 1e-9) {
            if (oa < lo || oa > hi) return null;
            continue;
        }
        let t0 = (lo - oa) / da, t1 = (hi - oa) / da;
        if (t0 > t1) [t0, t1] = [t1, t0];
        tmin = Math.max(tmin, t0);
        tmax = Math.min(tmax, t1);
        if (tmin > tmax) return null;
    }
    return tmin;
}
