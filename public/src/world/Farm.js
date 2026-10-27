import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { BarnModel } from '../render/BarnModel.js';
import { CROPS } from '../content/crops.js';
import { PLOT_COUNT } from '../game/FarmState.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const INTRO_TIME = 1.6;
export const FARM_SIZE = 17;
// Centros de las 8 parcelas (3x3 casillas) alrededor del granero
const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const STALKS = 6; // tallos por lado de cada parcela

// Vista de la granja (menú principal): isla flotante, granero en el centro y campos de trigo
// alrededor. Todo cae desde abajo y rebota al montarse, en ola desde el centro.
export class Farm {
    constructor(theme) {
        this.theme = theme;
        this.cols = this.rows = FARM_SIZE;
        this.cx = this.cz = FARM_SIZE / 2;
        this.plots = RING.map(([dx, dz]) => ({ x: this.cx + dx * 4, z: this.cz + dz * 4 }));
        this.animated = [];
        this.trash = [];
        this.introT = 0;
        this.root = new THREE.Group();
        this.build();
    }

    isPlotTile(c, r) {
        return this.plots.findIndex((p) => Math.abs(c + 0.5 - p.x) < 1.5 && Math.abs(r + 0.5 - p.z) < 1.5);
    }

    build() {
        const { cols, rows, cx, cz, theme, root } = this;
        const own = (o) => (this.trash.push(o), o);

        // Mar e isla
        const sea = new THREE.Mesh(own(new THREE.PlaneGeometry(600, 600)), own(new THREE.MeshBasicMaterial({ color: theme.sea })));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(cx, -0.8, cz);
        root.add(sea);
        const island = new THREE.Mesh(box(cols + 0.4, 2.2, rows + 0.4), own(toon(theme.island)));
        island.position.set(cx, -1.4, cz);
        const hull = new THREE.Mesh(box(cols + 0.4 + OUTLINE * 2, 2.2, rows + 0.4 + OUTLINE * 2), own(outline(theme.outline)));
        hull.position.copy(island.position);
        root.add(island, hull);

        // Suelo a cuadros; en las parcelas, tierra arada a surcos
        const tiles = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ c, r });
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), own(toon(0xffffff)), tiles.length);
        tiles.forEach(({ c, r }, i) => {
            const soil = this.isPlotTile(c, r) >= 0;
            const col = soil ? theme.soil[r & 1] : theme.floor[(c + r) & 1];
            _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.floorJitter);
            floor.setColorAt(i, _c);
        });
        this.addAnimated(floor, tiles.map(({ c, r }) => ({ x: c + 0.5, y: this.isPlotTile(c, r) >= 0 ? -0.1 : -0.15, z: r + 0.5 })));

        // Bordillo de madera alrededor de cada parcela
        const rims = [];
        for (const p of this.plots) {
            for (const s of [-1, 1]) {
                rims.push({ x: p.x, y: 0.06, z: p.z + s * 1.55, sx: 3.2, sy: 0.12, sz: 0.1 });
                rims.push({ x: p.x + s * 1.55, y: 0.06, z: p.z, sx: 0.1, sy: 0.12, sz: 3.0 });
            }
        }
        this.addHulled(0xb8763a, rims, 0.1);

        // Tallos de trigo y espigas (instanciados: se animan cada frame según el crecimiento)
        const n = PLOT_COUNT * STALKS * STALKS;
        this.stalks = [];
        this.plots.forEach((p, pi) => {
            for (let a = 0; a < STALKS; a++) for (let b = 0; b < STALKS; b++) {
                this.stalks.push({
                    plot: pi,
                    x: p.x - 1.25 + a * 0.5 + (Math.random() - 0.5) * 0.12,
                    z: p.z - 1.25 + b * 0.5 + (Math.random() - 0.5) * 0.12,
                    h: 0.85 + Math.random() * 0.3,
                    ph: Math.random() * 6,
                });
            }
        });
        this.stalkMesh = this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), own(toon(0xffffff)), n));
        this.stalkHull = this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), own(outline(theme.outline)), n));
        this.earMesh = this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), own(toon(CROPS.wheat.ear)), n));
        this.earHull = this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), own(outline(theme.outline)), n));
        for (let i = 0; i < n; i++) this.stalkMesh.setColorAt(i, _c.setHex(CROPS.wheat.stages[0]));

        // Marcadores de "listo": cubo dorado que gira y bota sobre cada parcela madura
        this.markers = this.plots.map((p) => {
            const g = new THREE.Group();
            const m = new THREE.Mesh(box(0.34, 0.34, 0.34), own(toon(0xffe03a)));
            const o = new THREE.Mesh(box(0.44, 0.44, 0.44), own(outline(theme.outline)));
            m.add(o);
            m.rotation.set(0.6, 0, 0.6);
            g.add(m);
            g.position.set(p.x, 2, p.z);
            g.visible = false;
            g.userData.cube = m;
            root.add(g);
            return g;
        });

        // Granero en el centro
        this.barn = new BarnModel(theme.outline);
        this.barn.root.position.set(cx, 0, cz);
        root.add(this.barn.root);

        this.buildTrees(own);
        this.buildFlowers(own);
        this.buildFoam(own);
        this.buildClouds(own);
    }

    dynamic(mesh) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        this.root.add(mesh);
        return mesh;
    }

    // Cajas instanciadas de un color con su contorno, animadas en la entrada
    addHulled(color, pts, delay = 0) {
        const own = (o) => (this.trash.push(o), o);
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), own(toon(color)), pts.length);
        const hull = new THREE.InstancedMesh(box(1, 1, 1), own(outline(this.theme.outline)), pts.length);
        this.addAnimated(mesh, pts, delay);
        this.addAnimated(hull, pts.map((p) => ({ ...p, sx: (p.sx || 1) + OUTLINE * 2, sy: (p.sy || 1) + OUTLINE * 2, sz: (p.sz || 1) + OUTLINE * 2 })), delay);
        return mesh;
    }

    // Árboles voxel en las esquinas y arbustos sueltos
    buildTrees() {
        const trunks = [], leaves = [], spots = [[1.5, 1.5], [15.5, 1.5], [1.5, 15.5], [15.5, 15.5], [8.5, 1.3], [1.3, 8.5], [15.7, 8.5]];
        spots.forEach(([x, z], i) => {
            const big = i < 4;
            const s = big ? 1 : 0.7;
            if (big) trunks.push({ x, y: 0.4, z, sx: 0.32, sy: 0.8, sz: 0.32 });
            leaves.push({ x, y: big ? 1.15 : 0.32, z, sx: 1.1 * s, sy: 0.8 * s, sz: 1.1 * s, ry: i });
            if (big) leaves.push({ x: x + 0.05, y: 1.7, z: z - 0.05, sx: 0.66, sy: 0.5, sz: 0.66, ry: i + 0.5 });
        });
        this.addHulled(0x8a5a34, trunks, 0.3);
        const lm = this.addHulled(0xffffff, leaves, 0.35);
        leaves.forEach((_, i) => lm.setColorAt(i, _c.setHex(this.theme.bush[i % this.theme.bush.length])));
    }

    buildFlowers(own) {
        const pts = [];
        for (let r = 1; r < this.rows - 1; r++) for (let c = 1; c < this.cols - 1; c++) {
            if (this.isPlotTile(c, r) >= 0 || Math.abs(c + 0.5 - this.cx) < 2 && Math.abs(r + 0.5 - this.cz) < 2 || Math.random() > 0.22) continue;
            for (let k = 0; k < 1 + ((Math.random() * 3) | 0); k++) {
                pts.push({ x: c + 0.15 + Math.random() * 0.7, y: 0.04, z: r + 0.15 + Math.random() * 0.7, sx: 0.1, sy: 0.08, sz: 0.1, ry: Math.random() });
            }
        }
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), own(toon(0xffffff)), pts.length);
        pts.forEach((_, i) => mesh.setColorAt(i, _c.setHex(this.theme.flowers[(Math.random() * this.theme.flowers.length) | 0])));
        this.addAnimated(mesh, pts, 0.15);
    }

    buildFoam(own) {
        const { cols, rows } = this, pts = [];
        const add = (x, z) => pts.push({ x, z, ph: Math.random() * 6, s: 0.12 + Math.random() * 0.16 });
        for (let x = -0.4; x <= cols + 0.4; x += 0.45) { add(x, -0.35 - Math.random() * 0.3); add(x, rows + 0.35 + Math.random() * 0.3); }
        for (let z = -0.4; z <= rows + 0.4; z += 0.45) { add(-0.35 - Math.random() * 0.3, z); add(cols + 0.35 + Math.random() * 0.3, z); }
        this.foam = { mesh: this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), own(new THREE.MeshBasicMaterial({ color: this.theme.foam })), pts.length)), pts };
    }

    buildClouds(own) {
        const mat = own(toon(this.theme.clouds)), hullMat = own(outline(this.theme.outline));
        this.clouds = [];
        for (let i = 0; i < 7; i++) {
            const g = new THREE.Group();
            const parts = 3 + (i % 3);
            for (let k = 0; k < parts; k++) {
                const w = 0.9 + Math.random() * 1.2, h = 0.5 + Math.random() * 0.4, d = 0.8 + Math.random() * 0.8;
                const m = new THREE.Mesh(box(1, 1, 1), mat);
                m.scale.set(w, h, d);
                m.position.set(k * 0.8 - parts * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
                const o = new THREE.Mesh(box(1, 1, 1), hullMat);
                o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
                o.position.copy(m.position);
                g.add(m, o);
            }
            const side = i % 2 ? 1 : -1;
            g.position.set(this.cx + side * (this.cols / 2 + 3 + Math.random() * 6), 1.5 + Math.random() * 1.5, Math.random() * this.rows);
            g.userData.speed = 0.2 + Math.random() * 0.3;
            this.root.add(g);
            this.clouds.push(g);
        }
    }

    addAnimated(mesh, positions, extraDelay = 0) {
        mesh.frustumCulled = false;
        const delays = positions.map((p) => Math.hypot(p.x - this.cx, p.z - this.cz) * 0.045 + extraDelay);
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

    // Cosas que salen de una parcela (cuántas parcelas listas, etc.) las decide FarmState;
    // aquí solo se dibujan: progress[i] de 0 a 1 por parcela.
    update(dt, time, progress) {
        if (this.introT < INTRO_TIME + 0.5) {
            this.introT += dt;
            for (const a of this.animated) this.layout(a, this.introT);
        }
        this.barn.update(dt);
        // El granero también cae en la entrada
        const bk = Math.min(1, Math.max(0, (this.introT - 0.05) / 0.5));
        this.barn.root.position.y = -(1 - bk) * 4;
        this.barn.root.scale.setScalar(1.3 * (bk <= 0 ? 0.0001 : easeOutBack(bk)));

        const stages = CROPS.wheat.stages;
        this.stalks.forEach((s, i) => {
            const p = progress[s.plot];
            const ready = p >= 1;
            // Cada tallo brota con un pequeño retraso propio y crece hasta su altura
            const intro = Math.min(1, Math.max(0, (this.introT - 0.5 - Math.hypot(s.x - this.cx, s.z - this.cz) * 0.04) / 0.4));
            const g = (0.12 + 0.88 * Math.min(1, p * 1.05)) * (intro <= 0 ? 0.0001 : easeOutBack(intro));
            const h = s.h * g;
            const sway = ready ? Math.sin(time * 2 + s.ph + s.x * 0.4) * 0.14 : Math.sin(time * 1.4 + s.ph) * 0.05;
            _d.position.set(s.x, h / 2, s.z);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.12, Math.max(0.0001, h), 0.12);
            _d.updateMatrix();
            this.stalkMesh.setMatrixAt(i, _d.matrix);
            _d.scale.set(0.12 + OUTLINE * 2, Math.max(0.0001, h) + OUTLINE * 2, 0.12 + OUTLINE * 2);
            _d.updateMatrix();
            this.stalkHull.setMatrixAt(i, _d.matrix);
            this.stalkMesh.setColorAt(i, _c.setHex(stages[ready ? 3 : p < 0.3 ? 0 : p < 0.65 ? 1 : 2]));
            // Espiga: aparece al final del crecimiento, en la punta (inclinada con el tallo)
            const e = p < 0.65 ? 0.0001 : Math.min(1, (p - 0.65) / 0.35) * (intro <= 0 ? 0.0001 : 1);
            _d.position.set(s.x - Math.sin(sway) * h / 2, h / 2 + Math.cos(sway) * h / 2 + 0.1 * e, s.z);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.2 * e, 0.28 * e, 0.2 * e);
            _d.updateMatrix();
            this.earMesh.setMatrixAt(i, _d.matrix);
            _d.scale.set(0.2 * e + OUTLINE * 2 * e, 0.28 * e + OUTLINE * 2 * e, 0.2 * e + OUTLINE * 2 * e);
            _d.updateMatrix();
            this.earHull.setMatrixAt(i, _d.matrix);
        });
        for (const m of [this.stalkMesh, this.stalkHull, this.earMesh, this.earHull]) m.instanceMatrix.needsUpdate = true;
        this.stalkMesh.instanceColor.needsUpdate = true;

        this.markers.forEach((m, i) => {
            m.visible = progress[i] >= 1 && this.introT > 1.2;
            if (!m.visible) return;
            m.position.y = 1.9 + Math.abs(Math.sin(time * 3 + i)) * 0.35;
            m.userData.cube.rotation.y = time * 2.5 + i;
        });

        const { mesh, pts } = this.foam;
        pts.forEach((p, i) => {
            const s = p.s * (0.8 + Math.sin(time * 3 + p.ph) * 0.35);
            _d.position.set(p.x, -0.78 + Math.sin(time * 2 + p.ph) * 0.05, p.z);
            _d.rotation.set(0, p.ph + time * 0.5, 0);
            _d.scale.set(s * 2, s * 0.5, s * 2);
            _d.updateMatrix();
            mesh.setMatrixAt(i, _d.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        for (const c of this.clouds) {
            c.position.z += c.userData.speed * dt;
            if (c.position.z > this.rows + 8) c.position.z = -8;
        }
    }

    restartIntro() {
        this.introT = 0;
    }
}
