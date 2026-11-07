import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { buildScenery, updateScenery } from './Scenery.js';
import { easeOutBack } from '../core/math.js';
import { STRUCTURES, Turret, Sandbags, LandPost } from '../render/structures.js';
import { Plot } from '../render/props.js';
import { MerchantCamp } from '../render/merchant.js';
import { MERCHANT } from '../content/merchant.js';
import { junkyard, barrelParts, JUNK } from '../render/junk.js';
import { CROPS } from '../content/crops.js';
import { buildCow, animateCow } from '../render/cow.js';
import { FARM, TURRETS, PLACES, toWorld, worldToPlace, inShapeOf, inFieldShape } from '../content/farm.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _p = new THREE.Vector3();
const INTRO_TIME = 2.2;
const PER_TILE = 3; // tallos de trigo por lado de cada casilla de campo

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
const kindKey = (k) => (!k ? '' : k.field ? (k.locked ? 'junk' : 'field') : k.path ? 'path' : k.yard ? 'yard' : k.wild ? 'wild' : 'b');
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
        // La mitad del granero: su recinto (limpio) y lo que queda abandonado alrededor
        if (inRect(this.zone, c, r)) return inRect(this.yard, c, r) ? { yard: true } : { wild: true };
        // La parcela de la casa: lo que aún no se ha limpiado está abandonado
        if (inRect(this.houseZone, c, r) && !inRect(this.houseYard, c, r)) return { wild: true };
        // El bosque del comerciante: su claro (limpio) y el resto, bosque
        if (inRect(this.villageZone, c, r)) return inRect(this.villageYard, c, r) ? { yard: true } : { wild: true };
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

        // Casillas: hierba, caminos, tierra arada en surcos y tierra sucia de los terrenos
        // abandonados. Las de las parcelas y las de los caminos que salen de ellas
        const tiles = [], B = FARM.bounds;
        const xMax = Math.max(B.x1, ...FARM.paths.map((p) => p[2])), zMax = Math.max(B.z1, ...FARM.paths.map((p) => p[3]));
        for (let r = B.z0; r < zMax; r++) for (let c = B.x0; c < xMax; c++) {
            const k = this.kindAt(c, r);
            if ((inParcel(c, r) && inShapeOf(c + 0.5, r + 0.5)) || (k && k.path)) tiles.push({ c, r, k });
        }
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), toon(0xffffff), tiles.length);
        tiles.forEach((t, i) => this.paintTile(floor, t, i));
        this.floor = { tiles, entry: this.addAnimated(floor, tiles.map(({ c, r, k }) => ({ x: c + 0.5, y: this.tileY(k), z: r + 0.5 }))) };

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
            model.root.position.set(s.x, 0, s.z);
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
        // Parcelas en venta: su poste de SE VENDE (o tu bandera) y su sombra
        this.landPosts = Object.fromEntries(FARM.lands.map((l) => {
            const post = new LandPost(theme.outline, !!l.soon);
            post.root.position.set(l.post.x, 0, l.post.z);
            // (de cara hacia fuera de su parcela)
            post.root.rotation.y = Math.atan2(l.post.x - (l.rect[0] + l.rect[2]) / 2, l.post.z - (l.rect[1] + l.rect[3]) / 2);
            post.setOwned(this.landOwned[l.id], false);
            this.groupAt(l.post.x + (l.post.x < 0 ? 0.5 : -0.5), l.post.z).add(post.root);
            return [l.id, post];
        }));
        this.initShade();
    }

    tileY(k) {
        return k && k.field ? -0.12 : k && k.path ? -0.17 : -0.15;
    }

    paintTile(mesh, { c, r, k }, i) {
        const { theme } = this;
        const col = k && k.field
            ? (k.locked ? JUNK.ground[mod(c * 7 + r * 5 + mod(c * r, 3), JUNK.ground.length)]
                : CROPS[this.fields[k.field].crop].pasture ? PASTURE[mod(c * 3 + r * 5, 3)] : theme.soil[r & 1]) // (el prado, de hierba)
            : k && k.path ? theme.path[mod(c * 7 + r * 3, 2)]
            : k && k.wild ? JUNK.ground[mod(c * 5 + r * 7 + mod(c * r, 3), JUNK.ground.length)]
            : k && k.yard ? YARD[mod(c + r, 2)] : theme.grass[mod(c * 5 + r * 3 + mod(c * r, 3), 3)];
        _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter);
        // (su color de verdad se guarda: si es de una parcela sin comprar, se ve en sombra)
        const t = this.floor ? this.floor.tiles[i] : null;
        if (t) t.col = [_c.r, _c.g, _c.b];
        mesh.setColorAt(i, t ? this.shadeColor(t.col, t.land, c + 0.5, r + 0.5) : _c);
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
        this.floor.tiles.forEach((t, i) => {
            const l = landAt(t.c + 0.5, t.r + 0.5);
            t.land = l ? l.id : null;
            const a = this.floor.entry.mesh.instanceColor.array;
            t.col = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
        });
        this.shaded = [];
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
        const floor = this.floor.entry.mesh;
        this.floor.tiles.forEach((t, i) => {
            if (t.land) floor.setColorAt(i, this.shadeColor(t.col, t.land, t.c + 0.5, t.r + 0.5));
        });
        floor.instanceColor.needsUpdate = true;
        // El margen de su zona (fuera del cuadrado de la parcela), igual
        if (this.margin) {
            for (const m of this.margin.cells) this.margin.mesh.setColorAt(m.i, this.shadeColor(!m.field || this.fields[m.field].locked ? m.wild : m.col, m.land, m.lx, m.lz));
            this.margin.mesh.instanceColor.needsUpdate = true;
        }
        for (const { e, lands, base } of this.shaded) {
            e.positions.forEach((p, i) => {
                if (!lands[i]) return;
                e.mesh.setColorAt(i, this.shadeColor([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], lands[i], p.x, p.z));
            });
            e.mesh.instanceColor.needsUpdate = true;
        }
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
        for (const e of this.hints || []) e.positions.forEach((p) => (p.hide = p.hide || !this.fields[p.field].locked));
        for (const e of [entry, ...this.decor, ...this.wild, ...(this.hints || [])]) this.layout(e, this.introT);
        if (this.margin) this.applyShade(); // (el margen de una parcela recién limpiada, de hierba)
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

    // ¿Ya está limpio este punto? (dentro del recinto del granero o de un campo)
    cleared(x, z) {
        return inRect(this.yard, x, z, 0.6) || inRect(this.houseYard, x, z, 0.4) || inRect(this.villageYard, x, z, 0.4) || this.views.some((v) => inRect(v.rect, x, z, 0.5))
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
        const trees = [], bush = [], pieces = [], rocks = [];
        const taken = []; // [x, z, radio]: árboles, matas y piedras sin meterse unos en otros
        const zones = [{ Z: this.zone, k: 1 }, { Z: this.houseZone, k: 0.8 }, { Z: this.villageZone, k: 1.6, forest: true }, ...this.views.map((v) => ({ Z: v.zone, k: 0.55 })), ...FARM.lands.map((l) => ({ Z: rectOf(l.rect), k: l.soon ? 0.3 : 0.5 }))];
        for (const { Z, k, forest } of zones) {
            const free = (x, z, m) => inRect(Z, x, z) && inShapeOf(x, z) && !taken.some(([a, b, r]) => Math.hypot(a - x, b - z) < r + m) && !this.hintSpots.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < m + 0.8) && !inRect(this.yard, x, z, m) && !inRect(this.houseYard, x, z, m) && !inRect(this.villageYard, x, z, m) && !this.views.some((v) => inRect(v.rect, x, z, m))
                && !FARM.paths.some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)
                && !FARM.structures.some((st) => Math.abs(x - st.x) < st.w / 2 + m && Math.abs(z - st.z) < st.d / 2 + m)
                && !FARM.lands.some((l) => Math.hypot(x - l.post.x, z - l.post.z) < m + 1.2); // (ni sobre su poste)
            const spots = (n, m) => {
                const out = [];
                for (let j = 0, tries = 0; j < n && tries < n * 30; tries++) {
                    const x = Z.x + Math.random() * Z.w, z = Z.z + Math.random() * Z.d;
                    if (!free(x, z, m)) continue;
                    out.push([x, z]);
                    taken.push([x, z, m]);
                    j++;
                }
                return out;
            };
            // Cantidades según el tamaño de la zona (k: en los campos, algo menos de árbol)
            const area = Z.w * Z.d;
            trees.push(...spots(Math.round(area * 0.18 * k), 1.05));
            bush.push(...spots(Math.round(area * 0.28), 0.45).map(([x, z]) => ({ x, y: 0.22, z, sx: 0.7 + Math.random() * 0.5, sy: 0.44, sz: 0.6 + Math.random() * 0.4, ry: Math.random() * 3 })));
            // El bosque del comerciante: solo árboles, matorral y piedras (sin chatarra)
            if (!forest) pieces.push(...junkyard({ x0: Z.x, z0: Z.z, x1: Z.x + Z.w, z1: Z.z + Z.d, px: 9999, pz: 9999, count: Math.round(area * 0.3), s: 0.42, layers: [], inside: (x, z) => free(x, z, 0.4) }).pieces);
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
        const f = v.rect, wheat = v.crop === 'wheat', n = { wheat: PER_TILE, corn: 2 }[v.crop] || 1;
        const prev = new Map(v.plants.map((s) => [s.key, s]));
        v.plants = [];
        for (let a = 0; a < f.w * n; a++) for (let b = 0; b < f.d * n; b++) {
            const key = `${f.x * n + a},${f.z * n + b}`;
            const x = f.x + (a + 0.5) / n, z = f.z + (b + 0.5) / n;
            if (!this.inField(v, Math.floor(x) + 0.5, Math.floor(z) + 0.5) || !inShapeOf(x, z)) continue; // (su forma)
            const keep = prev.get(key);
            if (keep) {
                v.plants.push(keep);
                continue;
            }
            const j = wheat ? 0.12 : n > 1 ? 0.15 : 0.2;
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
            const b = new Sandbags(this.theme.outline);
            b.root.position.set(x, 0, z);
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
    // onTurretHit(x, z, n)
    updateTurrets(v, dt, ripe) {
        const t = v.turret;
        t.update(dt);
        if (t.hopping) return;
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
            t.aimAt(s.x, s.z, 1.3);
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
                const w = toWorld(p.x, p.z, p.y - (1 - k) * 3);
                _d.position.set(w.x, w.y, w.z);
                turn = w.place ? (w.place.rot || 0) * (Math.PI / 2) : 0; // girado como su parcela
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
        const hits = ray.intersectObjects(this.structures.map((m) => m.root), true);
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
        this.plot.update(dt, time);
        updateScenery(this, dt);
        this.camp.update(dt, time, this.nightK || 0);
        for (const post of Object.values(this.landPosts)) post.update(dt, time);
        this.updateLandWaves(dt);
        this.updateShots(dt);

        for (const v of this.views) {
            if (v.locked) continue;
            if (v.drop) this.updateDrop(v, dt);
            else if (v.turret) this.updateTurrets(v, dt, (progress[v.id] || 0) >= 1);
            const p = progress[v.id] || 0;
            if (v.crop === 'wheat') this.updateWheat(v, time, p);
            else if (v.crop === 'pumpkin') this.updatePumpkin(v, time, p);
            else if (v.crop === 'corn') this.updateCorn(v, time, p);
            else if (v.herd) this.updateHerd(v, dt, time, p);
            else this.updateTomato(v, time, p);
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

    // El prado de las vacas: una vaca cada pocas casillas (más pequeñas que en el campo de tiro),
    // paseando y paciendo por su campo. v.plants son ellas (la torreta les dispara)
    buildHerd(v) {
        const f = v.rect, n = Math.max(2, Math.min(16, Math.round((f.w * f.d) / 14)));
        if (!v.herd) {
            v.herd = new THREE.Group();
            this.groupAt(v.zone.cx, v.zone.cz).add(v.herd);
            v.plants = [];
        }
        const ink = outline(this.theme.outline);
        while (v.plants.length < n) {
            const c = buildCow(ink);
            c.g.scale.setScalar(0.0001);
            v.herd.add(c.g);
            v.plants.push({ cow: c, x: f.x + 1 + Math.random() * (f.w - 2), z: f.z + 1 + Math.random() * (f.d - 2), ry: Math.random() * 6, goal: null, speed: 0, wait: Math.random() * 3, t0: this.clock + 0.3 + v.plants.length * 0.12 });
        }
    }

    // Cada vaca pasea hacia un sitio del prado al azar, se para a pacer y vuelve a andar; la ubre
    // se le hincha según madura el campo
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
            g.position.set(s.x, 0, s.z);
            g.rotation.y = s.ry;
            g.scale.setScalar(intro <= 0 ? 0.0001 : 0.62 * easeOutBack(intro));
            animateCow(s.cow, dt, time, speed, Math.min(1, p));
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
                _d.position.set(s.x + Math.sin(a) * 0.25 * g, 0.06 * g, s.z + Math.cos(a) * 0.25 * g);
                _d.rotation.set(sway, a, 0);
                _d.scale.set(0.45 * g, Math.max(0.0001, 0.06 * g), 0.4 * g);
                _d.updateMatrix();
                leafMesh.setMatrixAt(i * 2 + k, _d.matrix);
            }
            const e = p < 0.25 ? 0.0001 : Math.min(1, (p - 0.25) / 0.4) * (0.5 + 0.5 * ripe) * g;
            _d.position.set(s.x, 0.22 * e, s.z);
            _d.rotation.set(0, s.ry, 0);
            _d.scale.set(0.62 * e, Math.max(0.0001, 0.44 * e), 0.62 * e);
            _d.updateMatrix();
            fruitMesh.setMatrixAt(i, _d.matrix);
            fruitMesh.setColorAt(i, _c.setHex(P.unripe).lerp(_c2.setHex(s.tone < 0.5 ? P.fruit : P.fruitDark), ripe));
            _d.position.set(s.x, 0.46 * e + 0.04, s.z);
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
            _d.position.set(s.x - Math.sin(sway) * h / 2, Math.cos(sway) * h / 2, s.z);
            _d.rotation.set(0, 0, sway);
            _d.scale.set(0.08, Math.max(0.0001, h), 0.08);
            _d.updateMatrix();
            stalkMesh.setMatrixAt(i, _d.matrix);
            stalkMesh.setColorAt(i, _c.setHex(C.stages[st]).offsetHSL(0, 0, (s.tone - 0.5) * 0.08));
            for (let k = 0; k < 2; k++) {
                const a = s.ry + k * Math.PI, y = h * (0.4 + k * 0.25);
                _d.position.set(s.x + Math.sin(a) * 0.14 - Math.sin(sway) * y, y, s.z + Math.cos(a) * 0.14);
                _d.rotation.set(0, a, 0.7 * (k ? -1 : 1));
                _d.scale.set(0.05, Math.max(0.0001, 0.38 * h / 1.6), 0.12);
                _d.updateMatrix();
                leafMesh.setMatrixAt(i * 2 + k, _d.matrix);
            }
            const e = p < 0.6 ? 0.0001 : Math.min(1, (p - 0.6) / 0.4);
            _d.position.set(s.x + Math.sin(s.ry) * 0.08 - Math.sin(sway) * h * 0.65, h * 0.65, s.z + Math.cos(s.ry) * 0.08);
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
