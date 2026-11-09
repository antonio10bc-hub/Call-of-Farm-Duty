import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { buildScenery, updateScenery, onPathWorld } from './Scenery.js';
import { G, GN, cellX, cellZ } from './valley.js';
import { easeOutBack } from '../core/math.js';
import { STRUCTURES, Turret, Sandbags, LandPost } from '../render/structures.js';
import { Plot } from '../render/props.js';
import { MerchantCamp } from '../render/merchant.js';
import { Compound } from '../render/compound.js';
import { Life } from './Life.js';
import { Extras } from './Extras.js';
import { MERCHANT } from '../content/merchant.js';
import { junkyard, barrelParts, JUNK } from '../render/junk.js';
import { CROPS } from '../content/crops.js';
import { buildCow, animateCow } from '../render/cow.js';
import { buildSheep, animateSheep } from '../render/sheep.js';
import { FARM, TURRETS, PLACES, toWorld, worldToPlace, inShapeOf, inFieldShape, stretchLocal, floorPlace } from '../content/farm.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _p = new THREE.Vector3();
const INTRO_TIME = 2.2;
const PER_TILE = 2; // tallos de trigo por lado de cada casilla de campo (los campos llenan su zona: no muy tupido)

// Casillas que ocupa un campo en un nivel (crece desde su esquina fija hacia dx, dz)
function fieldRect(def, level) {
    const { w, d } = def.levels[level], c = def.corner;
    // (center: crece desde su centro, hacia todos los lados)
    const x = c.center ? Math.round(c.x - w / 2) : c.dx < 0 ? c.x - w : c.x, z = c.center ? Math.round(c.z - d / 2) : c.dz < 0 ? c.z - d : c.z;
    return { x, z, w, d, cx: x + w / 2, cz: z + d / 2 };
}
const inRect = (f, x, z, m = 0) => x >= f.x - m && x < f.x + f.w + m && z >= f.z - m && z < f.z + f.d + m;
// Resto siempre positivo (la parcela de la casa tiene coordenadas negativas)
const mod = (a, n) => ((a % n) + n) % n;
const inParcel = (x, z, m = 0) => [...FARM.parcels, ...FARM.lands.map((l) => l.rect)].some(([x0, z0, x1, z1]) => x >= x0 + m && x < x1 - m && z >= z0 + m && z < z1 - m);
const kindKey = (k) => (!k ? '' : k.field ? (k.locked ? 'junk' : 'field') : k.path ? 'path' : k.strip ? 'strip' : k.pad ? `pad${k.pad}` : k.yard ? 'yard' : k.forest ? 'forest' : k.wild ? 'wild' : 'b');
const FOREST = [0x4f8a36, 0x5a9a3e, 0x4a7a32, 0x5f8a3a, 0x6a7a3a, 0x56703a]; // suelo de bosque: hierba oscura y tierra
const ASPHALT = [0x5c5c62, 0x56565c], CONCRETE = [0x9a948c, 0x8f8a82];
const CRATER = [0x6a4a2a, 0x5a3e24, 0x7a5432, 0x4a3420]; // el fondo del cráter del ovni
const STRAW = [0x9a7a3a, 0x8a6a30, 0xa8843e, 0x94723a];
const CLEARING = [0x8fbf54, 0x9ab85a, 0xa8a060, 0xb89a64, 0x86b04e]; // el claro del mercader
const rectOf = ([x0, z0, x1, z1]) => ({ x: x0, z: z0, w: x1 - x0, d: z1 - z0 });
const PASTURE = [0xa8e070, 0x9ad962, 0xb4e67a]; // hierba fresca del prado de las vacas
// La parcela en venta en la que cae un punto (o ninguna)
const landAt = (x, z) => FARM.lands.find(({ rect: [x0, z0, x1, z1] }) => x >= x0 && x < x1 && z >= z0 && z < z1);
// Parcela sin comprar: todo más oscuro y frío, como en sombra (se multiplica por esto)
const SHADE = [0.62, 0.66, 0.78];
const WAVE = 18; // m/s a los que se retira la sombra al comprarla
// Lo limpio de la parcela de la casa en un nivel (nada en el 0)
const houseClear = (level) => {
    const c = FARM.house.levels[level].clear;
    return c ? rectOf(c) : { x: 0, z: 0, w: 0, d: 0 };
};
const YARD = [0xc4b08a, 0xb8a47e]; // tierra apisonada del recinto del granero
// Trozos del valle de 64×64 casillas: cada malla grande del paisaje se parte así para que lo que
// queda fuera de cámara no se dibuje
const CHUNK = 64;
const chunkKey = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
// Dónde está en el mundo una entrada animada [x, y, z] (las de una parcela, ya colocadas por layout)
const worldOf = (p) => (p.world ? [p.x, p.y, p.z] : p._w ? [p._w[0], p._w[1] + p.y, p._w[2]] : [p.x, p.y, p.z]);

// Tronco y tres pisos de copa por árbol (cajas para addHulled)
function treeParts(spots, world = false) {
    const trunks = [], leaves = [];
    spots.forEach(([x, z, g = 0, s0], i) => {
        const s = s0 || 0.8 + Math.random() * 0.6;
        trunks.push({ x, y: g + 0.5 * s, z, sx: 0.3 * s, sy: 1.0 * s, sz: 0.3 * s, world });
        leaves.push({ x, y: g + 1.35 * s, z, sx: 1.5 * s, sy: 0.9 * s, sz: 1.5 * s, ry: i * 0.7, k: 0, world });
        leaves.push({ x, y: g + 2.0 * s, z, sx: 1.05 * s, sy: 0.7 * s, sz: 1.05 * s, ry: i * 0.7 + 0.4, k: 1, world });
        leaves.push({ x, y: g + 2.5 * s, z, sx: 0.55 * s, sy: 0.4 * s, sz: 0.55 * s, ry: i * 0.7, k: 2, world });
    });
    return { trunks, leaves };
}

// Mapa de la granja: el sitio de gestión. Césped hasta el horizonte, caminos de tierra, los
// campos de cultivo y edificios que se pueden tocar. Todo se monta en ola al empezar (cae y rebota).
// Un campo bloqueado es un terreno sucio lleno de chatarra con el barril rojo encima del montón.
export class Farm {
    // fields: { id: { level, unlocked } } (el estado guardado de cada campo); barnLevel y
    // houseLevel: niveles del granero y de la casa; lands: parcelas en venta ya compradas
    constructor(theme, fields, barnLevel = 0, houseLevel = 0, lands = {}) {
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
        // El bosque del comerciante y su claro (el del surco del ovni)
        this.villageZone = rectOf(MERCHANT.site.zone);
        this.villageYard = rectOf(MERCHANT.site.clear);
        this.wild = []; // entradas animadas de la zona abandonada del granero (se apartan al crecer el recinto)
        this.shots = []; // trazadas de las balas de la torreta automática
        this.landOwned = Object.fromEntries(FARM.lands.map((l) => [l.id, !!lands[l.id]]));
        this.landWave = {}; // parcela recién comprada: la onda que retira su sombra { t, x, z }
        // Cada parcela, en su sitio del mapa: un grupo desplazado y a su altura (lo de dentro, en
        // sus coordenadas de siempre)
        this.places = Object.fromEntries(PLACES.map((P) => {
            const g = new THREE.Group(), a = (P.rot || 0) * (Math.PI / 2), c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
            const lx = P.from[0] + 15, lz = P.from[1] + 15; // su centro, girado sobre sí mismo
            g.rotation.y = a;
            g.position.set(P.at[0] + 15 - (lx * c + lz * s), P.h, P.at[1] + 15 - (-lx * s + lz * c));
            this.root.add(g);
            return [P.id, g];
        }));
        this.build();
        for (const v of this.views) if (fields[v.id].turrets) this.setTurrets(v.id, false);
    }

    // Lo que hay en una casilla: un campo (bloqueado o no), un camino, un edificio o nada
    kindAt(c, r) {
        // (fuera de la forma de su parcela, nada: ahí está el borde de hierba)
        if (!inShapeOf(c + 0.5, r + 0.5)) return null;
        // Un campo: su forma, no su rectángulo (lo que sobra del rectángulo, hierba; sin limpiar, abandonado)
        for (const v of this.views) {
            if (!inRect(v.rect, c, r)) continue;
            if (this.inField(v, c + 0.5, r + 0.5)) return { field: v.id, locked: v.locked };
            return v.locked ? { wild: true } : null;
        }
        // Lo que un campo aún no ocupa de su zona: abandonado (se limpia al crecer el campo)
        for (const v of this.views) if (inRect(v.zone, c, r)) return { wild: true };
        for (const [x0, z0, x1, z1] of FARM.paths) if (c >= x0 && c < x1 && r >= z0 && r < z1) return { path: true };
        // El recinto del granero: la pista, las plataformas de hormigón y el resto, tierra apisonada
        if (inRect(this.zone, c, r)) {
            if (inRect(rectOf(FARM.barn.strip), c, r)) return { strip: true };
            const pad = FARM.barn.pads.findIndex((p) => inRect(rectOf(p), c, r));
            if (pad >= 0) return { pad: pad + 1 };
            return inRect(this.yard, c, r) ? { yard: true } : { wild: true };
        }
        // La parcela de la casa: lo que aún no se ha limpiado está abandonado
        if (inRect(this.houseZone, c, r) && !inRect(this.houseYard, c, r)) return { wild: true };
        // El bosque del comerciante: su claro (de borde irregular, a lo largo del surco y alrededor
        // de su puesto) y el resto, suelo de bosque
        if (inRect(this.villageZone, c, r)) return this.inClearing(c + 0.5, r + 0.5) ? { yard: true, clearing: true } : { wild: true, forest: true };
        // Las parcelas en venta: abandonadas hasta que se desbloquea su campo
        for (const l of FARM.lands) if (inRect(rectOf(l.rect), c, r)) return !l.field || this.fields[l.field].locked ? { wild: true } : null;
        for (const s of FARM.structures) if (Math.abs(c + 0.5 - s.x) < s.w / 2 + 0.3 && Math.abs(r + 0.5 - s.z) < s.d / 2 + 0.3) return { building: true };
        return null;
    }

