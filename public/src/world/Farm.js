import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { STRUCTURES, Ufo } from '../render/structures.js';
import { Plot } from '../render/props.js';
import { junkyard, barrelParts, JUNK } from '../render/junk.js';
import { CROPS } from '../content/crops.js';
import { FARM } from '../content/farm.js';
import { UFO } from '../content/ufo.js';

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
// Resto siempre positivo (la parcela de la casa tiene coordenadas negativas)
const mod = (a, n) => ((a % n) + n) % n;
const inParcel = (x, z, m = 0) => FARM.parcels.some(([x0, z0, x1, z1]) => x >= x0 + m && x < x1 - m && z >= z0 + m && z < z1 - m);
const kindKey = (k) => (!k ? '' : k.field ? (k.locked ? 'junk' : 'field') : k.path ? 'path' : k.yard ? 'yard' : k.wild ? 'wild' : 'b');
const rectOf = ([x0, z0, x1, z1]) => ({ x: x0, z: z0, w: x1 - x0, d: z1 - z0 });
// Lo limpio de la parcela de la casa en un nivel (nada en el 0)
const houseClear = (level) => {
    const c = FARM.house.levels[level].clear;
    return c ? rectOf(c) : { x: 0, z: 0, w: 0, d: 0 };
};
const YARD = [0xc4b08a, 0xb8a47e]; // tierra apisonada del recinto del granero

// Tronco y tres pisos de copa por árbol (cajas para addHulled)
function treeParts(spots) {
    const trunks = [], leaves = [];
    spots.forEach(([x, z], i) => {
        const s = 0.8 + Math.random() * 0.6;
        trunks.push({ x, y: 0.5 * s, z, sx: 0.3 * s, sy: 1.0 * s, sz: 0.3 * s });
        leaves.push({ x, y: 1.35 * s, z, sx: 1.5 * s, sy: 0.9 * s, sz: 1.5 * s, ry: i * 0.7, k: 0 });
        leaves.push({ x, y: 2.0 * s, z, sx: 1.05 * s, sy: 0.7 * s, sz: 1.05 * s, ry: i * 0.7 + 0.4, k: 1 });
        leaves.push({ x, y: 2.5 * s, z, sx: 0.55 * s, sy: 0.4 * s, sz: 0.55 * s, ry: i * 0.7, k: 2 });
    });
    return { trunks, leaves };
}

// Mapa de la granja: el sitio de gestión. Césped hasta el horizonte, caminos de tierra, los
// campos de cultivo y edificios que se pueden tocar. Todo se monta en ola al empezar (cae y rebota).
// Un campo bloqueado es un terreno sucio lleno de chatarra con el barril rojo encima del montón.
export class Farm {
    // fields: { id: { level, unlocked } } (el estado guardado de cada campo); barnLevel y
    // houseLevel: niveles del granero y de la casa
    constructor(theme, fields, barnLevel = 0, houseLevel = 0) {
        this.theme = theme;
        this.size = FARM.size;
        const B = FARM.bounds;
        this.cx = (B.x0 + B.x1) / 2;
        this.cz = (B.z0 + B.z1) / 2;
        this.animated = [];
        this.root = new THREE.Group();
        this.introT = 0;
        this.clock = 0; // reloj propio para que las plantas nuevas broten al mejorar un campo
        this.decor = []; // entradas animadas que se apartan cuando un campo crece encima
        this.views = FARM.fields.map((def) => {
            const st = fields[def.id];
            // zone: lo que ocupará al máximo; lo que aún no es campo está abandonado
            return { id: def.id, def, crop: def.crop, level: st.level, locked: !st.unlocked, rect: fieldRect(def, st.level), zone: fieldRect(def, def.levels.length - 1), plants: [], meshes: [] };
        });
        this.fields = Object.fromEntries(this.views.map((v) => [v.id, v]));
        this.barnLevel = barnLevel;
        this.zone = rectOf(FARM.barn.zone);
        this.yard = rectOf(FARM.barn.levels[barnLevel].yard);
        this.houseLevel = houseLevel;
        this.houseZone = rectOf(FARM.house.zone);
        this.houseYard = houseClear(houseLevel);
        this.wild = []; // entradas animadas de la zona abandonada del granero (se apartan al crecer el recinto)
        this.build();
    }

