import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { STRUCTURES } from '../render/structures.js';
import { junkyard, barrelParts, JUNK } from '../render/junk.js';
import { CROPS } from '../content/crops.js';
import { FARM } from '../content/farm.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _p = new THREE.Vector3();
const INTRO_TIME = 2.2;
const PER_TILE = 3; // tallos de trigo por lado de cada casilla de campo

// Casillas que ocupa un campo en un nivel (crece desde su esquina fija hacia dx, dz)
function fieldRect(def, level) {
    const { w, d } = def.levels[level], c = def.corner;
    const x = c.dx < 0 ? c.x - w : c.x, z = c.dz < 0 ? c.z - d : c.z;
    return { x, z, w, d, cx: x + w / 2, cz: z + d / 2 };
}
const inRect = (f, x, z, m = 0) => x >= f.x - m && x < f.x + f.w + m && z >= f.z - m && z < f.z + f.d + m;
const kindKey = (k) => (!k ? '' : k.field ? (k.locked ? 'junk' : 'field') : k.path ? 'path' : 'b');

// Mapa de la granja: el sitio de gestión. Césped hasta el horizonte, caminos de tierra, los
// campos de cultivo y edificios que se pueden tocar. Todo se monta en ola al empezar (cae y rebota).
// Un campo bloqueado es un terreno sucio lleno de chatarra con el barril rojo encima del montón.
export class Farm {
    // fields: { id: { level, unlocked } } (el estado guardado de cada campo)
    constructor(theme, fields) {
        this.theme = theme;
        this.size = FARM.size;
        this.cx = this.cz = FARM.size / 2;
        this.animated = [];
        this.root = new THREE.Group();
        this.introT = 0;
        this.clock = 0; // reloj propio para que las plantas nuevas broten al mejorar un campo
        this.decor = []; // entradas animadas que se apartan cuando un campo crece encima
        this.views = FARM.fields.map((def) => {
            const st = fields[def.id];
            return { id: def.id, def, crop: def.crop, level: st.level, locked: !st.unlocked, rect: fieldRect(def, st.level), plants: [], meshes: [] };
        });
        this.fields = Object.fromEntries(this.views.map((v) => [v.id, v]));
        this.build();
    }

