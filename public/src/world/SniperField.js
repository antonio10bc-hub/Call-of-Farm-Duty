import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { SheafModel } from '../render/SheafModel.js';
import { CROPS } from '../content/crops.js';
import { FIELD } from '../content/field.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const HAY = 0xffd23f, HAY_DARK = 0xe6a400, WOOD = 0xb8763a;

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

// Campo de tiro: una isla en forma de cuadrilátero de lados distintos, con una torreta de
// paja en cada esquina y los haces de trigo repartidos dentro.
export class SniperField {
    constructor(theme, eyeHeight) {
        this.theme = theme;
        this.poly = FIELD.corners;
        this.cx = this.poly.reduce((s, p) => s + p.x, 0) / this.poly.length;
        this.cz = this.poly.reduce((s, p) => s + p.z, 0) / this.poly.length;
        // Torretas: un poco por fuera de cada esquina
        this.towers = this.poly.map((p) => {
            const dx = p.x - this.cx, dz = p.z - this.cz, d = Math.hypot(dx, dz);
            return { x: p.x + (dx / d) * FIELD.towerOut, z: p.z + (dz / d) * FIELD.towerOut, y: eyeHeight };
        });
        this.root = new THREE.Group();
        this.animated = [];
        this.trash = [];
        this.sheaves = [];
        this.introT = 0;
        this.build();
    }

    own(o) {
        this.trash.push(o);
        return o;
    }

