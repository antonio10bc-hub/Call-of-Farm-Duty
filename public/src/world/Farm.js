import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { STRUCTURES } from '../render/structures.js';
import { CROPS } from '../content/crops.js';
import { FARM } from '../content/farm.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _p = new THREE.Vector3();
const INTRO_TIME = 2.2;
const PER_TILE = 3; // tallos por lado de cada casilla de campo

// Mapa de la granja: el sitio de gestión. Césped hasta el horizonte, caminos de tierra, campos
// de trigo y edificios que se pueden tocar. Todo se monta en ola al empezar (cae y rebota).
export class Farm {
    constructor(theme) {
        this.theme = theme;
        this.size = FARM.size;
        this.cx = this.cz = FARM.size / 2;
        this.animated = [];
        this.root = new THREE.Group();
        this.introT = 0;
        this.fields = FARM.fields.map((f) => ({ ...f, cx: f.x + f.w / 2, cz: f.z + f.d / 2 }));
        this.build();
    }

    kindAt(c, r) {
        for (let i = 0; i < this.fields.length; i++) {
            const f = this.fields[i];
            if (c >= f.x && c < f.x + f.w && r >= f.z && r < f.z + f.d) return { field: i };
        }
        for (const [x0, z0, x1, z1] of FARM.paths) if (c >= x0 && c < x1 && r >= z0 && r < z1) return { path: true };
        for (const s of FARM.structures) if (Math.abs(c + 0.5 - s.x) < s.w / 2 + 0.3 && Math.abs(r + 0.5 - s.z) < s.d / 2 + 0.3) return { building: true };
        return null;
    }