    build() {
        const { theme, root, size } = this;
        // Césped lejano: un plano enorme bajo todo
        const far = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), toon(theme.grassFar));
        far.rotation.x = -Math.PI / 2;
        far.position.set(this.cx, -0.31, this.cz);
        root.add(far);

        this.buildFloor();

        for (const v of this.views) {
            if (v.locked) this.buildJunk(v);
            else this.buildPlants(v);
        }
        this.groves = buildScenery(this);
        this.buildTrees();
        this.pickHints();
        this.buildWild();
        this.buildHints();
        this.buildDecor();
        this.buildClouds();

        // Edificios
        this.structures = FARM.structures.map((s) => {
            const model = new STRUCTURES[s.kind](theme.outline);
            const at = stretchLocal(s.x, s.z);
            model.root.position.set(at.x, 0, at.z);
            model.root.rotation.y = (s.ry || 0) * (Math.PI / 2);
            model.def = s;
            model.base = { y: 0 };
            model.root.traverse((o) => (o.userData.structure = s.id));
            this.groupAt(s.x, s.z).add(model.root);
            return model;
        });
        this.byId = Object.fromEntries(this.structures.map((m) => [m.def.id, m]));
        this.byId.barn.setLevel(this.barnLevel);
        this.byId.house.setLevel(this.houseLevel);
        // Lo comprado en la tienda del ovni para la parcela de la casa, cada cosa en su hueco
        this.plot = new Plot(theme.outline);
        this.places.house.add(this.plot.root);
        // El claro del comerciante: el surco del aterrizaje y su ovni disfrazado de coche
        this.camp = new MerchantCamp(theme.outline);
        this.camp.root.traverse((o) => (o.userData.merchant = true));
        this.places.merchant.add(this.camp.root);
        // El recinto del granero: cada pieza en su sitio, repartidas por toda su zona (tocar
        // cualquiera abre el armamento, como el granero)
        // (compoundOn: sin el granero abierto no se ve; pieces: cada pieza, para que aparezcan
        // con magia al abrirlo)
        this.compound = new Compound(theme.outline);
        this.compoundOn = true;
        this.compoundPieces = FARM.compound.map((c) => {
            const g = this.compound.piece(c.kind), at = stretchLocal(c.x, c.z);
            g.position.set(at.x, 0, at.z);
            g.rotation.y = (c.ry || 0) * (Math.PI / 2);
            return { g, x: c.x, z: c.z, y: 0, ry: g.rotation.y };
        });
        this.compound.root.traverse((o) => (o.userData.structure = 'barn'));
        this.compound.root.visible = false;
        this.places.farm.add(this.compound.root);
        // De noche, en el recinto: las luces de la pista y dos focos que barren
        const [sx0, sz0, sx1, sz1] = FARM.barn.strip, lights = [];
        for (let x = sx0 + 0.5; x < sx1; x += 1.6) for (const z of [sz0 + 0.2, sz1 - 0.2]) lights.push(stretchLocal(x, z));
        this.runwayMat = new THREE.MeshBasicMaterial({ color: 0x6a5a3a });
        const rl = new THREE.InstancedMesh(box(0.3, 0.16, 0.3), this.runwayMat, lights.length);
        lights.forEach((p, i) => rl.setMatrixAt(i, _d.matrix.makeTranslation(p.x, 0.1, p.z)));
        this.compound.root.add(rl);
        // Los focos: una torreta con su poste, su plataforma y el foco arriba, que gira con el haz
        // (el haz sale de su lente, hacia delante y hacia abajo; solo de noche)
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
        this.lensMat = new THREE.MeshBasicMaterial({ color: 0x8a8670 });
        const part = (g, w, h, d, c, x, y, z) => {
            const m = new THREE.Mesh(box(w, h, d), typeof c === 'number' ? toon(c) : c);
            m.position.set(x, y, z);
            g.add(m);
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), outline(theme.outline));
            o.position.copy(m.position);
            g.add(o);
            return m;
        };
        this.searchlights = [[3, 18, 4.2], [27, 18, 4.2]].map(([x, z, H], i) => {
            const at = stretchLocal(x, z), tower = new THREE.Group();
            tower.position.set(at.x, 0, at.z);
            this.compound.root.add(tower);
            for (const [a, b] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) part(tower, 0.12, H, 0.12, 0x3a3030, a, H / 2, b);
            part(tower, 1.3, 0.14, 1.3, 0x7a6a5a, 0, H, 0);
            part(tower, 0.3, 0.5, 0.3, 0x3a3030, 0, H + 0.3, 0);
            const head = new THREE.Group();
            head.position.set(0, H + 0.75, 0);
            tower.add(head);
            const tilt = new THREE.Group();
            tilt.rotation.x = 0.32; // (mirando un poco hacia abajo)
            head.add(tilt);
            part(tilt, 0.7, 0.6, 0.8, 0x4a4a52, 0, 0, 0);
            const lens = new THREE.Mesh(box(0.56, 0.46, 0.06), this.lensMat);
            lens.position.set(0, 0, -0.42);
            tilt.add(lens);
            const beam = new THREE.Mesh(box(0.6, 0.5, 16), beamMat);
            beam.position.set(0, 0, -8.45);
            beam.scale.set(1, 1, 1);
            tilt.add(beam);
            beam.visible = false;
            head.userData = { k: i, beam };
            return head;
        });
        // La vida del agua: patos (uno con lacito), peces que saltan y el molino
        this.life = new Life(theme.outline);
        root.add(this.life.root);
        // Parcelas en venta: su poste de SE VENDE (o tu bandera) y su sombra
        this.landPosts = Object.fromEntries(FARM.lands.map((l) => {
            const post = new LandPost(theme.outline, !!l.soon);
            const at = stretchLocal(l.post.x, l.post.z);
            post.root.position.set(at.x, 0, at.z);
            // (de cara hacia fuera de su parcela)
            post.root.rotation.y = Math.atan2(l.post.x - (l.rect[0] + l.rect[2]) / 2, l.post.z - (l.rect[1] + l.rect[3]) / 2);
            post.setOwned(this.landOwned[l.id], false);
            this.groupAt(l.post.x + (l.post.x < 0 ? 0.5 : -0.5), l.post.z).add(post.root);
            return [l.id, post];
        }));
        // Lo grande (el paisaje, el bosque y la maleza), en trozos: lo que queda fuera de cámara no se
        // dibuja. Las listas que guardan sus entradas (lo abandonado, la decoración...) se quedan
        // con los trozos
        const big = (e) => e.positions.length > 600 && !this.floor.entries.includes(e);
        for (const key of ['wild', 'decor', 'hints']) if (this[key]) this[key] = this[key].flatMap((e) => (big(e) ? this.chunkify(e) : [e]));
        for (const e of [...this.animated]) if (big(e) && e.positions.every((p) => p.world)) this.chunkify(e);
        this.initShade();
    }

    // Casillas: hierba, caminos, tierra arada en surcos y tierra sucia de los terrenos abandonados.
    // Cada casilla de la zona de una parcela (en el mundo), con lo que le toca de su cuadrado
    // estirado (c, r: la casilla de sus coordenadas de siempre). Donde las cuatro casillas de una
    // celda de 2×2 son lo mismo (y no campo ni camino), una sola pieza: menos cubos. Se rehace
    // entera cuando algo cambia (un campo crece, se limpia la casa...)
    buildFloor() {
        const old = this.floor, tiles = [];
        for (let k = 0; k < GN * GN; k++) {
            if (!G.inside[k] || G.water[k] || G.reg[k] < 0) continue;
            const P = floorPlace(cellX(k), cellZ(k));
            if (!P) continue;
            const sub = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([a, b]) => {
                const wx = cellX(k) + a, wz = cellZ(k) + b, l = worldToPlace(P, wx, wz);
                const c = Math.min(P.from[0] + 29, Math.max(P.from[0], Math.floor(l.x))), r = Math.min(P.from[1] + 29, Math.max(P.from[1], Math.floor(l.z)));
                return { c, r, k: this.kindAt(c, r), wx, wz, h: P.h, s: 1 };
            });
            const key = kindKey(sub[0].k);
            if (key !== 'field' && key !== 'path' && sub.every((t) => kindKey(t.k) === key)) tiles.push({ ...sub[0], wx: cellX(k), wz: cellZ(k), s: 2, subs: sub.map((t) => [t.c, t.r]) });
            else tiles.push(...sub);
        }
        for (const t of tiles) {
            const l = landAt(t.c + 0.5, t.r + 0.5);
            t.land = l ? l.id : null;
        }
        // En trozos del valle (lo que queda fuera de cámara no se dibuja); cada casilla sabe en qué
        // malla está (t.mesh) y en qué sitio (t.i)
        this.floor = { tiles, entries: [] };
        const mat = toon(0xffffff), groups = new Map();
        for (const t of tiles) {
            const key = chunkKey(t.wx, t.wz);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(t);
        }
        for (const list of groups.values()) {
            const mesh = new THREE.InstancedMesh(box(1, 0.3, 1), mat, list.length);
            list.forEach((t, i) => {
                t.mesh = mesh;
                t.i = i;
                this.paintTile(mesh, t, i);
            });
            const e = this.addAnimated(mesh, list.map((t) => ({ x: t.wx, y: t.h + this.tileY(t.k), z: t.wz, sx: t.s, sz: t.s, world: true })));
            this.cullable(e);
            this.floor.entries.push(e);
            if (old) this.layout(e, this.introT);
        }
        if (old) {
            this.animated = this.animated.filter((e) => !old.entries.includes(e));
            for (const e of old.entries) {
                e.mesh.removeFromParent();
                e.mesh.dispose();
            }
        }
    }

    // Que la cámara pueda saltarse una malla de trozos fuera de su vista: su esfera, con margen
    // para la caída y el bote de la entrada
    cullable(e) {
        const m = e.mesh, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        let big = 0;
        for (const p of e.positions) {
            const v = worldOf(p);
            for (let a = 0; a < 3; a++) {
                lo[a] = Math.min(lo[a], v[a]);
                hi[a] = Math.max(hi[a], v[a]);
            }
            big = Math.max(big, p.sx || 1, p.sy || 1, p.sz || 1);
        }
        lo[1] -= 3;
        const c = new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
        m.boundingSphere = new THREE.Sphere(c, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 + big * 1.3 + 1);
        m.frustumCulled = true;
    }

    // Parte una entrada grande (en el mundo) en trozos del valle, cada uno su malla
    chunkify(entry) {
        const { mesh, positions, delays } = entry, groups = new Map();
        positions.forEach((p, i) => {
            const w = worldOf(p), key = chunkKey(w[0], w[2]);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(i);
        });
        const out = [];
        for (const idx of groups.values()) {
            const m = new THREE.InstancedMesh(mesh.geometry, mesh.material, idx.length);
            if (mesh.instanceColor) idx.forEach((j, i) => m.setColorAt(i, _c.fromArray(mesh.instanceColor.array, j * 3)));
            m.instanceMatrix.setUsage(mesh.instanceMatrix.usage);
            const e = { mesh: m, positions: idx.map((j) => positions[j]), delays: idx.map((j) => delays[j]), hull: entry.hull };
            this.root.add(m);
            this.animated.push(e);
            this.layout(e, this.introT);
            this.cullable(e);
            out.push(e);
        }
        this.animated = this.animated.filter((e) => e !== entry);
        mesh.removeFromParent();
        mesh.dispose();
        return out;
    }

    tileY(k) {
        return k && k.field ? -0.12 : k && k.path ? -0.17 : -0.15;
    }

    paintTile(mesh, t, i) {
        const { theme } = this, { k } = t, c = Math.floor(t.wx), r = Math.floor(t.wz); // (las vetas, por las casillas del mundo)
        const col = k && k.field
            ? (k.locked ? JUNK.ground[mod(c * 7 + r * 5 + mod(c * r, 3), JUNK.ground.length)]
                : CROPS[this.fields[k.field].crop].pasture ? PASTURE[mod(c * 3 + r * 5, 3)]
                // (el trigo grande, sobre rastrojo de paja: se lee lleno con menos tallos)
                : this.fields[k.field].crop === 'wheat' && this.fields[k.field].level >= 2 ? STRAW[(r & 1) + 2 * mod(c * 3 + r, 2)] : theme.soil[r & 1]) // (el prado, de hierba)
            : k && k.path ? theme.path[mod(c * 7 + r * 3, 2)]
            // La pista: asfalto con la raya del centro a trozos
            : k && k.strip ? (t.r === 21 && mod(t.c, 3) !== 0 ? 0xe8e4d8 : ASPHALT[mod(c + r, 2)])
            // El hormigón (la de la nuclear, con su borde de franjas amarillas y negras)
            : k && k.pad ? (k.pad === 1 && this.padEdge(t) ? (mod(c + r, 2) ? 0xffcc33 : 0x2a2622) : CONCRETE[mod(c + r, 2)])
            // El suelo del bosque: manchas de hierba oscura y tierra
            : k && k.forest ? FOREST[mod(Math.floor(Math.sin(c * 0.37) * 2 + Math.sin(r * 0.29 + c * 0.11) * 2 + mod(c * 3 + r * 5, 3)), FOREST.length)]
            : k && k.wild ? JUNK.ground[mod(c * 5 + r * 7 + mod(c * r, 3), JUNK.ground.length)]
            // El claro del mercader: hierba pisada y calvas de tierra (no un suelo liso)
            : k && k.clearing && this.inCrater(t.c + 0.5, t.r + 0.5) ? CRATER[mod(c * 3 + r * 5 + mod(c * r, 2), CRATER.length)]
            : k && k.clearing ? CLEARING[mod(Math.floor(Math.sin(c * 0.5) * 1.6 + Math.sin(r * 0.43 + c * 0.2) * 1.6) + mod(c * 7 + r * 3, 2), CLEARING.length)]
            : k && k.yard ? YARD[mod(c + r, 2)] : theme.grass[mod(c * 5 + r * 3 + mod(c * r, 3), 3)];
        _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter);
        // (su color de verdad se guarda: si es de una parcela sin comprar, se ve en sombra)
        t.col = [_c.r, _c.g, _c.b];
        mesh.setColorAt(i, this.shadeColor(t.col, t.land, t.c + 0.5, t.r + 0.5));
    }

    // ¿Está en el borde de su plataforma de hormigón? (las casillas de sus coordenadas de siempre)
    padEdge(t) {
        const [x0, z0, x1, z1] = FARM.barn.pads[t.k.pad - 1];
        return t.c <= Math.ceil(x0) || t.c >= Math.floor(x1) - 1 || t.r <= Math.ceil(z0) || t.r >= Math.floor(z1) - 1;
    }

    // ---------- Parcelas en venta: en sombra hasta comprarlas ----------
    // Lo en sombra que está un punto (0 nada, 1 del todo): sin comprar, 1; recién comprada, se
    // aclara al pasar la onda que sale de su poste
    shadeOf(land, x, z) {
        if (!land) return 0;
        if (!this.landOwned[land]) return 1;
        const w = this.landWave[land];
        return w ? Math.min(1, Math.max(0, (Math.hypot(x - w.x, z - w.z) - w.t * WAVE) / 3)) : 0;
    }

    shadeColor([r, g, b], land, x, z) {
        const f = this.shadeOf(land, x, z);
        return _c.setRGB(r * (1 - f + f * SHADE[0]), g * (1 - f + f * SHADE[1]), b * (1 - f + f * SHADE[2]));
    }

    // Lo que se oscurece: el suelo y lo abandonado (árboles, matorral, chatarra, piedras y el
    // montón del barril) que cae en una parcela en venta. Se guarda su color de verdad
    initShade() {
        this.shaded = []; // (el suelo ya guarda su color y su parcela al hacerse: buildFloor)
        for (const e of [...this.wild, ...this.views.flatMap((v) => v.junk || [])]) {
            if (e.hull) continue;
            const lands = e.positions.map((p) => (landAt(p.x, p.z) || {}).id || null);
            if (!lands.some(Boolean)) continue;
            const m = e.mesh;
            if (!m.instanceColor) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3).fill(1), 3);
            this.shaded.push({ e, lands, base: m.instanceColor.array.slice() });
        }
        this.applyShade();
    }

    applyShade() {
        for (const t of this.floor.tiles) if (t.land) t.mesh.setColorAt(t.i, this.shadeColor(t.col, t.land, t.c + 0.5, t.r + 0.5));
        for (const e of this.floor.entries) e.mesh.instanceColor.needsUpdate = true;
        for (const { e, lands, base } of this.shaded) {
            e.positions.forEach((p, i) => {
                if (!lands[i]) return;
                e.mesh.setColorAt(i, this.shadeColor([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], lands[i], p.x, p.z));
            });
            e.mesh.instanceColor.needsUpdate = true;
        }
    }

    // Las parcelas, a la venta o no (hasta que la progresión las abre, sin poste de SE VENDE: solo
    // su candado)
    setLandsOpen(on) {
        for (const l of FARM.lands) if (!l.soon && !this.landOwned[l.id]) this.landPosts[l.id].root.visible = on;
    }

    // Parcela comprada: ya es tuya. Su poste salta, se iza tu bandera y la sombra se retira en una
    // onda desde el poste (animate false: ya, sin nada)
    ownLand(id, animate = true) {
        if (this.landOwned[id]) return;
        this.landOwned[id] = true;
        const l = FARM.lands.find((x) => x.id === id);
        this.landPosts[id].setOwned(true, animate);
        if (animate) this.landWave[id] = { t: 0, x: l.post.x, z: l.post.z };
        this.applyShade();
    }

    updateLandWaves(dt) {
        let any = false;
        for (const [id, w] of Object.entries(this.landWave)) {
            w.t += dt;
            any = true;
            // Destellos dorados por el frente de la onda
            const r = w.t * WAVE, [x0, z0, x1, z1] = FARM.lands.find((l) => l.id === id).rect;
            for (let k = 0; k < 6 && this.onLandWave; k++) {
                const a = Math.random() * Math.PI * 2, x = w.x + Math.sin(a) * r, z = w.z + Math.cos(a) * r;
                if (x >= x0 && x < x1 && z >= z0 && z < z1) this.onLandWave(x, z);
            }
            if (r > 50) delete this.landWave[id];
        }
        if (any) this.applyShade();
    }

    // Vuelve a pintar las casillas que han cambiado (un campo crece o se limpia) y aparta la
    // decoración que queda debajo de los campos
    refreshGround() {
        const changed = this.floor.tiles.some((t) => (t.subs || [[t.c, t.r]]).some(([c, r]) => kindKey(this.kindAt(c, r)) !== kindKey(t.k)));
        // (el trigo pasa a rastrojo de paja al nivel 3: también se repinta)
        const straw = this.fields.wheat && this.fields.wheat.level >= 2;
        if (changed || straw !== this.straw) this.buildFloor();
        this.straw = straw;
        for (const e of this.decor) e.positions.forEach((p) => (p.hide = p.hide || this.views.some((v) => inRect(v.rect, p.x, p.z, 0.4))));
        for (const e of this.wild) e.positions.forEach((p) => (p.hide = p.hide || this.cleared(p.x, p.z)));
        for (const e of this.hints || []) e.positions.forEach((p) => (p.hide = p.hide || !this.fields[p.field].locked));
        for (const e of [...this.decor, ...this.wild, ...(this.hints || [])]) this.layout(e, this.introT);
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

    // El claro del mercader: lo que el ovni arrasó al aterrizar (a lo largo del surco, más ancho
    // hacia el final) y el sitio de su puesto, con el borde ondulado (m: margen)
    inClearing(x, z, m = 0) {
        if (!inRect(this.villageZone, x, z)) return false;
        // (pequeño: el surco, el cráter y un corro junto al puesto; todo lo demás, bosque)
        const F = MERCHANT.furrow, S = MERCHANT.stall, U = MERCHANT.ufo;
        const wob = Math.sin(x * 0.9 + z * 0.4) * 0.5 + Math.sin(z * 1.3 - x * 0.5) * 0.4;
        const along = x >= F.to - 2 ? Math.abs(z - F.z) - (F.w / 2 + 1.2) - wob : 9;
        const camp = Math.hypot(x - (S.x - 0.6), (z - (S.z + 0.6)) * 1.2) - 3.2 - wob;
        const crater = Math.hypot(x - U.x, z - U.z) - MERCHANT.crater - 0.4 - wob * 0.5;
        return Math.min(along, camp, crater) < m;
    }

    // ¿En el cráter del ovni? (su fondo, de tierra removida)
    inCrater(x, z) {
        return inRect(this.villageZone, x, z) && Math.hypot(x - MERCHANT.ufo.x, z - MERCHANT.ufo.z) < MERCHANT.crater;
    }

    // ¿En el abanico de árboles tumbados? (ahí no queda ninguno en pie)
    inFan(x, z) {
        const F = MERCHANT.furrow, U = MERCHANT.ufo, dx = x - U.x;
        return inRect(this.villageZone, x, z) && dx > -2 && Math.abs(z - F.z) < MERCHANT.fan.w + Math.max(0, dx) * MERCHANT.fan.open + 0.8;
    }

    // ¿Ya está limpio este punto? (dentro del recinto del granero o de un campo)
    cleared(x, z) {
        return inRect(this.yard, x, z, 0.6) || inRect(this.houseYard, x, z, 0.4) || this.inClearing(x, z, 0.4) || this.views.some((v) => inRect(v.rect, x, z, 0.5))
            // Una parcela comprada y desbloqueada: limpia, menos lo que su campo aún no ocupa
            || FARM.lands.some((l) => l.field && !this.fields[l.field].locked && inRect(rectOf(l.rect), x, z) && !inRect(this.fields[l.field].zone, x, z, 0.3));
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
        const trees = [], pines = [], bush = [], pieces = [], rocks = [];
        // Lo ya puesto (árboles, matas y piedras sin meterse unos en otros), en el mundo (donde se
        // ve, con la parcela estirada), en una rejilla de 2×2: cada sitio nuevo solo se compara con
        // lo de alrededor
        const taken = new Map(), cell = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
        const crowded = (x, z, m) => {
            const cx = Math.floor(x / 2), cz = Math.floor(z / 2);
            for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
                for (const [a, b, r] of taken.get(`${cx + dx},${cz + dz}`) || []) if (Math.hypot(a - x, b - z) < r + m) return true;
            }
            return false;
        };
        const zones = [{ Z: this.zone, k: 1 }, { Z: this.houseZone, k: 0.8 }, { Z: this.villageZone, k: 1.3, forest: true }, ...this.views.filter((v) => !FARM.lands.some((l) => l.field === v.id)).map((v) => ({ Z: v.zone, k: 0.55 })), ...FARM.lands.map((l) => ({ Z: rectOf(l.rect), k: l.soon ? 0.22 : 0.5 }))]; // (las de un campo en venta, ya con su parcela)
        for (const { Z, k, forest } of zones) {
            // (de lo más barato a lo más caro de comprobar)
            const free = (x, z, m) => inRect(Z, x, z) && !(forest && this.inFan(x, z)) && !inRect(this.yard, x, z, m) && !inRect(this.houseYard, x, z, m) && !this.inClearing(x, z, m) && !this.views.some((v) => inRect(v.rect, x, z, m))
                && !FARM.paths.some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)
                && !FARM.structures.some((st) => Math.abs(x - st.x) < st.w / 2 + m && Math.abs(z - st.z) < st.d / 2 + m)
                && !FARM.lands.some((l) => Math.hypot(x - l.post.x, z - l.post.z) < m + 1.2) // (ni sobre su poste)
                && !this.hintSpots.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < m + 0.8);
            // Lo que estira la parcela en cada punto (área en el mundo de una casilla suya): donde
            // estira más, se ponen más cosas, para que en el mapa quede igual de tupido
            const areaAt = (x, z) => {
                const a = stretchLocal(x, z), b = stretchLocal(x + 1, z), c = stretchLocal(x, z + 1);
                return Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
            };
            let jSum = 0, jMax = 0;
            for (let i = 0; i < 64; i++) {
                const j = areaAt(Z.x + Math.random() * Z.w, Z.z + Math.random() * Z.d);
                jSum += j;
                jMax = Math.max(jMax, j);
            }
            jMax *= 1.15;
            // El bosque, a manchas: más tupido en unas y con claros en otras
            const clump = (w) => 0.25 + 0.75 * Math.min(1, Math.max(0, 0.5 + 0.35 * (Math.sin(w.x * 0.23 + 1.3) + Math.sin(w.z * 0.19 - 0.7) + Math.sin((w.x + w.z) * 0.11))));
            const spots = (n, m) => {
                const out = [];
                for (let j = 0, tries = 0; j < n && tries < n * 60; tries++) {
                    const x = Z.x + Math.random() * Z.w, z = Z.z + Math.random() * Z.d;
                    if (Math.random() * jMax > areaAt(x, z) || !free(x, z, m)) continue;
                    const w = toWorld(x, z);
                    if ((forest && Math.random() > clump(w)) || crowded(w.x, w.z, m) || onPathWorld(w, m)) continue;
                    out.push([x, z]);
                    const key = cell(w.x, w.z);
                    if (!taken.has(key)) taken.set(key, []);
                    taken.get(key).push([w.x, w.z, m]);
                    j++;
                }
                return out;
            };
            // Cantidades según lo que ocupa la zona en el mapa (k: en los campos, algo menos de árbol;
            // matorral, chatarra y piedras, sueltos: las zonas son grandes)
            const area = Z.w * Z.d * (jSum / 64);
            const cap = (n, max) => Math.min(max, Math.round(n)); // (con tope: hay zonas enormes)
            const tr = spots(cap(area * 0.18 * k, forest ? 900 : 200), 1.05);
            // (en el bosque del mercader, la mitad son pinos)
            if (forest) tr.forEach((p, i) => (i % 2 ? pines : trees).push(p));
            else trees.push(...tr);
            bush.push(...spots(cap(area * 0.1, 160), 0.45).map(([x, z]) => ({ x, y: 0.22, z, sx: 0.7 + Math.random() * 0.5, sy: 0.44, sz: 0.6 + Math.random() * 0.4, ry: Math.random() * 3 })));
            // El bosque del comerciante: solo árboles, matorral y piedras (sin chatarra)
            if (!forest) pieces.push(...junkyard({ x0: Z.x, z0: Z.z, x1: Z.x + Z.w, z1: Z.z + Z.d, px: 9999, pz: 9999, count: cap(area * 0.09, 120), s: 0.42, layers: [], inside: (x, z) => free(x, z, 0.4) && !onPathWorld(toWorld(x, z), 0.4) }).pieces);
            rocks.push(...spots(cap(area * 0.03, 50), 0.3).map(([x, z]) => ({ x, y: 0.1, z, sx: 0.45, sy: 0.24, sz: 0.35, ry: Math.random() })));
        }
        const n0 = this.animated.length;
        const { trunks, leaves } = treeParts(trees);
        // Pinos: tronco y tres pisos de copa en punta, verde oscuro
        const pt = [], pl = [];
        pines.forEach(([x, z], i) => {
            const s = 0.85 + Math.random() * 0.6;
            pt.push({ x, y: 0.4 * s, z, sx: 0.28 * s, sy: 0.8 * s, sz: 0.28 * s });
            [[1.6, 0.8, 1.2], [1.15, 0.7, 1.9], [0.7, 0.6, 2.5]].forEach(([w, h, y], k) => pl.push({ x, y: y * s, z, sx: w * s, sy: h * s, sz: w * s, ry: 0.78 + i, k }));
        });
        if (pines.length) {
            this.addHulled(0x6a4424, pt, 0.4);
            const pm = this.addHulled(0xffffff, pl, 0.45);
            pl.forEach((p, i) => pm.setColorAt(i, _c.setHex([0x2f6f3a, 0x377a40, 0x3f8646][p.k]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.05)));
        }
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

    // Adelantos: en cada terreno aún bloqueado asoman, entre la porquería, unas cuantas plantas de lo
    // que tendrá (espigas, tomateras, calabazas, maíz). Se van al desbloquearlo
    // Dónde van las plantas de muestra (antes que lo abandonado, que les deja un claro alrededor
    // para que se vean)
    pickHints() {
        this.hintSpots = [];
        this.hintBy = {};
        for (const v of this.views) {
            if (!v.locked) continue;
            // Bastantes (según el tamaño de la zona) y grandes, para que se vea bien lo que vendrá
            const Z = v.zone, spots = [], want = Math.min(34, Math.max(12, Math.round(Z.w * Z.d * 0.07)));
            for (let tries = 0; spots.length < want && tries < 900; tries++) {
                const x = Z.x + 0.8 + Math.random() * (Z.w - 1.6), z = Z.z + 0.8 + Math.random() * (Z.d - 1.6);
                if (FARM.paths.some(([x0, z0, x1, z1]) => x > x0 - 0.7 && x < x1 + 0.7 && z > z0 - 0.7 && z < z1 + 0.7)) continue;
                if (spots.some(([a, b]) => Math.hypot(a - x, b - z) < 1.5)) continue;
                spots.push([x, z]);
            }
            this.hintBy[v.id] = spots;
            this.hintSpots.push(...spots);
        }
    }

    buildHints() {
        const solid = [], thin = [];
        for (const v of this.views) for (const [x, z] of this.hintBy[v.id] || []) this.hintPlant(v.crop, x, z, v.id, solid, thin);
        this.hints = [];
        if (solid.length) {
            const m = this.addHulled(0xffffff, solid, 0.5);
            solid.forEach((p, i) => m.setColorAt(i, _c.setHex(p.color)));
            this.hints.push(...this.animated.slice(-2));
        }
        if (thin.length) {
            const m = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), thin.length);
            thin.forEach((p, i) => m.setColorAt(i, _c.setHex(p.color)));
            this.hints.push(this.addAnimated(m, thin, 0.5));
        }
    }

    // Una planta de muestra de un cultivo (piezas con contorno en solid; tallos finos en thin)
    hintPlant(crop, x, z, field, solid, thin) {
        const r = Math.random() * Math.PI, k = 1.45; // más grandes que las de verdad, para que se lean
        const add = (list, dx, y, dz, sx, sy, sz, color, ry = 0) => list.push({ x: x + dx * k, y: y * k, z: z + dz * k, sx: sx * k, sy: sy * k, sz: sz * k, ry, color, field });
        if (crop === 'wheat') {
            for (let k = 0; k < 6; k++) {
                const a = k * 1.1 + r, d = 0.08 + (k % 3) * 0.08, h = 0.7 + (k % 2) * 0.2;
                add(thin, Math.sin(a) * d, h / 2, Math.cos(a) * d, 0.05, h, 0.05, 0xd8b040);
                add(thin, Math.sin(a) * d, h + 0.12, Math.cos(a) * d, 0.1, 0.24, 0.1, 0xf6cf4a);
            }
        } else if (crop === 'tomato') {
            add(thin, 0.18, 0.5, 0, 0.05, 1.0, 0.05, 0xb07a44);
            add(solid, 0, 0.28, 0, 0.6, 0.56, 0.55, 0x3d9a34, r);
            for (const [dx, y, dz] of [[-0.2, 0.42, 0.22], [0.15, 0.55, 0.2], [0.24, 0.3, -0.12]]) add(solid, dx, y, dz, 0.2, 0.2, 0.2, 0xe8352a);
        } else if (crop === 'pumpkin') {
            add(solid, 0.3, 0.04, 0.2, 0.6, 0.08, 0.45, 0x4a9a34, r);
            add(solid, -0.25, 0.04, -0.2, 0.5, 0.08, 0.4, 0x3d8a2c, r + 1);
            add(solid, 0, 0.24, 0, 0.75, 0.48, 0.64, 0xf08a1e, r);
            add(solid, 0, 0.53, 0, 0.09, 0.16, 0.09, 0x5a7a2a);
        } else if (crop === 'milk') {
            // Una vaca de muestra: cuerpo con su mancha, cabeza, patas y la ubre rosa
            const rx = Math.sin(r), rz = Math.cos(r);
            add(solid, 0, 0.62, 0, 0.42, 0.34, 0.8, 0xf6f3ea, r);
            add(solid, 0, 0.8, 0, 0.36, 0.04, 0.24, 0x2a2622, r);
            add(solid, rx * 0.5, 0.74, rz * 0.5, 0.26, 0.24, 0.24, 0xf6f3ea, r);
            add(solid, rx * 0.66, 0.68, rz * 0.66, 0.2, 0.12, 0.08, 0xf2a0b0, r);
            for (const [a, b] of [[0.12, 0.28], [-0.12, 0.28], [0.12, -0.28], [-0.12, -0.28]]) add(solid, rx * b + rz * a, 0.22, rz * b - rx * a, 0.1, 0.44, 0.1, 0xf6f3ea);
            add(solid, -rx * 0.1, 0.4, -rz * 0.1, 0.22, 0.12, 0.2, 0xf2a0b0, r);
        } else if (crop === 'wool') {
            // Una oveja de muestra: su bola de lana, la cabeza oscura y las patas
            const rx = Math.sin(r), rz = Math.cos(r);
            add(solid, 0, 0.62, 0, 0.62, 0.52, 0.72, 0xfaf6ec, r);
            add(solid, 0, 0.9, 0, 0.4, 0.2, 0.44, 0xf0e8d6, r);
            add(solid, rx * 0.42, 0.72, rz * 0.42, 0.22, 0.24, 0.24, 0x3a2e2a, r);
            for (const [a, b] of [[0.13, 0.2], [-0.13, 0.2], [0.13, -0.2], [-0.13, -0.2]]) add(solid, rx * b + rz * a, 0.2, rz * b - rx * a, 0.09, 0.4, 0.09, 0x3a2e2a);
        } else if (crop === 'corn') {
            add(thin, 0, 0.9, 0, 0.12, 1.8, 0.12, 0x8ab83a);
            add(thin, 0.35, 0.7, 0.1, 0.1, 1.4, 0.1, 0x7ab83a);
            add(solid, 0.1, 1.25, 0.08, 0.17, 0.42, 0.17, 0xffd23f);
            add(solid, 0, 0.95, 0, 0.6, 0.06, 0.14, 0x7ab83a, r);
            add(solid, 0, 1.4, 0, 0.5, 0.06, 0.12, 0x6aa832, r + 1.4);
        }
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
    //   Calabaza: una por casilla, tumbada entre dos hojas grandes.
    //   Maíz: dos por casilla, altas, con su hoja y la mazorca.
    buildPlants(v, old = null, fromCenter = false) {
        if (CROPS[v.crop].pasture) return this.buildHerd(v);
        const f = v.rect, wheat = v.crop === 'wheat', n0 = { wheat: v.level >= 2 ? 1.5 : PER_TILE, corn: 1.4, tomato: 1.3, pumpkin: 1.2 }[v.crop] || 1;
        const prev = new Map(v.plants.map((s) => [s.key, s]));
        v.plants = [];
        for (let tx = f.x; tx < f.x + f.w; tx++) for (let tz = f.z; tz < f.z + f.d; tz++) {
            if (!this.inField(v, tx + 0.5, tz + 0.5)) continue; // (su forma)
            // Donde la parcela se estira para llenar su zona, más plantas por casilla (las mismas por
            // casilla del mundo)
            const a0 = stretchLocal(tx, tz), a1 = stretchLocal(tx + 1, tz), a2 = stretchLocal(tx, tz + 1);
            const k = Math.sqrt(Math.abs((a1.x - a0.x) * (a2.z - a0.z) - (a1.z - a0.z) * (a2.x - a0.x)));
            const n = Math.max(1, Math.min(n0 + 3, Math.round(n0 * k)));
            for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
                const key = `${tx},${tz},${a},${b},${n}`;
                const x = tx + (a + 0.5) / n, z = tz + (b + 0.5) / n;
                const keep = prev.get(key);
                if (keep) {
                    v.plants.push(keep);
                    continue;
                }
                const j = wheat ? 0.12 : n > 1 ? 0.15 : 0.2;
                const w = stretchLocal(x, z);
                v.plants.push({
                    key,
                    wx: w.x,
                    wz: w.z,
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
        }
        for (const m of v.meshes) {
            if (m.parent) m.parent.remove(m);
            m.dispose();
        }
        const count = v.plants.length;
        if (!v.mats) v.mats = [toon(0xffffff), toon(0xffffff), toon(0xffffff)];
        if (wheat) {
            // Tallos y espigas. Las espigas no cambian de color: maduras doradas, con dos tonos
            v.meshes = [this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[0], count)), this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[1], count))];
            v.plants.forEach((s, i) => v.meshes[1].setColorAt(i, _c.setHex(s.tone < 0.5 ? CROPS.wheat.ear : CROPS.wheat.earDark)));
        } else if (v.crop === 'pumpkin') {
            // Hojas (2 por planta), la calabaza y su rabo
            v.meshes = [
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[0], count * 2)),
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[1], count)),
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[2], count)),
            ];
            const P = CROPS.pumpkin;
            v.plants.forEach((s, i) => {
                for (let k = 0; k < 2; k++) v.meshes[0].setColorAt(i * 2 + k, _c.setHex(P.leaves[(k + i) % 3]).offsetHSL(0, 0, (s.tone - 0.5) * 0.06));
                v.meshes[2].setColorAt(i, _c.setHex(P.calyx));
            });
        } else if (v.crop === 'corn') {
            // Caña, hojas (2) y mazorca
            v.meshes = [
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[0], count)),
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[1], count * 2)),
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[2], count)),
            ];
            v.plants.forEach((s, i) => {
                for (let k = 0; k < 2; k++) v.meshes[1].setColorAt(i * 2 + k, _c.setHex(CROPS.corn.leaves[(k + i) % 3]).offsetHSL(0, 0, (s.tone - 0.5) * 0.06));
            });
        } else {
            // Hojas (3 bloques por mata), tomates (2) y tutores (1)
            v.meshes = [
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[0], count * 3)),
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[1], count * 2)),
                this.dynamic(v, new THREE.InstancedMesh(box(1, 1, 1), v.mats[2], count)),
            ];
            const T = CROPS.tomato;
            v.plants.forEach((s, i) => {
                for (let k = 0; k < 3; k++) v.meshes[0].setColorAt(i * 3 + k, _c.setHex(T.leaves[(k + i) % 3]).offsetHSL(0, 0, (s.tone - 0.5) * 0.06));
                v.meshes[2].setColorAt(i, _c.setHex(T.stake));
            });
        }
        v.fresh = true; // (se colocan ya, sin esperar al siguiente paso de la animación)
        // Lo que queda fuera de cámara no se dibuja: la esfera de todo el campo (en su parcela)
        if (v.plants.length) {
            let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
            for (const p of v.plants) {
                x0 = Math.min(x0, p.wx); x1 = Math.max(x1, p.wx);
                z0 = Math.min(z0, p.wz); z1 = Math.max(z1, p.wz);
            }
            const sphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, 1, (z0 + z1) / 2), Math.hypot(x1 - x0, 3, z1 - z0) / 2 + 2);
            for (const m of v.meshes) {
                m.boundingSphere = sphere;
                m.frustumCulled = true;
            }
        }
    }

    // Terreno abandonado: chatarra oxidada por todo el campo y el montón con el barril rojo
    buildJunk(v) {
        const f = v.rect;
        const { pieces, barrel } = junkyard({ x0: f.x + 0.3, z0: f.z + 0.3, x1: f.x + f.w - 0.3, z1: f.z + f.d - 0.3, px: f.cx, pz: f.cz, count: Math.round(f.w * f.d * 0.6), s: 0.42 });
        const all = [...pieces.filter((p) => this.inField(v, p.x, p.z)), ...barrelParts(barrel)];
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

    // Torreta automática del campo: sacos terreros en cada esquina (por dentro) y la torreta, que
    // va de unos a otros (pop: aparece con un bote)
    setTurrets(id, pop = true) {
        const v = this.fields[id];
        if (v.turret) return;
        const f = v.rect, m = 0.5, S = 1.35;
        v.bases = [[f.x + m, f.z + m], [f.x + f.w - m, f.z + m], [f.x + f.w - m, f.z + f.d - m], [f.x + m, f.z + f.d - m]].map(([x, z]) => {
            const b = new Sandbags(this.theme.outline), at = stretchLocal(x, z);
            b.root.position.set(at.x, 0, at.z);
            b.root.scale.setScalar(S);
            this.groupAt(f.cx, f.cz).add(b.root);
            if (pop) b.select();
            return b;
        });
        const t = (v.turret = new Turret(this.theme.outline));
        t.root.scale.setScalar(S);
        t.corner = 0;
        t.root.position.copy(v.bases[0].root.position).setY(v.bases[0].top * S);
        t.yaw = Math.atan2(f.cx - t.root.position.x, f.cz - t.root.position.z);
        t.hopT = TURRETS.hop;
        this.groupAt(f.cx, f.cz).add(t.root);
        if (pop) this.startDrop(v);
    }

    // La llegada de la torreta (al comprarla): los sacos terreros caen del cielo uno a uno en sus
    // esquinas; luego baja la torreta en paracaídas, se posa, suelta el paracaídas, gira la cabeza
    // y suelta una ráfaga de prueba. onDrop(kind, x, z) avisa a main.js de cada golpe ('bag',
    // 'land', 'ready') para el polvo, el sonido y el temblor.
    startDrop(v) {
        const chute = new THREE.Group();
        const RED = 0xc8402e, WHITE = 0xfff3d6;
        for (let i = 0; i < 5; i++) {
            const m = new THREE.Mesh(box(0.5, 0.18, 1.6), toon(i % 2 ? WHITE : RED));
            m.position.set((i - 2) * 0.46, 2.1 - Math.abs(i - 2) * 0.16, 0);
            m.rotation.z = -(i - 2) * 0.22;
            chute.add(m);
        }
        for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) {
            const c = new THREE.Mesh(box(0.03, 1.5, 0.03), toon(0x2a1a0e));
            c.position.set(s * 0.5, 1.2, z);
            c.rotation.z = s * 0.4;
            chute.add(c);
        }
        v.turret.root.add(chute);
        v.drop = { t: 0, chute, y: v.turret.root.position.y, landed: false, bags: v.bases.map(() => false), ready: false };
        for (const b of v.bases) b.root.position.y = 40;
        v.turret.root.position.y = 40;
    }

    updateDrop(v, dt) {
        const D = v.drop, t = (D.t += dt), T = v.turret, S = T.root.scale.x;
        // Los sacos: cada uno cae acelerando y se aplasta un poco al llegar
        v.bases.forEach((b, i) => {
            const a = 0.15 + i * 0.28, k = Math.min(1, Math.max(0, (t - a) / 0.35));
            b.root.position.y = 12 * (1 - k * k);
            const sq = Math.max(0, 1 - (t - a - 0.35) / 0.18);
            b.root.scale.y = S * (k >= 1 ? 1 - 0.3 * sq : 1);
            if (k >= 1 && !D.bags[i]) {
                D.bags[i] = true;
                if (this.onDrop) this.onDrop('bag', b.root.position.x, b.root.position.z);
            }
        });
        // La torreta en paracaídas: baja balanceándose
        const k = Math.min(1, Math.max(0, (t - 1.3) / 1.6));
        T.root.position.y = D.y + 16 * (1 - k);
        T.root.rotation.z = k < 1 ? Math.sin(t * 3) * 0.12 * (1 - k) : 0;
        if (k >= 1 && !D.landed) {
            D.landed = true;
            if (this.onDrop) this.onDrop('land', T.root.position.x, T.root.position.z);
        }
        // Suelta el paracaídas, que cae a un lado y se encoge
        if (D.landed && D.chute.parent) {
            const c = Math.min(1, (t - 2.9) / 0.5);
            D.chute.rotation.z = c * 1.2;
            D.chute.position.set(c * 0.8, -c * 1.2, 0);
            D.chute.scale.setScalar(Math.max(0.0001, 1 - c));
            if (c >= 1) T.root.remove(D.chute);
        }
        // Se despereza: la cabeza da dos vueltas y suelta una ráfaga al aire
        if (t > 3.0) {
            const s = Math.min(1, (t - 3.0) / 0.7);
            T.head.rotation.y = T.yaw + s * Math.PI * 4;
            T.flash.visible = t > 3.3 && Math.sin(t * 60) > 0;
        }
        if (t > 3.8) {
            T.flash.visible = false;
            T.head.rotation.y = T.yaw;
            v.drop = null;
            if (this.onDrop) this.onDrop('ready', T.root.position.x, T.root.position.z);
        }
    }

    // Dónde ha recogido la torreta su última mata (para el +1 del mapa): lo que está acribillando,
    // o una mata al azar
    turretSpot(id) {
        const v = this.fields[id];
        if (!v.turret || !v.plants.length) return null;
        if (v.turret.tgt) return { x: v.turret.tgt.x, z: v.turret.tgt.z };
        const s = v.plants[(Math.random() * v.plants.length) | 0];
        return { x: s.x, z: s.z };
    }

    // La torreta de un campo maduro no para de tirotearlo a ráfagas (elige una mata, la apunta, le
    // suelta su ráfaga y a por otra) y cada poco salta a otra esquina. Cada bala: trazada y
    // onTurretHit(x, z, n). empty: sin munición
    updateTurrets(v, dt, ripe, empty = false) {
        const t = v.turret;
        if (!t.hopping) t.setOff(empty);
        t.update(dt);
        if (t.hopping) return;
        // Sin munición: apagada en su esquina, sin disparar y echando humo (hasta que se recargue)
        if (empty) {
            t.tgt = null;
            if (t.puff && this.onTurretOff) this.onTurretOff(t.root.position.x, t.root.position.y + 0.9 * t.root.scale.y, t.root.position.z);
            return;
        }
        if ((t.hopT -= dt) <= 0 && !t.tgt) {
            t.hopT = TURRETS.hop;
            t.corner = (t.corner + (Math.random() < 0.5 ? 1 : 3)) % 4; // a la esquina de al lado (nunca en diagonal)
            const b = v.bases[t.corner];
            t.hopTo(b.root.position.x, b.top * b.root.scale.y, b.root.position.z);
            return;
        }
        if (!ripe || !v.plants.length) {
            t.tgt = null;
            return;
        }
        if (!t.tgt && (t.cool = (t.cool || 0) - dt) <= 0) {
            const s = v.plants[(Math.random() * v.plants.length) | 0];
            t.tgt = { x: s.x, z: s.z };
            const w = stretchLocal(s.x, s.z);
            t.aimAt(w.x, w.z, 1.3);
            t.shots = TURRETS.burst;
            t.next = 0;
            t.wait = 0.8;
        }
        if (!t.tgt || (!t.aimed && (t.wait -= dt) > 0) || (t.next -= dt) > 0) return;
        t.next = TURRETS.rate;
        t.fire();
        const from = t.muzzle.getWorldPosition(new THREE.Vector3());
        const to = new THREE.Vector3(t.tgt.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.4, t.tgt.z + (Math.random() - 0.5) * 0.6);
        const tw = this.world(to.x, to.y, to.z, new THREE.Vector3()); // (la trazada, en el mundo)
        const beam = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
        beam.position.copy(from).lerp(tw, 0.5);
        beam.lookAt(tw);
        beam.scale.set(0.08, 0.08, from.distanceTo(tw));
        this.root.add(beam);
        this.shots.push({ beam, life: 0.06 });
        if (this.onTurretHit) this.onTurretHit(to.x, to.z, t.shots);
        if (--t.shots <= 0) {
            t.tgt = null;
            t.cool = TURRETS.cool * (0.5 + Math.random() * 0.6);
        }
    }

    updateShots(dt) {
        this.shots = this.shots.filter((sh) => {
            if ((sh.life -= dt) > 0) return true;
            this.root.remove(sh.beam);
            sh.beam.material.dispose();
            return false;
        });
    }

    // Terreno limpio (tras la explosión del barril): se quita la chatarra, la tierra queda arada
    // y las plantas brotan desde el centro
    unlock(id) {
        const v = this.fields[id];
        if (!v.locked) return;
        // (si es de una parcela en venta, también queda tuya: DEBUG la desbloquea sin comprarla)
        const land = FARM.lands.find((l) => l.field === id);
        if (land) this.ownLand(land.id, false);
        v.locked = false;
        this.shaded = this.shaded.filter((s) => !(v.junk || []).includes(s.e));
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

    // Árboles: el bosque por los huecos entre parcelas (Scenery decide dónde, en el mundo)
    buildTrees() {
        const { trunks, leaves } = treeParts(this.groves, true);
        this.addHulled(0x7a4f2a, trunks, 0.4);
        const lm = this.addHulled(0xffffff, leaves, 0.45);
        leaves.forEach((p, i) => lm.setColorAt(i, _c.setHex(this.theme.leaves[(p.k + i) % 3]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)));
    }

    // Matas de hierba alta, flores y piedras sobre el césped libre
    buildDecor() {
        const tufts = [], flowers = [], rocks = [], B = FARM.bounds;
        for (let r = B.z0; r < B.z1; r++) for (let c = B.x0; c < B.x1; c++) {
            if (!inParcel(c, r, 1) || !inShapeOf(c + 0.5, r + 0.5) || this.kindAt(c, r)) continue;
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

    // Nubes de cajas que cruzan el valle de lado a lado de la pantalla (todas en dos mallas: la
    // de color y la de contorno; cada fotograma se recolocan sus piezas)
    buildClouds() {
        const V = FARM.valley, parts = [];
        this.clouds = [];
        for (let i = 0; i < 18; i++) {
            const c = { u: Math.random() * V.w, v: 40 + Math.random() * (V.h - 30), y: 10 + Math.random() * 4, speed: 0.3 + Math.random() * 0.3, parts: [] };
            const n = 3 + (i % 3);
            for (let k = 0; k < n; k++) {
                c.parts.push({ dx: k * 1.1 - n * 0.55, dy: Math.random() * 0.3, dz: (Math.random() - 0.5) * 0.8, w: 1.6 + Math.random() * 1.6, h: 0.6 + Math.random() * 0.4, d: 1.2 + Math.random() });
            }
            parts.push(...c.parts);
            this.clouds.push(c);
        }
        this.cloudMesh = new THREE.InstancedMesh(box(1, 1, 1), toon(this.theme.clouds), parts.length);
        this.cloudHull = new THREE.InstancedMesh(box(1, 1, 1), outline(this.theme.outline), parts.length);
        for (const m of [this.cloudMesh, this.cloudHull]) {
            m.frustumCulled = false;
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.root.add(m);
        }
        this.updateClouds(0);
    }

    updateClouds(dt) {
        const V = FARM.valley;
        let i = 0;
        for (const c of this.clouds) {
            c.u += c.speed * dt;
            if (c.u > V.w + 30) c.u = -30;
            const [x, z] = V.toXZ(c.u, c.v);
            for (const p of c.parts) {
                for (const [m, o] of [[this.cloudMesh, 0], [this.cloudHull, OUTLINE * 2]]) {
                    _d.position.set(x + p.dx, c.y + p.dy, z + p.dz);
                    _d.rotation.set(0, 0, 0);
                    _d.scale.set(p.w + o, p.h + o, p.d + o);
                    _d.updateMatrix();
                    m.setMatrixAt(i, _d.matrix);
                }
                i++;
            }
        }
        this.cloudMesh.instanceMatrix.needsUpdate = this.cloudHull.instanceMatrix.needsUpdate = true;
    }

    dynamic(v, mesh) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        this.groupAt(v.zone.cx, v.zone.cz).add(mesh);
        return mesh;
    }

    // ¿Dentro de la forma del campo v? (cada campo, la suya)
    inField(v, x, z) {
        const seed = [...v.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 7;
        return inFieldShape(v.rect, seed, x, z);
    }

    // El grupo de la parcela de un punto (en sus coordenadas de siempre); fuera, el de la raíz
    groupAt(x, z) {
        const P = toWorld(x, z).place;
        return P ? this.places[P.id] : this.root;
    }

    // De las coordenadas de siempre al mundo (out: Vector3)
    world(x, y, z, out = new THREE.Vector3()) {
        const w = toWorld(x, z, y);
        return out.set(w.x, w.y, w.z);
    }

    addHulled(color, pts, delay = 0) {
        const n = Math.max(1, pts.length);
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), toon(color), n);
        const hull = new THREE.InstancedMesh(box(1, 1, 1), outline(this.theme.outline), n);
        this.addAnimated(mesh, pts, delay);
        this.addAnimated(hull, pts.map((p) => ({ ...p, sx: (p.sx || 1) + OUTLINE * 2, sy: (p.sy || 1) + OUTLINE * 2, sz: (p.sz || 1) + OUTLINE * 2 })), delay).hull = true;
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
            let turn = 0;
            if (p.world) _d.position.set(p.x, p.y - (1 - k) * 3, p.z);
            else {
                // (dónde cae en el mundo se calcula una vez por sitio: estirar la parcela cuesta)
                if (p._lx !== p.x || p._lz !== p.z) {
                    const w = toWorld(p.x, p.z);
                    p._lx = p.x;
                    p._lz = p.z;
                    p._w = [w.x, w.y, w.z, w.place ? (w.place.rot || 0) * (Math.PI / 2) : 0]; // (girado como su parcela)
                }
                _d.position.set(p._w[0], p._w[1] + p.y - (1 - k) * 3, p._w[2]);
                turn = p._w[3];
            }
            _d.rotation.set(p.rx || 0, (p.ry || 0) + turn, p.rz || 0);
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
        if (ray.intersectObject(this.camp.root, true).length) return { merchant: true };
        const hits = ray.intersectObjects([...this.structures.map((m) => m.root), this.compound.root], true);
        if (hits.length) return { structure: hits[0].object.userData.structure };
        // El suelo de cada parcela, a su altura: el más cercano en el que caiga el rayo
        let best = null;
        for (const P of PLACES) {
            const t = (P.h - ray.ray.origin.y) / ray.ray.direction.y;
            if (!(t > 0) || (best && t >= best.t)) continue;
            ray.ray.at(t, _p);
            const { x, z } = worldToPlace(P, _p.x, _p.z);
            if (x >= P.from[0] && x < P.from[0] + 30 && z >= P.from[1] && z < P.from[1] + 30) best = { t, x, z };
        }
        if (!best) return null;
        const v = this.views.find((w) => inRect(w.rect, best.x, best.z, 0.2));
        return v ? { field: v.id } : null;
    }

    // Todo ya montado, sin la animación de entrada (al llegar del prólogo: el suelo, los edificios y
    // las plantas ya en su sitio)
    skipIntro() {
        this.introT = INTRO_TIME + 0.5;
        this.clock = Math.max(this.clock, 30);
        for (const a of this.animated) this.layout(a, this.introT);
        for (const m of this.structures) {
            m.landed = true;
            m.root.position.y = 0;
            m.root.scale.setScalar(1);
        }
    }

    // Visto desde muy lejos (el botón MAPA): sin los contornos de lo pequeño (árboles, matas,
    // piedras, setos...) ni la decoración, que a esa distancia no se ven y cuestan mucho
    setFar(on) {
        if (this.far === on) return;
        this.far = on;
        for (const e of this.animated) if (e.hull) e.mesh.visible = !on;
        for (const e of this.decor) e.mesh.visible = !on;
    }

    // progress: { id: crecimiento de 0 a 1 } de cada campo
    update(dt, time, progress) {
        this.clock += dt;
        if (this.introT < INTRO_TIME + 0.5) {
            this.introT += dt;
            // (solo lo que está entrando: lo que aún no ha empezado sigue escondido y lo que ya ha
            // caído no se mueve; cada entrada guarda cuándo empieza y cuándo acaba)
            for (const a of this.animated) {
                if (a.t0 === undefined) {
                    a.t0 = Math.min(...a.delays);
                    a.t1 = Math.max(...a.delays) + 0.45;
                }
                if (this.introT < a.t0 || a.settled) continue;
                this.layout(a, this.introT);
                if (this.introT >= a.t1) a.settled = true;
            }
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
        this.plot.update(dt, time);
        updateScenery(this, dt);
        this.camp.update(dt, time, this.nightK || 0);
        this.compound.root.visible = this.introT > 1.1 && this.compoundOn; // (aparece con los edificios)
        this.compound.update(dt, time);
        this.life.update(dt, time);
        if (!this.extras) {
            // (las sorpresas, con los edificios ya en su sitio)
            this.extras = new Extras(this.theme.outline, this);
            this.root.add(this.extras.root);
        }
        this.extras.update(dt, time, this.onSparkle);
        const night = (this.nightK || 0) > 0.35;
        this.runwayMat.color.setHex(night ? (Math.sin(time * 3) > 0 ? 0xffe066 : 0xff9a3a) : 0x6a5a3a);
        this.lensMat.color.setHex(night ? 0xfff6c0 : 0x8a8670);
        for (const g of this.searchlights) {
            g.userData.beam.visible = night;
            g.rotation.y = time * 0.45 + g.userData.k * Math.PI;
        }
        for (const post of Object.values(this.landPosts)) post.update(dt, time);
        this.updateLandWaves(dt);
        this.updateShots(dt);

        // Las plantas se mueven a 15 fotogramas por segundo (a saltitos, como el resto del juego:
        // y cuesta cuatro veces menos con los campos grandes)
        this.plantT = (this.plantT || 0) + dt;
        const step = this.plantT >= 1 / 15, pdt = this.plantT;
        if (step) this.plantT = 0;
        for (const v of this.views) {
            if (v.locked) continue;
            if (v.drop) this.updateDrop(v, dt);
            else if (v.turret) this.updateTurrets(v, dt, (progress[v.id] || 0) >= 1, !!(this.turretEmpty && this.turretEmpty(v.id)));
            if (!step && !v.fresh) continue;
            v.fresh = false;
            const p = progress[v.id] || 0;
            if (v.crop === 'wheat') this.updateWheat(v, time, p);
            else if (v.crop === 'pumpkin') this.updatePumpkin(v, time, p);
            else if (v.crop === 'corn') this.updateCorn(v, time, p);
            else if (v.herd) this.updateHerd(v, pdt, time, p);
            else this.updateTomato(v, time, p);
            for (const m of v.meshes) {
                m.instanceMatrix.needsUpdate = true;
                if (m.instanceColor) m.instanceColor.needsUpdate = true;
            }
        }

        this.updateClouds(dt);
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
            _d.position.set(s.wx - Math.sin(sway) * h / 2, Math.cos(sway) * h / 2, s.wz);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.07, Math.max(0.0001, h), 0.07);
            _d.updateMatrix();
            stalkMesh.setMatrixAt(i, _d.matrix);
            const st = ready ? 3 : p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
            stalkMesh.setColorAt(i, _c.setHex(stages[st]).offsetHSL(0, 0, (s.tone - 0.5) * 0.08));
            // Espiga: aparece al final del crecimiento, en la punta
            const e = p < 0.7 ? 0.0001 : Math.min(1, (p - 0.7) / 0.3);
            _d.position.set(s.wx - Math.sin(sway) * (h + 0.1), Math.cos(sway) * (h + 0.1), s.wz);
            _d.scale.set(0.14 * e, 0.3 * e, 0.14 * e);
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
                _d.position.set(s.wx + Math.sin(sway) * y * h, y * h, s.wz);
                _d.rotation.set(0, s.ry + k * 0.5, sway);
                _d.scale.set(w * g, Math.max(0.0001, lh * g), w * g);
                _d.updateMatrix();
                leafMesh.setMatrixAt(i * 3 + k, _d.matrix);
            });
            _d.position.set(s.wx - 0.18, 0.6 * h, s.wz - 0.18);
            _d.rotation.set(0, 0, 0);
            _d.scale.set(0.05, Math.max(0.0001, 1.2 * h), 0.05);
            _d.updateMatrix();
            stakeMesh.setMatrixAt(i, _d.matrix);
            // Tomates: aparecen al 40% y engordan al madurar
            const e = p < 0.4 ? 0.0001 : Math.min(1, (p - 0.4) / 0.2) * (0.6 + 0.4 * ripe) * g;
            _c.setHex(T.unripe).lerp(_c2.setHex(s.tone < 0.5 ? T.fruit : T.fruitDark), ripe);
            for (let k = 0; k < 2; k++) {
                const a = s.ry + k * Math.PI, y = (0.38 + k * 0.22) * h;
                _d.position.set(s.wx + Math.sin(a) * 0.24 + Math.sin(sway) * y, y, s.wz + Math.cos(a) * 0.24);
                _d.rotation.set(0, a, 0);
                _d.scale.setScalar(Math.max(0.0001, 0.26 * e));
                _d.updateMatrix();
                fruitMesh.setMatrixAt(i * 2 + k, _d.matrix);
                fruitMesh.setColorAt(i * 2 + k, _c);
            }
        });
    }

    // El prado de las vacas (o de las ovejas): una cada pocas casillas (más pequeñas que en el
    // campo de tiro), paseando y paciendo por su campo. v.plants son ellas (la torreta les dispara)
    buildHerd(v) {
        const f = v.rect, n = Math.max(2, Math.min(16, Math.round((f.w * f.d) / 14)));
        if (!v.herd) {
            v.herd = new THREE.Group();
            this.groupAt(v.zone.cx, v.zone.cz).add(v.herd);
            v.plants = [];
        }
        const ink = outline(this.theme.outline);
        while (v.plants.length < n) {
            const c = v.crop === 'wool' ? buildSheep(ink) : buildCow(ink);
            c.g.scale.setScalar(0.0001);
            v.herd.add(c.g);
            v.plants.push({ cow: c, x: f.x + 1 + Math.random() * (f.w - 2), z: f.z + 1 + Math.random() * (f.d - 2), ry: Math.random() * 6, goal: null, speed: 0, wait: Math.random() * 3, t0: this.clock + 0.3 + v.plants.length * 0.12 });
        }
    }

    // Cada vaca pasea hacia un sitio del prado al azar, se para a pacer y vuelve a andar; la ubre
    // se le hincha según madura el campo (a las ovejas, el vellón)
    updateHerd(v, dt, time, p) {
        const f = v.rect;
        for (const s of v.plants) {
            if ((s.wait -= dt) <= 0 && !s.goal) s.goal = { x: f.x + 1 + Math.random() * (f.w - 2), z: f.z + 1 + Math.random() * (f.d - 2) };
            let speed = 0;
            if (s.goal) {
                const dx = s.goal.x - s.x, dz = s.goal.z - s.z, d = Math.hypot(dx, dz);
                if (d < 0.2) {
                    s.goal = null;
                    s.wait = 1.5 + Math.random() * 4;
                } else {
                    speed = 0.8;
                    s.x += (dx / d) * speed * dt;
                    s.z += (dz / d) * speed * dt;
                    const want = Math.atan2(dx, dz);
                    s.ry += Math.atan2(Math.sin(want - s.ry), Math.cos(want - s.ry)) * Math.min(1, dt * 4);
                }
            }
            const g = s.cow.g, intro = Math.min(1, Math.max(0, (this.clock - s.t0) / 0.4));
            const w = stretchLocal(s.x, s.z);
            g.position.set(w.x, 0, w.z);
            g.rotation.y = s.ry;
            g.scale.setScalar(intro <= 0 ? 0.0001 : 0.62 * easeOutBack(intro));
            (v.crop === 'wool' ? animateSheep : animateCow)(s.cow, dt, time, speed, Math.min(1, p));
        }
    }

    // Calabazas: dos hojas grandes en el suelo y la calabaza, que sale verde y se pone naranja
    updatePumpkin(v, time, p) {
        const P = CROPS.pumpkin, [leafMesh, fruitMesh, stemMesh] = v.meshes;
        const ripe = Math.min(1, Math.max(0, (p - 0.5) / 0.5));
        v.plants.forEach((s, i) => {
            const g = this.grow(s, p), sway = Math.sin(time * 1.2 - s.x * 0.4 + s.ph) * 0.05;
            for (let k = 0; k < 2; k++) {
                const a = s.ry + k * 2.2;
                _d.position.set(s.wx + Math.sin(a) * 0.25 * g, 0.06 * g, s.wz + Math.cos(a) * 0.25 * g);
                _d.rotation.set(sway, a, 0);
                _d.scale.set(0.45 * g, Math.max(0.0001, 0.06 * g), 0.4 * g);
                _d.updateMatrix();
                leafMesh.setMatrixAt(i * 2 + k, _d.matrix);
            }
            const e = p < 0.25 ? 0.0001 : Math.min(1, (p - 0.25) / 0.4) * (0.5 + 0.5 * ripe) * g;
            _d.position.set(s.wx, 0.22 * e, s.wz);
            _d.rotation.set(0, s.ry, 0);
            _d.scale.set(0.62 * e, Math.max(0.0001, 0.44 * e), 0.62 * e);
            _d.updateMatrix();
            fruitMesh.setMatrixAt(i, _d.matrix);
            fruitMesh.setColorAt(i, _c.setHex(P.unripe).lerp(_c2.setHex(s.tone < 0.5 ? P.fruit : P.fruitDark), ripe));
            _d.position.set(s.wx, 0.46 * e + 0.04, s.wz);
            _d.scale.set(0.08 * e, Math.max(0.0001, 0.14 * e), 0.08 * e);
            _d.updateMatrix();
            stemMesh.setMatrixAt(i, _d.matrix);
        });
    }

    // Maíz: cañas altas que se mecen, una hoja y la mazorca (amarilla al madurar)
    updateCorn(v, time, p) {
        const C = CROPS.corn, [stalkMesh, leafMesh, cobMesh] = v.meshes;
        const ripe = p >= 1, st = ripe ? 3 : p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
        v.plants.forEach((s, i) => {
            const h = s.h * 1.7 * this.grow(s, p);
            const sway = Math.sin(time * 1.3 - s.x * 0.4 - s.z * 0.2 + s.ph * 0.3) * 0.07;
            _d.position.set(s.wx - Math.sin(sway) * h / 2, Math.cos(sway) * h / 2, s.wz);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.08, Math.max(0.0001, h), 0.08);
            _d.updateMatrix();
            stalkMesh.setMatrixAt(i, _d.matrix);
            stalkMesh.setColorAt(i, _c.setHex(C.stages[st]).offsetHSL(0, 0, (s.tone - 0.5) * 0.08));
            for (let k = 0; k < 2; k++) {
                const a = s.ry + k * Math.PI, y = h * (0.4 + k * 0.25);
                _d.position.set(s.wx + Math.sin(a) * 0.14 - Math.sin(sway) * y, y, s.wz + Math.cos(a) * 0.14);
                _d.rotation.set(0, a, 0.7 * (k ? -1 : 1));
                _d.scale.set(0.05, Math.max(0.0001, 0.38 * h / 1.6), 0.12);
                _d.updateMatrix();
                leafMesh.setMatrixAt(i * 2 + k, _d.matrix);
            }
            const e = p < 0.6 ? 0.0001 : Math.min(1, (p - 0.6) / 0.4);
            _d.position.set(s.wx + Math.sin(s.ry) * 0.08 - Math.sin(sway) * h * 0.65, h * 0.65, s.wz + Math.cos(s.ry) * 0.08);
            _d.rotation.set(0, s.ry, 0.3);
            _d.scale.set(0.1 * e, Math.max(0.0001, 0.24 * e), 0.1 * e);
            _d.updateMatrix();
            cobMesh.setMatrixAt(i, _d.matrix);
            cobMesh.setColorAt(i, _c.setHex(ripe ? C.fruit : C.unripe));
        });
    }

    // Punto en el mundo sobre el centro de un campo (para su cartel y su burbuja)
    fieldTop(id, out = new THREE.Vector3()) {
        const v = this.fields[id], f = v.rect;
        return this.world(f.cx, v.locked ? (v.barrelTop || 1) + 0.6 : 1.4, f.cz, out);
    }
}