    // Lo que hay en una casilla: un campo (bloqueado o no), un camino, un edificio o nada
    kindAt(c, r) {
        for (const v of this.views) if (inRect(v.rect, c, r)) return { field: v.id, locked: v.locked };
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

        // Casillas: hierba, caminos, tierra arada en surcos y tierra sucia de los terrenos abandonados
        const tiles = [];
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) tiles.push({ c, r, k: this.kindAt(c, r) });
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), toon(0xffffff), tiles.length);
        tiles.forEach((t, i) => this.paintTile(floor, t, i));
        this.floor = { tiles, entry: this.addAnimated(floor, tiles.map(({ c, r, k }) => ({ x: c + 0.5, y: this.tileY(k), z: r + 0.5 }))) };

        for (const v of this.views) {
            if (v.locked) this.buildJunk(v);
            else this.buildPlants(v);
        }
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

    tileY(k) {
        return k && k.field ? -0.12 : k && k.path ? -0.17 : -0.15;
    }

    paintTile(mesh, { c, r, k }, i) {
        const { theme } = this;
        const col = k && k.field
            ? (k.locked ? JUNK.ground[(c * 7 + r * 5 + ((c * r) % 3)) % JUNK.ground.length] : theme.soil[r & 1])
            : k && k.path ? theme.path[(c * 7 + r * 3) % 2] : theme.grass[(c * 5 + r * 3 + ((c * r) % 3)) % 3];
        mesh.setColorAt(i, _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter));
    }

    // Vuelve a pintar las casillas que han cambiado (un campo crece o se limpia) y aparta la
    // decoración que queda debajo de los campos
    refreshGround() {
        const { tiles, entry } = this.floor;
        tiles.forEach((t, i) => {
            const k = this.kindAt(t.c, t.r);
            if (kindKey(k) === kindKey(t.k)) return;
            t.k = k;
            entry.positions[i].y = this.tileY(k);
            this.paintTile(entry.mesh, t, i);
        });
        entry.mesh.instanceColor.needsUpdate = true;
        for (const e of this.decor) e.positions.forEach((p) => (p.hide = p.hide || this.views.some((v) => inRect(v.rect, p.x, p.z, 0.4))));
        for (const e of [entry, ...this.decor]) this.layout(e, this.introT);
    }

    // Instante en que brota cada planta: al empezar, en ola desde el centro de la granja; al
    // mejorar, en ola desde el borde del campo viejo (old); al limpiar, desde el centro del campo
    sproutTime(v, x, z, old, fromCenter) {
        if (fromCenter) return this.clock + 0.2 + Math.hypot(x - v.rect.cx, z - v.rect.cz) * 0.12;
        if (!old) return 0.8 + Math.hypot(x - this.cx, z - this.cz) * 0.03;
        const dx = Math.max(0, old.x - x, x - old.x - old.w), dz = Math.max(0, old.z - z, z - old.z - old.d);
        return this.clock + 0.1 + Math.hypot(dx, dz) * 0.12;
    }

    // Plantas del campo v. Se conservan las que ya había (por su sitio) y las nuevas brotan.
    //   Trigo: tallos finos (sin contorno, para que se lean a píxel fino) con su espiga.
    //   Tomate: una mata por casilla con su tutor de madera y dos tomates (verdes hasta madurar).
    buildPlants(v, old = null, fromCenter = false) {
        const f = v.rect, wheat = v.crop === 'wheat', n = wheat ? PER_TILE : 1;
        const prev = new Map(v.plants.map((s) => [s.key, s]));
        v.plants = [];
        for (let a = 0; a < f.w * n; a++) for (let b = 0; b < f.d * n; b++) {
            const key = `${f.x * n + a},${f.z * n + b}`;
            const x = f.x + (a + 0.5) / n, z = f.z + (b + 0.5) / n;
            const keep = prev.get(key);
            if (keep) {
                v.plants.push(keep);
                continue;
            }
            const j = wheat ? 0.12 : 0.2;
            v.plants.push({
                key,
                t0: this.sproutTime(v, x, z, old, fromCenter),
                x: x + (Math.random() - 0.5) * j,
                z: z + (Math.random() - 0.5) * j,
                h: wheat ? 0.75 + Math.random() * 0.3 : 0.85 + Math.random() * 0.25,
                ph: Math.random() * 6,
                tilt: (Math.random() - 0.5) * 0.12,
                ry: Math.random() * Math.PI,
                tone: Math.random(),
            });
        }
        for (const m of v.meshes) {
            this.root.remove(m);
            m.dispose();
        }
        const count = v.plants.length;
        if (!v.mats) v.mats = [toon(0xffffff), toon(0xffffff), toon(0xffffff)];
        if (wheat) {
            // Tallos y espigas. Las espigas no cambian de color: maduras doradas, con dos tonos
            v.meshes = [this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), v.mats[0], count)), this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), v.mats[1], count))];
            v.plants.forEach((s, i) => v.meshes[1].setColorAt(i, _c.setHex(s.tone < 0.5 ? CROPS.wheat.ear : CROPS.wheat.earDark)));
        } else {
            // Hojas (3 bloques por mata), tomates (2) y tutores (1)
            v.meshes = [
                this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), v.mats[0], count * 3)),
                this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), v.mats[1], count * 2)),
                this.dynamic(new THREE.InstancedMesh(box(1, 1, 1), v.mats[2], count)),
            ];
            const T = CROPS.tomato;
            v.plants.forEach((s, i) => {
                for (let k = 0; k < 3; k++) v.meshes[0].setColorAt(i * 3 + k, _c.setHex(T.leaves[(k + i) % 3]).offsetHSL(0, 0, (s.tone - 0.5) * 0.06));
                v.meshes[2].setColorAt(i, _c.setHex(T.stake));
            });
        }
    }

    // Terreno abandonado: chatarra oxidada por todo el campo y el montón con el barril rojo
    buildJunk(v) {
        const f = v.rect;
        const { pieces, barrel } = junkyard({ x0: f.x + 0.3, z0: f.z + 0.3, x1: f.x + f.w - 0.3, z1: f.z + f.d - 0.3, px: f.cx, pz: f.cz, count: Math.round(f.w * f.d * 0.6), s: 0.42 });
        const all = [...pieces, ...barrelParts(barrel)];
        const n0 = this.animated.length;
        const m = this.addHulled(0xffffff, all, 0.3);
        all.forEach((p, i) => m.setColorAt(i, _c.setHex(p.color)));
        v.junk = this.animated.slice(n0); // se quitan al limpiar el terreno
        v.barrelTop = barrel.y + barrel.h;
    }

    // El campo v pasa a otro nivel: la tierra arada se extiende, lo que queda debajo se aparta
    // y las plantas nuevas brotan
    setLevel(id, level) {
        const v = this.fields[id];
        if (level === v.level) return;
        const old = v.rect;
        v.level = level;
        v.rect = fieldRect(v.def, level);
        this.refreshGround();
        if (!v.locked) this.buildPlants(v, old);
    }

    // Terreno limpio (tras la explosión del barril): se quita la chatarra, la tierra queda arada
    // y las plantas brotan desde el centro
    unlock(id) {
        const v = this.fields[id];
        if (!v.locked) return;
        v.locked = false;
        for (const e of v.junk || []) {
            this.animated.splice(this.animated.indexOf(e), 1);
            this.root.remove(e.mesh);
            e.mesh.dispose();
        }
        v.junk = null;
        this.refreshGround();
        this.buildPlants(v, null, true);
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
        spots.push([3, 4], [26, 5], [1.6, 28.6], [27, 13]);
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
            if (this.views.some((v) => inRect(v.rect, x, z, 0.4))) continue; // ni pegado a un campo
            const p = Math.random();
            if (p < 0.08) tufts.push({ x, y: 0.12, z, sx: 0.3, sy: 0.24, sz: 0.3, ry: Math.random() });
            else if (p < 0.2) flowers.push({ x, y: 0.05, z, sx: 0.09, sy: 0.1, sz: 0.09 });
            else if (p < 0.215) rocks.push({ x, y: 0.1, z, sx: 0.4, sy: 0.22, sz: 0.3, ry: Math.random() });
        }
        const n0 = this.animated.length;
        const tm = this.addHulled(0xffffff, tufts, 0.2);
        tufts.forEach((_, i) => tm.setColorAt(i, _c.setHex(this.theme.leaves[i % 3])));
        const fm = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, flowers.length));
        flowers.forEach((_, i) => fm.setColorAt(i, _c.setHex(this.theme.flowers[i % this.theme.flowers.length])));
        this.addAnimated(fm, flowers, 0.2);
        this.addHulled(0xa8a49c, rocks, 0.2);
        this.decor = this.animated.slice(n0);
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
            _d.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
            // Lo apartado (bajo el campo) se encoge del todo: aplanado solo, su contorno quedaría como una mancha
            if (p.hide) _d.scale.setScalar(0.0001);
            else _d.scale.set(p.sx || 1, (p.sy || 1) * s, p.sz || 1);
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
        const v = this.views.find((w) => inRect(w.rect, _p.x, _p.z, 0.2));
        return v ? { field: v.id } : null;
    }

    // progress: { id: crecimiento de 0 a 1 } de cada campo
    update(dt, time, progress) {
        this.clock += dt;
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

        for (const v of this.views) {
            if (v.locked) continue;
            if (v.crop === 'wheat') this.updateWheat(v, time, progress[v.id] || 0);
            else this.updateTomato(v, time, progress[v.id] || 0);
            for (const m of v.meshes) {
                m.instanceMatrix.needsUpdate = true;
                if (m.instanceColor) m.instanceColor.needsUpdate = true;
            }
        }

        for (const c of this.clouds) {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > this.size + 25) c.position.x = -25;
        }
    }

    // Cuánto ha brotado una planta (con rebote) y a qué tamaño va por su crecimiento p
    grow(s, p) {
        const intro = Math.min(1, Math.max(0, (this.clock - s.t0) / 0.4));
        return (0.1 + 0.9 * Math.min(1, p)) * (intro <= 0 ? 0.0001 : easeOutBack(intro));
    }

    updateWheat(v, time, p) {
        const stages = CROPS.wheat.stages, [stalkMesh, earMesh] = v.meshes;
        const ready = p >= 1;
        v.plants.forEach((s, i) => {
            const h = s.h * this.grow(s, p);
            // El viento: una ola que recorre el campo
            const sway = s.tilt + Math.sin(time * 1.6 - s.x * 0.5 - s.z * 0.3 + s.ph * 0.3) * (ready ? 0.12 : 0.06);
            _d.position.set(s.x - Math.sin(sway) * h / 2, Math.cos(sway) * h / 2, s.z);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.05, Math.max(0.0001, h), 0.05);
            _d.updateMatrix();
            stalkMesh.setMatrixAt(i, _d.matrix);
            const st = ready ? 3 : p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
            stalkMesh.setColorAt(i, _c.setHex(stages[st]).offsetHSL(0, 0, (s.tone - 0.5) * 0.08));
            // Espiga: aparece al final del crecimiento, en la punta
            const e = p < 0.7 ? 0.0001 : Math.min(1, (p - 0.7) / 0.3);
            _d.position.set(s.x - Math.sin(sway) * (h + 0.1), Math.cos(sway) * (h + 0.1), s.z);
            _d.scale.set(0.1 * e, 0.24 * e, 0.1 * e);
            _d.updateMatrix();
            earMesh.setMatrixAt(i, _d.matrix);
        });
    }

    // Matas de tomate: tres bloques de hojas, el tutor y dos tomates que salen verdes y se
    // ponen rojos al madurar (entonces se ven bien gordos)
    updateTomato(v, time, p) {
        const T = CROPS.tomato, [leafMesh, fruitMesh, stakeMesh] = v.meshes;
        const ripe = Math.min(1, Math.max(0, (p - 0.6) / 0.4));
        v.plants.forEach((s, i) => {
            const g = this.grow(s, p), h = s.h * g;
            const sway = Math.sin(time * 1.4 - s.x * 0.4 - s.z * 0.3 + s.ph) * 0.04;
            const leaves = [[0.55, 0.32, 0.25], [0.45, 0.28, 0.55], [0.3, 0.22, 0.82]];
            leaves.forEach(([w, lh, y], k) => {
                _d.position.set(s.x + Math.sin(sway) * y * h, y * h, s.z);
                _d.rotation.set(0, s.ry + k * 0.5, sway);
                _d.scale.set(w * g, Math.max(0.0001, lh * g), w * g);
                _d.updateMatrix();
                leafMesh.setMatrixAt(i * 3 + k, _d.matrix);
            });
            _d.position.set(s.x - 0.18, 0.6 * h, s.z - 0.18);
            _d.rotation.set(0, 0, 0);
            _d.scale.set(0.05, Math.max(0.0001, 1.2 * h), 0.05);
            _d.updateMatrix();
            stakeMesh.setMatrixAt(i, _d.matrix);
            // Tomates: aparecen al 40% y engordan al madurar
            const e = p < 0.4 ? 0.0001 : Math.min(1, (p - 0.4) / 0.2) * (0.6 + 0.4 * ripe) * g;
            _c.setHex(T.unripe).lerp(_c2.setHex(s.tone < 0.5 ? T.fruit : T.fruitDark), ripe);
            for (let k = 0; k < 2; k++) {
                const a = s.ry + k * Math.PI, y = (0.38 + k * 0.22) * h;
                _d.position.set(s.x + Math.sin(a) * 0.24 + Math.sin(sway) * y, y, s.z + Math.cos(a) * 0.24);
                _d.rotation.set(0, a, 0);
                _d.scale.setScalar(Math.max(0.0001, 0.26 * e));
                _d.updateMatrix();
                fruitMesh.setMatrixAt(i * 2 + k, _d.matrix);
                fruitMesh.setColorAt(i * 2 + k, _c);
            }
        });
    }

    // Punto en el mundo sobre el centro de un campo (para su cartel y su burbuja)
    fieldTop(id, out = new THREE.Vector3()) {
        const v = this.fields[id], f = v.rect;
        return out.set(f.cx, v.locked ? (v.barrelTop || 1) + 0.6 : 1.4, f.cz);
    }
}