    build() {
        const { theme, root, size } = this;
        // Césped lejano: un plano enorme bajo todo
        const far = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), toon(theme.grassFar));
        far.rotation.x = -Math.PI / 2;
        far.position.set(this.cx, -0.31, this.cz);
        root.add(far);

        // Casillas: hierba, caminos y tierra arada en surcos
        const tiles = [];
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) tiles.push({ c, r, k: this.kindAt(c, r) });
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), toon(0xffffff), tiles.length);
        tiles.forEach(({ c, r, k }, i) => {
            const col = k && k.field !== undefined ? theme.soil[r & 1] : k && k.path ? theme.path[(c * 7 + r * 3) % 2] : theme.grass[(c * 5 + r * 3 + ((c * r) % 3)) % 3];
            floor.setColorAt(i, _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter));
        });
        this.addAnimated(floor, tiles.map(({ c, r, k }) => ({ x: c + 0.5, y: k && k.field !== undefined ? -0.12 : k && k.path ? -0.17 : -0.15, z: r + 0.5 })));

        this.buildWheat();
        this.buildFences();
        this.buildTrees();
        this.buildDecor();
        this.buildClouds();

        // Edificios
        this.structures = FARM.structures.map((s) => {
            const model = new STRUCTURES[s.kind](theme.outline);
            model.root.position.set(s.x, 0, s.z);
            model.root.rotation.y = (s.ry || 0) * (Math.PI / 2);
            model.def = s;
            model.base = { y: 0 };
            model.root.traverse((o) => (o.userData.structure = s.id));
            root.add(model.root);
            return model;
        });
        this.byId = Object.fromEntries(this.structures.map((m) => [m.def.id, m]));
    }

    // Trigo: tallos finos (sin contorno, para que se lean a píxel fino) con su espiga
    buildWheat() {
        this.stalks = [];
        this.fields.forEach((f, fi) => {
            const n = PER_TILE;
            for (let a = 0; a < f.w * n; a++) for (let b = 0; b < f.d * n; b++) {
                this.stalks.push({
                    field: fi,
                    x: f.x + (a + 0.5) / n + (Math.random() - 0.5) * 0.12,
                    z: f.z + (b + 0.5) / n + (Math.random() - 0.5) * 0.12,
                    h: 0.75 + Math.random() * 0.3,
                    ph: Math.random() * 6,
                    tilt: (Math.random() - 0.5) * 0.12,
                    tone: Math.random(),
                });
            }
        });
        const n = this.stalks.length;
        this.stalkMesh = this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), n));
        this.earMesh = this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), n));
        // Las espigas no cambian de color: maduras doradas, con dos tonos
        this.stalks.forEach((s, i) => this.earMesh.setColorAt(i, _c.setHex(s.tone < 0.5 ? CROPS.wheat.ear : CROPS.wheat.earDark)));
    }

    // Valla de madera alrededor de toda la granja
    buildFences() {
        const posts = [], rails = [], S = this.size;
        for (let i = 0; i <= S; i++) {
            for (const [x, z] of [[i, 0], [i, S], [0, i], [S, i]]) {
                if (x >= 14 && x <= 16 && z === S) continue; // entrada del camino
                posts.push({ x, y: 0.35, z, sx: 0.14, sy: 0.7, sz: 0.14 });
            }
        }
        for (const y of [0.28, 0.55]) {
            rails.push({ x: S / 2, y, z: 0, sx: S, sy: 0.08, sz: 0.06 });
            rails.push({ x: 0, y, z: S / 2, sx: 0.06, sy: 0.08, sz: S });
            rails.push({ x: S, y, z: S / 2, sx: 0.06, sy: 0.08, sz: S });
            rails.push({ x: 7, y, z: S, sx: 14, sy: 0.08, sz: 0.06 });
            rails.push({ x: 23, y, z: S, sx: 14, sy: 0.08, sz: 0.06 });
        }
        this.addHulled(0x9a6a3a, posts, 0.3);
        this.addHulled(0xb07a44, rails, 0.35);
    }

    // Árboles fuera de la valla y alguno dentro
    buildTrees() {
        const spots = [];
        for (let k = 0; k < 70; k++) {
            const a = Math.random() * Math.PI * 2, d = this.size * 0.62 + Math.random() * 10;
            spots.push([this.cx + Math.sin(a) * d * (1 + Math.random() * 0.1), this.cz + Math.cos(a) * d]);
        }
        spots.push([3, 4], [26, 5], [25, 27], [2, 27], [27, 13]);
        const trunks = [], leaves = [];
        spots.forEach(([x, z], i) => {
            const s = 0.8 + Math.random() * 0.6;
            trunks.push({ x, y: 0.5 * s, z, sx: 0.3 * s, sy: 1.0 * s, sz: 0.3 * s });
            leaves.push({ x, y: 1.35 * s, z, sx: 1.5 * s, sy: 0.9 * s, sz: 1.5 * s, ry: i * 0.7, k: 0 });
            leaves.push({ x, y: 2.0 * s, z, sx: 1.05 * s, sy: 0.7 * s, sz: 1.05 * s, ry: i * 0.7 + 0.4, k: 1 });
            leaves.push({ x, y: 2.5 * s, z, sx: 0.55 * s, sy: 0.4 * s, sz: 0.55 * s, ry: i * 0.7, k: 2 });
        });
        this.addHulled(0x7a4f2a, trunks, 0.4);
        const lm = this.addHulled(0xffffff, leaves, 0.45);
        leaves.forEach((p, i) => lm.setColorAt(i, _c.setHex(this.theme.leaves[(p.k + i) % 3]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)));
    }

    // Matas de hierba alta, flores y piedras sobre el césped libre
    buildDecor() {
        const tufts = [], flowers = [], rocks = [];
        for (let r = 1; r < this.size - 1; r++) for (let c = 1; c < this.size - 1; c++) {
            if (this.kindAt(c, r)) continue;
            const x = c + Math.random(), z = r + Math.random();
            const p = Math.random();
            if (p < 0.08) tufts.push({ x, y: 0.12, z, sx: 0.3, sy: 0.24, sz: 0.3, ry: Math.random() });
            else if (p < 0.2) flowers.push({ x, y: 0.05, z, sx: 0.09, sy: 0.1, sz: 0.09 });
            else if (p < 0.215) rocks.push({ x, y: 0.1, z, sx: 0.4, sy: 0.22, sz: 0.3, ry: Math.random() });
        }
        const tm = this.addHulled(0xffffff, tufts, 0.2);
        tufts.forEach((_, i) => tm.setColorAt(i, _c.setHex(this.theme.leaves[i % 3])));
        const fm = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, flowers.length));
        flowers.forEach((_, i) => fm.setColorAt(i, _c.setHex(this.theme.flowers[i % this.theme.flowers.length])));
        this.addAnimated(fm, flowers, 0.2);
        this.addHulled(0xa8a49c, rocks, 0.2);
    }

    buildClouds() {
        const mat = toon(this.theme.clouds), hullMat = outline(this.theme.outline);
        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            const g = new THREE.Group();
            const parts = 3 + (i % 3);
            for (let k = 0; k < parts; k++) {
                const w = 1.6 + Math.random() * 1.6, h = 0.6 + Math.random() * 0.4, d = 1.2 + Math.random();
                const m = new THREE.Mesh(box(1, 1, 1), mat);
                m.scale.set(w, h, d);
                m.position.set(k * 1.1 - parts * 0.55, Math.random() * 0.3, (Math.random() - 0.5) * 0.8);
                const o = new THREE.Mesh(box(1, 1, 1), hullMat);
                o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
                o.position.copy(m.position);
                g.add(m, o);
            }
            g.position.set(Math.random() * 50 - 10, 9 + Math.random() * 4, Math.random() * 50 - 10);
            g.userData.speed = 0.3 + Math.random() * 0.3;
            this.root.add(g);
            this.clouds.push(g);
        }
    }

    dynamic(mesh) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        this.root.add(mesh);
        return mesh;
    }

    addHulled(color, pts, delay = 0) {
        const n = Math.max(1, pts.length);
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), toon(color), n);
        const hull = new THREE.InstancedMesh(box(1, 1, 1), outline(this.theme.outline), n);
        this.addAnimated(mesh, pts, delay);
        this.addAnimated(hull, pts.map((p) => ({ ...p, sx: (p.sx || 1) + OUTLINE * 2, sy: (p.sy || 1) + OUTLINE * 2, sz: (p.sz || 1) + OUTLINE * 2 })), delay);
        return mesh;
    }

    addAnimated(mesh, positions, extraDelay = 0) {
        mesh.frustumCulled = false;
        mesh.count = positions.length;
        const delays = positions.map((p) => Math.min(1.4, Math.hypot(p.x - this.cx, p.z - this.cz) * 0.035) + extraDelay);
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

    // Lo que hay bajo un rayo de la cámara: un edificio, un campo o nada
    pick(ray) {
        const hits = ray.intersectObjects(this.structures.map((m) => m.root), true);
        if (hits.length) return { structure: hits[0].object.userData.structure };
        const t = -ray.ray.origin.y / ray.ray.direction.y;
        if (!(t > 0)) return null;
        ray.ray.at(t, _p);
        const i = this.fields.findIndex((f) => _p.x >= f.x - 0.2 && _p.x <= f.x + f.w + 0.2 && _p.z >= f.z - 0.2 && _p.z <= f.z + f.d + 0.2);
        return i >= 0 ? { field: i } : null;
    }

    // progress[i]: crecimiento de cada campo de 0 a 1
    update(dt, time, progress) {
        if (this.introT < INTRO_TIME + 0.5) {
            this.introT += dt;
            for (const a of this.animated) this.layout(a, this.introT);
        }
        // Los edificios caen del cielo, cada uno a su tiempo
        this.structures.forEach((m, i) => {
            const k = Math.min(1, Math.max(0, (this.introT - 0.5 - i * 0.12) / 0.5));
            m.root.position.y = (1 - k * k) * 8;
            if (k < 1) m.root.scale.setScalar(k <= 0 ? 0.0001 : 1);
            else if (!m.landed) {
                m.landed = true;
                m.root.scale.setScalar(1);
                m.select();
                if (this.onLand) this.onLand(m);
            }
            m.update(dt, time);
        });

        const stages = CROPS.wheat.stages;
        this.stalks.forEach((s, i) => {
            const p = progress[s.field];
            const ready = p >= 1;
            const intro = Math.min(1, Math.max(0, (this.introT - 0.8 - Math.hypot(s.x - this.cx, s.z - this.cz) * 0.03) / 0.4));
            const g = (0.1 + 0.9 * Math.min(1, p)) * (intro <= 0 ? 0.0001 : easeOutBack(intro));
            const h = s.h * g;
            // El viento: una ola que recorre el campo
            const sway = s.tilt + Math.sin(time * 1.6 - s.x * 0.5 - s.z * 0.3 + s.ph * 0.3) * (ready ? 0.12 : 0.06);
            _d.position.set(s.x - Math.sin(sway) * h / 2, Math.cos(sway) * h / 2, s.z);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.05, Math.max(0.0001, h), 0.05);
            _d.updateMatrix();
            this.stalkMesh.setMatrixAt(i, _d.matrix);
            const st = ready ? 3 : p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
            this.stalkMesh.setColorAt(i, _c.setHex(stages[st]).offsetHSL(0, 0, (s.tone - 0.5) * 0.08));
            // Espiga: aparece al final del crecimiento, en la punta
            const e = p < 0.7 ? 0.0001 : Math.min(1, (p - 0.7) / 0.3);
            _d.position.set(s.x - Math.sin(sway) * (h + 0.1), Math.cos(sway) * (h + 0.1), s.z);
            _d.scale.set(0.1 * e, 0.24 * e, 0.1 * e);
            _d.updateMatrix();
            this.earMesh.setMatrixAt(i, _d.matrix);
        });
        this.stalkMesh.instanceMatrix.needsUpdate = true;
        this.stalkMesh.instanceColor.needsUpdate = true;
        this.earMesh.instanceMatrix.needsUpdate = true;

        for (const c of this.clouds) {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > this.size + 25) c.position.x = -25;
        }
    }

    // Punto en el mundo sobre el centro de un campo (para su burbuja de RECOGER)
    fieldTop(i, out = new THREE.Vector3()) {
        const f = this.fields[i];
        return out.set(f.cx, 1.4, f.cz);
    }
}