    // Lo que hay en una casilla: un campo (bloqueado o no), un camino, un edificio o nada
    kindAt(c, r) {
        for (const v of this.views) if (inRect(v.rect, c, r)) return { field: v.id, locked: v.locked };
        // Lo que un campo aún no ocupa de su zona: abandonado (se limpia al crecer el campo)
        for (const v of this.views) if (inRect(v.zone, c, r)) return { wild: true };
        for (const [x0, z0, x1, z1] of FARM.paths) if (c >= x0 && c < x1 && r >= z0 && r < z1) return { path: true };
        // La mitad del granero: su recinto (limpio) y lo que queda abandonado alrededor
        if (inRect(this.zone, c, r)) return inRect(this.yard, c, r) ? { yard: true } : { wild: true };
        // La parcela de la casa: lo que aún no se ha limpiado está abandonado
        if (inRect(this.houseZone, c, r) && !inRect(this.houseYard, c, r)) return { wild: true };
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

        // Casillas: hierba, caminos, tierra arada en surcos y tierra sucia de los terrenos
        // abandonados. Las de las parcelas y las de los caminos que salen de ellas
        const tiles = [], B = FARM.bounds;
        const xMax = Math.max(B.x1, ...FARM.paths.map((p) => p[2])), zMax = Math.max(B.z1, ...FARM.paths.map((p) => p[3]));
        for (let r = B.z0; r < zMax; r++) for (let c = B.x0; c < xMax; c++) {
            const k = this.kindAt(c, r);
            if (inParcel(c, r) || (k && k.path)) tiles.push({ c, r, k });
        }
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), toon(0xffffff), tiles.length);
        tiles.forEach((t, i) => this.paintTile(floor, t, i));
        this.floor = { tiles, entry: this.addAnimated(floor, tiles.map(({ c, r, k }) => ({ x: c + 0.5, y: this.tileY(k), z: r + 0.5 }))) };

        for (const v of this.views) {
            if (v.locked) this.buildJunk(v);
            else this.buildPlants(v);
        }
        this.buildFences();
        this.buildTrees();
        this.buildWild();
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
        this.byId.barn.setLevel(this.barnLevel);
        this.byId.house.setLevel(this.houseLevel);
        // Lo comprado en la tienda del ovni para la parcela de la casa, cada cosa en su hueco
        this.plot = new Plot(theme.outline);
        root.add(this.plot.root);
    }

    tileY(k) {
        return k && k.field ? -0.12 : k && k.path ? -0.17 : -0.15;
    }

    paintTile(mesh, { c, r, k }, i) {
        const { theme } = this;
        const col = k && k.field
            ? (k.locked ? JUNK.ground[mod(c * 7 + r * 5 + mod(c * r, 3), JUNK.ground.length)] : theme.soil[r & 1])
            : k && k.path ? theme.path[mod(c * 7 + r * 3, 2)]
            : k && k.wild ? JUNK.ground[mod(c * 5 + r * 7 + mod(c * r, 3), JUNK.ground.length)]
            : k && k.yard ? YARD[mod(c + r, 2)] : theme.grass[mod(c * 5 + r * 3 + mod(c * r, 3), 3)];
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
        for (const e of this.wild) e.positions.forEach((p) => (p.hide = p.hide || this.cleared(p.x, p.z)));
        for (const e of [entry, ...this.decor, ...this.wild]) this.layout(e, this.introT);
    }

    // El granero sube de nivel: el recinto crece (lo abandonado de dentro se aparta y la tierra
    // queda apisonada) y aparecen sus construcciones nuevas
    setBarnLevel(level) {
        if (level === this.barnLevel) return;
        this.barnLevel = level;
        this.yard = rectOf(FARM.barn.levels[level].yard);
        this.refreshGround();
        this.byId.barn.setLevel(level);
        this.byId.barn.select();
    }

    // El ovni: se crea al empezar su cinemática (o ya estrellado al cargar una partida en la
    // que cayó). Volando lo mueve main.js; estrellado queda inclinado y medio hundido, con una
    // mancha de quemado y trozos alrededor
    showUfo() {
        if (this.ufo) return this.ufo;
        this.ufo = new Ufo(this.theme.outline);
        this.ufo.crashed = false;
        this.root.add(this.ufo.root);
        const g = (this.scorch = new THREE.Group());
        g.visible = false;
        const S = UFO.spot;
        for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2 + Math.random() * 0.4, d = 0.6 + Math.random() * 2.2, s = 0.6 + Math.random() * 0.9;
            const m = new THREE.Mesh(box(1, 1, 1), toon(k % 3 ? 0x3a3028 : 0x5a4a38));
            m.scale.set(s, 0.03, s * 0.8);
            m.position.set(S.x + Math.sin(a) * d, 0.02, S.z + Math.cos(a) * d);
            m.rotation.y = a;
            g.add(m);
        }
        // Trozos de chapa del ovni desperdigados
        for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2, d = 2.5 + Math.random() * 1.8;
            const m = new THREE.Mesh(box(1, 1, 1), toon(k % 2 ? 0x9aa8b8 : 0x7a8898));
            m.scale.set(0.5, 0.08, 0.35);
            m.position.set(S.x + Math.sin(a) * d, 0.06, S.z + Math.cos(a) * d);
            m.rotation.set(0.2, a, 0.3);
            g.add(m);
        }
        this.root.add(g);
        return this.ufo;
    }

    crashUfo() {
        const u = this.showUfo(), S = UFO.spot;
        u.crashed = true;
        u.root.position.set(S.x, -0.25, S.z);
        u.root.rotation.set(0.38, 0.6, -0.24);
        this.scorch.visible = true;
    }

    // ¿Ya está limpio este punto? (dentro del recinto del granero o de un campo)
    cleared(x, z) {
        return inRect(this.yard, x, z, 0.6) || inRect(this.houseYard, x, z, 0.4) || this.views.some((v) => inRect(v.rect, x, z, 0.5));
    }

    // La casa sube de nivel: se arregla (del 0 al 1) y se limpia más parcela
    setHouseLevel(level) {
        if (level === this.houseLevel) return;
        this.houseLevel = level;
        this.houseYard = houseClear(level);
        this.refreshGround();
        this.byId.house.setLevel(level);
        this.byId.house.select();
    }

    // Zonas abandonadas (como un terreno con chatarra, pero en grande): la mitad del granero que
    // aún no es recinto y lo que cada campo aún no ocupa de su zona. Árboles a montones,
    // matorral, chatarra y piedras; se apartan cuando el recinto o el campo crecen encima
    buildWild() {
        const trees = [], bush = [], pieces = [], rocks = [];
        const zones = [{ Z: this.zone, k: 1 }, { Z: this.houseZone, k: 0.8 }, ...this.views.map((v) => ({ Z: v.zone, k: 0.55 }))];
        for (const { Z, k } of zones) {
            const free = (x, z, m) => inRect(Z, x, z) && !inRect(this.yard, x, z, m) && !inRect(this.houseYard, x, z, m) && !this.views.some((v) => inRect(v.rect, x, z, m))
                && !FARM.paths.some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)
                && !FARM.structures.some((st) => Math.abs(x - st.x) < st.w / 2 + m && Math.abs(z - st.z) < st.d / 2 + m);
            const spots = (n, m) => {
                const out = [];
                for (let j = 0, tries = 0; j < n && tries < n * 30; tries++) {
                    const x = Z.x + Math.random() * Z.w, z = Z.z + Math.random() * Z.d;
                    if (!free(x, z, m) || out.some(([a, b]) => Math.hypot(a - x, b - z) < m * 1.6)) continue;
                    out.push([x, z]);
                    j++;
                }
                return out;
            };
            // Cantidades según el tamaño de la zona (k: en los campos, algo menos de árbol)
            const area = Z.w * Z.d;
            trees.push(...spots(Math.round(area * 0.18 * k), 0.9));
            bush.push(...spots(Math.round(area * 0.28), 0.45).map(([x, z]) => ({ x, y: 0.22, z, sx: 0.7 + Math.random() * 0.5, sy: 0.44, sz: 0.6 + Math.random() * 0.4, ry: Math.random() * 3 })));
            pieces.push(...junkyard({ x0: Z.x, z0: Z.z, x1: Z.x + Z.w, z1: Z.z + Z.d, px: 9999, pz: 9999, count: Math.round(area * 0.3), s: 0.42, layers: [], inside: (x, z) => free(x, z, 0.4) }).pieces);
            rocks.push(...spots(Math.round(area * 0.08), 0.3).map(([x, z]) => ({ x, y: 0.1, z, sx: 0.45, sy: 0.24, sz: 0.35, ry: Math.random() })));
        }
        const n0 = this.animated.length;
        const { trunks, leaves } = treeParts(trees);
        this.addHulled(0x7a4f2a, trunks, 0.4);
        const lm = this.addHulled(0xffffff, leaves, 0.45);
        leaves.forEach((p, i) => lm.setColorAt(i, _c.setHex(this.theme.leaves[(p.k + i) % 3]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)));
        // Matorral: matas bajas y anchas de hojas oscuras
        const bm = this.addHulled(0xffffff, bush, 0.35);
        bush.forEach((_, i) => bm.setColorAt(i, _c.setHex([0x3d7a2c, 0x4a8a34, 0x5a7a2a][i % 3])));
        const jm = this.addHulled(0xffffff, pieces, 0.35);
        pieces.forEach((p, i) => jm.setColorAt(i, _c.setHex(p.color)));
        this.addHulled(0xa8a49c, rocks, 0.3);
        this.wild = this.animated.slice(n0);
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
    // Vallas de madera: los tramos de FARM.fences, con sus huecos para los caminos
    buildFences() {
        const posts = [], rails = [];
        for (const { from: [x0, z0], to: [x1, z1], gap } of FARM.fences) {
            const alongX = z0 === z1, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
            const at = (a) => (alongX ? [a, z0] : [x0, a]);
            // Trozos sin hueco
            const runs = gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]];
            for (const [r0, r1] of runs) {
                for (let a = r0; a <= r1; a++) {
                    const [x, z] = at(a);
                    posts.push({ x, y: 0.35, z, sx: 0.14, sy: 0.7, sz: 0.14 });
                }
                const [mx, mz] = at((r0 + r1) / 2), len = r1 - r0;
                for (const y of [0.28, 0.55]) rails.push({ x: mx, y, z: mz, sx: alongX ? len : 0.06, sy: 0.08, sz: alongX ? 0.06 : len });
            }
        }
        this.addHulled(0x9a6a3a, posts, 0.3);
        this.addHulled(0xb07a44, rails, 0.35);
    }

    // Árboles: un bosque alrededor de toda la valla (así el borde de lo que se ve no es césped
    // plano), sin tapar los caminos que salen; y algunos dentro de las parcelas
    buildTrees() {
        const spots = [], B = FARM.bounds;
        const onPath = (x, z) => FARM.paths.some(([x0, z0, x1, z1]) => x > x0 - 2.5 && x < x1 + 2.5 && z > z0 - 2.5 && z < z1 + 2.5);
        for (let k = 0, tries = 0; k < 420 && tries < 5000; tries++) {
            const x = B.x0 - 26 + Math.random() * (B.x1 - B.x0 + 52), z = B.z0 - 26 + Math.random() * (B.z1 - B.z0 + 52);
            const out = Math.max(B.x0 - x, x - B.x1, B.z0 - z, z - B.z1); // distancia por fuera de la valla
            if (out < 1.6 || onPath(x, z)) continue;
            // Más tupido cerca de la valla
            if (Math.random() > 1.15 - out / 30) continue;
            spots.push([x, z]);
            k++;
        }
        spots.push([1.6, 28.6]);
        const { trunks, leaves } = treeParts(spots);
        this.addHulled(0x7a4f2a, trunks, 0.4);
        const lm = this.addHulled(0xffffff, leaves, 0.45);
        leaves.forEach((p, i) => lm.setColorAt(i, _c.setHex(this.theme.leaves[(p.k + i) % 3]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)));
    }

    // Matas de hierba alta, flores y piedras sobre el césped libre
    buildDecor() {
        const tufts = [], flowers = [], rocks = [], B = FARM.bounds;
        for (let r = B.z0; r < B.z1; r++) for (let c = B.x0; c < B.x1; c++) {
            if (!inParcel(c, r, 1) || this.kindAt(c, r)) continue;
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
        for (let i = 0; i < 12; i++) {
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
            g.position.set(Math.random() * 50 - 10, 9 + Math.random() * 4, Math.random() * 80 - 40);
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
        if (this.ufo && this.ufo.crashed && ray.intersectObject(this.ufo.root, true).length) return { ufo: true };
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
        if (this.ufo) this.ufo.update(dt, time);
        this.plot.update(dt, time);

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