    build() {
        const { theme, root } = this;
        const sea = new THREE.Mesh(this.own(new THREE.PlaneGeometry(800, 800)), this.own(new THREE.MeshBasicMaterial({ color: theme.sea })));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(this.cx, -0.8, this.cz);
        root.add(sea);

        // Casillas del campo (y bajo las torretas): suelo a cuadros sobre columnas de isla
        const xs = [...this.poly, ...this.towers].map((p) => p.x), zs = [...this.poly, ...this.towers].map((p) => p.z);
        const c0 = Math.floor(Math.min(...xs)) - 2, c1 = Math.ceil(Math.max(...xs)) + 2;
        const r0 = Math.floor(Math.min(...zs)) - 2, r1 = Math.ceil(Math.max(...zs)) + 2;
        this.cells = [];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
            const x = c + 0.5, z = r + 0.5;
            const nearTower = this.towers.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6);
            if (inside(this.poly, x, z) || edgeDist(this.poly, x, z) < 0.9 || nearTower) this.cells.push({ c, r, x, z });
        }
        this.cellSet = new Set(this.cells.map(({ c, r }) => `${c},${r}`));
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), this.own(toon(0xffffff)), this.cells.length);
        this.cells.forEach(({ c, r }, i) => floor.setColorAt(i, _c.setHex(theme.floor[(c + r) & 1]).offsetHSL(0, 0, (Math.random() - 0.5) * theme.floorJitter)));
        this.addAnimated(floor, this.cells.map(({ x, z }) => ({ x, y: -0.15, z })));
        const col = new THREE.InstancedMesh(box(1, 2.2, 1), this.own(toon(theme.island)), this.cells.length);
        this.addAnimated(col, this.cells.map(({ x, z }) => ({ x, y: -1.4, z })));
        const colHull = new THREE.InstancedMesh(box(1 + OUTLINE * 2, 2.2, 1 + OUTLINE * 2), this.own(outline(theme.outline)), this.cells.length);
        this.addAnimated(colHull, this.cells.map(({ x, z }) => ({ x, y: -1.4, z })));

        // Matas de hierba y flores sueltas
        const tufts = [], flowers = [];
        for (const { x, z } of this.cells) {
            if (Math.random() < 0.08) tufts.push({ x: x + (Math.random() - 0.5) * 0.5, y: 0.18, z: z + (Math.random() - 0.5) * 0.5, sx: 0.26, sy: 0.24, sz: 0.26, ry: Math.random() });
            if (Math.random() < 0.18) flowers.push({ x: x + (Math.random() - 0.5) * 0.7, y: 0.04, z: z + (Math.random() - 0.5) * 0.7, sx: 0.1, sy: 0.08, sz: 0.1 });
        }
        const tm = this.addHulled(0xffffff, tufts);
        tufts.forEach((_, i) => tm.setColorAt(i, _c.setHex(theme.bush[i % theme.bush.length])));
        const fm = new THREE.InstancedMesh(box(1, 1, 1), this.own(toon(0xffffff)), Math.max(1, flowers.length));
        flowers.forEach((_, i) => fm.setColorAt(i, _c.setHex(theme.flowers[(Math.random() * theme.flowers.length) | 0])));
        this.addAnimated(fm, flowers);

        // Torretas: pilas de balas de paja con barandilla
        const bales = [], bands = [], posts = [];
        for (const t of this.towers) {
            const levels = Math.round((t.y - 1.3) / 0.6);
            for (let k = 0; k < levels; k++) {
                const s = 1.5 - k * 0.12, y = 0.3 + k * 0.6;
                bales.push({ x: t.x, y, z: t.z, sx: s, sy: 0.6, sz: s, ry: k * 0.3 });
                bands.push({ x: t.x, y, z: t.z, sx: s + 0.04, sy: 0.1, sz: s + 0.04, ry: k * 0.3 });
            }
            const top = levels * 0.6;
            for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) posts.push({ x: t.x + ox, y: top + 0.25, z: t.z + oz, sx: 0.1, sy: 0.5, sz: 0.1 });
            t.floor = top;
        }
        const bm = this.addHulled(HAY, bales);
        bales.forEach((_, i) => bm.setColorAt(i, _c.setHex(i % 2 ? HAY : HAY_DARK)));
        const band = new THREE.InstancedMesh(box(1, 1, 1), this.own(toon(WOOD)), bands.length);
        this.addAnimated(band, bands);
        this.addHulled(WOOD, posts);

        this.buildFoam();
        this.buildClouds();
    }

    addHulled(color, pts) {
        const n = Math.max(1, pts.length);
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), this.own(toon(color)), n);
        const hull = new THREE.InstancedMesh(box(1, 1, 1), this.own(outline(this.theme.outline)), n);
        this.addAnimated(mesh, pts);
        this.addAnimated(hull, pts.map((p) => ({ ...p, sx: (p.sx || 1) + OUTLINE * 2, sy: (p.sy || 1) + OUTLINE * 2, sz: (p.sz || 1) + OUTLINE * 2 })));
        return mesh;
    }

    addAnimated(mesh, positions) {
        mesh.frustumCulled = false;
        mesh.count = positions.length;
        const delays = positions.map((p) => Math.hypot(p.x - this.cx, p.z - this.cz) * 0.03);
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

    buildFoam() {
        // Espuma por fuera de las casillas del borde
        const pts = [];
        for (const { c, r, x, z } of this.cells) {
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                if (this.cellSet.has(`${c + dc},${r + dr}`)) continue;
                for (let k = 0; k < 2; k++) {
                    pts.push({ x: x + dc * (0.75 + Math.random() * 0.3) + (dr ? (Math.random() - 0.5) : 0), z: z + dr * (0.75 + Math.random() * 0.3) + (dc ? (Math.random() - 0.5) : 0), ph: Math.random() * 6, s: 0.12 + Math.random() * 0.16 });
                }
            }
        }
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), this.own(new THREE.MeshBasicMaterial({ color: this.theme.foam })), pts.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        this.root.add(mesh);
        this.foam = { mesh, pts };
    }

    buildClouds() {
        const mat = this.own(toon(this.theme.clouds)), hullMat = this.own(outline(this.theme.outline));
        this.clouds = [];
        for (let i = 0; i < 9; i++) {
            const g = new THREE.Group();
            const parts = 3 + (i % 3);
            for (let k = 0; k < parts; k++) {
                const w = 1.4 + Math.random() * 1.6, h = 0.7 + Math.random() * 0.5, d = 1.2 + Math.random();
                const m = new THREE.Mesh(box(1, 1, 1), mat);
                m.scale.set(w, h, d);
                m.position.set(k * 1.2 - parts * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.8);
                const o = new THREE.Mesh(box(1, 1, 1), hullMat);
                o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
                o.position.copy(m.position);
                g.add(m, o);
            }
            const a = (i / 9) * Math.PI * 2;
            g.position.set(this.cx + Math.sin(a) * (24 + Math.random() * 10), 6 + Math.random() * 5, this.cz + Math.cos(a) * (24 + Math.random() * 10));
            g.userData.speed = 0.3 + Math.random() * 0.4;
            this.root.add(g);
            this.clouds.push(g);
        }
    }

    // Coloca un haz por cada uno que quede en las parcelas listas (plots: [{plot, count}])
    spawnSheaves(plots) {
        this.clearSheaves();
        const m = FIELD.margin, list = [];
        for (const { plot, count } of plots) for (let k = 0; k < count; k++) list.push(plot);
        const xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z);
        list.forEach((plot, i) => {
            let x = 0, z = 0;
            for (let tries = 0; tries < 80; tries++) {
                x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
                z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
                if (!inside(this.poly, x, z) || edgeDist(this.poly, x, z) < m) continue;
                if (this.sheaves.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
                break;
            }
            const model = new SheafModel(CROPS.wheat.sheaf, this.theme.outline);
            model.root.position.set(x, 30, z);
            this.root.add(model.root);
            this.sheaves.push({ model, plot, x, z, alive: true, drop: -0.6 - i * 0.12, landed: false });
        });
    }

    clearSheaves() {
        for (const s of this.sheaves) {
            this.root.remove(s.model.root);
            s.model.dispose();
        }
        this.sheaves.length = 0;
    }

    get remaining() {
        return this.sheaves.reduce((n, s) => n + (s.alive ? 1 : 0), 0);
    }

    // Rayo contra las cajas de los haces vivos: devuelve el más cercano o null
    raycast(origin, dir) {
        let best = null, bestT = Infinity;
        for (const s of this.sheaves) {
            if (!s.alive || !s.landed) continue;
            const t = rayBox(origin, dir, s.x - 0.38, 0, s.z - 0.38, s.x + 0.38, 1.25, s.z + 0.38);
            if (t !== null && t < bestT) { bestT = t; best = s; }
        }
        return best ? { sheaf: best, t: bestT } : null;
    }

    // onLand(sheaf): cuando un haz toca el suelo (polvo, sonido)
    update(dt, time, eye, onLand) {
        if (this.introT < 2) {
            this.introT += dt;
            for (const a of this.animated) this.layout(a, this.introT);
        }
        for (const s of this.sheaves) {
            const r = s.model.root;
            if (!s.alive) continue;
            if (!s.landed) {
                s.drop += dt;
                const k = Math.min(1, Math.max(0, s.drop / 0.55));
                r.position.y = 14 * (1 - k * k);
                s.model.placeShadow(r.position.y);
                if (k >= 1) {
                    s.landed = true;
                    r.position.y = 0;
                    s.model.placeShadow(0);
                    s.squash = 1;
                    if (onLand) onLand(s);
                }
            }
            // Aplastamiento al aterrizar
            if (s.squash > 0) {
                s.squash = Math.max(0, s.squash - dt * 4);
                const q = Math.sin(s.squash * Math.PI) * 0.3;
                r.scale.set(1 + q, 1 - q, 1 + q);
            }
            // Mira hacia la torreta
            r.rotation.y = Math.atan2(eye.x - s.x, eye.z - s.z);
            s.model.update(dt, time);
        }
        const { mesh, pts } = this.foam;
        pts.forEach((p, i) => {
            const sc = p.s * (0.8 + Math.sin(time * 3 + p.ph) * 0.35);
            _d.position.set(p.x, -0.78 + Math.sin(time * 2 + p.ph) * 0.05, p.z);
            _d.rotation.set(0, p.ph + time * 0.5, 0);
            _d.scale.set(sc * 2, sc * 0.5, sc * 2);
            _d.updateMatrix();
            mesh.setMatrixAt(i, _d.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        for (const c of this.clouds) {
            const a = Math.atan2(c.position.x - this.cx, c.position.z - this.cz) + c.userData.speed * dt * 0.02;
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
