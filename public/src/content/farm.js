import { L } from '../core/I18n.js';
import { REGIONS, G, GN, cellX, cellZ, regionAt, toUV, toXZ, VW, VH } from '../world/valley.js';

// Plano de la granja (en casillas). Cada edificio se puede tocar para ver su ficha.
//   kind      modelo que se construye (render/structures.js)
//   x, z      centro; w, d: huella en casillas (para tocarlo y para el camino)
//   ry        giro en cuartos de vuelta
export const FARM = {
    size: 30, // casillas de lado de cada parcela (el césped sigue hasta el horizonte)
    // Parcelas valladas [x0, z0, x1, z1): la de los campos y, detrás del granero, la de la casa
    parcels: [
        [0, 0, 30, 30],
        [0, -30, 30, 0],
        [30, -30, 60, 0], // el claro del mercader
        [90, 0, 120, 30], // el trigo (en su zona)
        [90, 30, 120, 60], // los tomates (en la suya)
    ],
    // Las demás parcelas de la cuadrícula de 3×3 (la de los campos, con el granero, en el
    // centro). Las que se compran con el oro del comerciante (price) empiezan abandonadas (árboles,
    // matorral y chatarra) con su cartel de EN VENTA; una vez compradas se desbloquean como
    // cualquier terreno (disparando al barril de su campo) y queda limpia, con el campo de su
    // cultivo nuevo (field). Las de soon, de momento abandonadas y sin nada que desbloquear.
    // Sin comprar se ven oscuras (como en sombra) y con su poste (SE VENDE o PRONTO); al comprarla
    // la oscuridad se retira en una onda desde el poste, que salta, y queda tu bandera.
    //   price   monedas de oro que cuesta
    //   post    dónde está el poste (y luego la bandera): se calcula al repartir el valle (abajo)
    lands: [
        { id: 'west', rect: [-30, 0, 0, 30], price: 15, field: 'pumpkin', name: L('WEST PLOT', 'PARCELA OESTE') },
        { id: 'east', rect: [30, 0, 60, 30], price: 25, field: 'corn', name: L('EAST PLOT', 'PARCELA ESTE') },
        { id: 'nw', rect: [-30, -30, 0, 0], price: 40, field: 'milk', name: L('NORTH-WEST PLOT', 'PARCELA NOROESTE') },
        { id: 'sw', rect: [-30, 30, 0, 60], soon: true },
        { id: 'south', rect: [0, 30, 30, 60], soon: true },
        { id: 'se', rect: [30, 30, 60, 60], soon: true },
        // Las otras mitades de la orilla alta, la cañada y la parcela de abajo: para lo que venga
        { id: 'nw2', rect: [60, -30, 90, 0], soon: true },
        { id: 'west2', rect: [60, 0, 90, 30], soon: true },
        { id: 'east2', rect: [60, 30, 90, 60], soon: true },
    ],
    bounds: { x0: -30, z0: -30, x1: 120, z1: 60 }, // todas las parcelas (en sus coordenadas de siempre)
    // Vallas: tramos rectos de [x, z] a [x, z]; gap: hueco [desde, hasta] a lo largo del tramo
    // (las de la cuadrícula, con sus portones, al final del archivo)
    fences: [],
    // El granero (armamento: rachas de bajas y mejoras del rifle) y su recinto militar, que llena
    // toda su zona: tierra apisonada (zone/yard) con un borde de hierba, la pista con el avión y su
    // hangar (strip), y las plataformas de hormigón (pads) de la nuclear, la armería y el
    // helipuerto. Lo que hay en el recinto, en compound (render/compound.js). Ya no se mejora: sus
    // niveles se quedan por las partidas guardadas.
    barn: {
        zone: [1, 1, 29, 29],
        levels: [
            { yard: [1, 1, 29, 29] },
            { yard: [1, 1, 29, 29], cost: { wheat: 5 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 15 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 30 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 40, tomato: 15 } },
            { yard: [1, 1, 29, 29], cost: { wheat: 60, tomato: 30 } },
        ],
        strip: [9, 20, 28, 24],
        pads: [[3, 3, 10, 9], [20, 3, 27, 9], [2.5, 9.5, 8.5, 15]],
    },
    // Lo del recinto del granero: kind (la pieza de render/compound.js), x, z (su centro, en las
    // coordenadas de la parcela; en el mapa se reparte estirado por toda la zona) y ry (cuartos de vuelta)
    compound: [
        { kind: 'nuke', x: 6.5, z: 6 },
        { kind: 'armory', x: 23.5, z: 6 },
        { kind: 'radar', x: 11, z: 4 },
        { kind: 'heli', x: 5.5, z: 12.3 },
        { kind: 'camp', x: 24.5, z: 12.5 },
        { kind: 'hangar', x: 5, z: 22 },
        { kind: 'plane', x: 20, z: 22 },
        { kind: 'checkpoint', x: 15, z: 27.3 },
        { kind: 'depot', x: 26.5, z: 26.5 },
        { kind: 'depot', x: 3.5, z: 26.8, ry: 1 },
    ],
    // La casa y su parcela: empieza en ruinas con toda la parcela abandonada (zone). Nivel 1: la
    // casita arreglada y limpio alrededor; 2: gran parte de la parcela; 3: toda (clear).
    //   cost   lo que cuesta llegar a ese nivel
    house: {
        zone: [0, -30, 30, 0], // (toda la parcela: en el mapa llena su zona)
        levels: [
            { clear: null },
            { clear: [10, -20, 21, -10], cost: { wheat: 8 } },
            { clear: [4, -26, 26, -4], cost: { wheat: 20 } },
            { clear: [0, -30, 30, 0], cost: { wheat: 35, tomato: 10 } },
        ],
    },
    structures: [
        { id: 'barn', kind: 'barn', x: 15, z: 12, w: 5, d: 4, ry: 0, name: L('BARN', 'GRANERO') },
        { id: 'silo', kind: 'silo', x: 19.6, z: 11, w: 2, d: 2, name: L('SILO', 'SILO') },
        { id: 'house', kind: 'house', x: 15, z: -15, w: 4, d: 4, ry: 0, name: L('FARMHOUSE', 'CASA') }, // en el centro de su parcela
        { id: 'tractor', kind: 'tractor', x: 10.6, z: 13.4, w: 2, d: 3, ry: 1, name: L('TRACTOR', 'TRACTOR') }, // junto al granero
    ],
    // Campos de cultivo. Cada uno crece al mejorarlo desde una esquina fija (corner) hacia
    // los lados que marcan dx, dz (+1 / -1).
    //   cost      lo que cuesta cada mejora, por recurso
    //   locked    empieza como un terreno abandonado lleno de chatarra que se desbloquea
    //             disparando al barril rojo; con `after`, solo cuando ese campo está al máximo; con
    //             `land`, cuando se ha comprado esa parcela
    //   levels    w, d: tamaño en casillas (en el mapa); sheaves: blancos en el campo de tiro;
    //             arena: tamaño del campo de tiro (1 = el normal); sign: color del cartel.
    //             El nivel 1 apenas cambia; los altos tienen un campo de tiro mucho mayor y lleno
    //   turrets   lo que cuesta la torreta automática, la mejora extra con el campo al máximo:
    //             una torreta que va de esquina en esquina y lo recoge sola (ver TURRETS)
    fields: [
        {
            id: 'wheat',
            crop: 'wheat',
            name: L('WHEAT FIELD', 'CAMPO DE TRIGO'),
            corner: { x: 105, z: 15, center: true }, // crece desde el centro de su parcela
            cost: { wheat: 3 },
            turrets: { wheat: 40 },
            // Lo primero del juego: limpiar este terreno para poder sembrar trigo
            locked: { barn: true, name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena su zona entera
            levels: [
                { w: 8, d: 6, sheaves: 18, arena: 1, sign: 0x9a6a3a },
                { w: 12, d: 10, sheaves: 36, arena: 1.2, sign: 0xb07a44 },
                { w: 17, d: 15, sheaves: 64, arena: 1.45, sign: 0x5a9e32 },
                { w: 22, d: 21, sheaves: 100, arena: 1.75, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 150, arena: 2.1, sign: 0xc8402e },
            ],
        },
        {
            id: 'tomato',
            crop: 'tomato',
            name: L('TOMATO FIELD', 'CAMPO DE TOMATES'),
            corner: { x: 105, z: 45, center: true }, // crece desde el centro de su parcela
            cost: { wheat: 5, tomato: 3 },
            turrets: { wheat: 40, tomato: 25 },
            locked: { after: 'wheat', name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena su zona entera
            levels: [
                { w: 7, d: 6, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 11, d: 10, sheaves: 12, arena: 1.2, sign: 0xb07a44 },
                { w: 16, d: 15, sheaves: 22, arena: 1.45, sign: 0x5a9e32 },
                { w: 22, d: 20, sheaves: 36, arena: 1.75, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 56, arena: 2.1, sign: 0xc8402e },
            ],
        },
        // Los de las parcelas que se compran (con su cultivo nuevo y su forma de disparar)
        // Los de las parcelas que se compran (con su cultivo nuevo y su forma de disparar). Al nivel
        // máximo ocupan casi toda su parcela (con un margen de aire)
        {
            id: 'pumpkin',
            crop: 'pumpkin',
            name: L('PUMPKIN PATCH', 'CAMPO DE CALABAZAS'),
            corner: { x: -15, z: 15, center: true }, // crece desde el centro de su parcela
            cost: { wheat: 8, pumpkin: 2 },
            turrets: { wheat: 40, pumpkin: 10 },
            locked: { land: 'west', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 10, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 15, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 22, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 32, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'corn',
            crop: 'corn',
            name: L('CORN FIELD', 'CAMPO DE MAÍZ'),
            corner: { x: 45, z: 15, center: true },
            cost: { wheat: 6, corn: 5 },
            turrets: { wheat: 40, corn: 30 },
            locked: { land: 'east', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 16, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 30, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 52, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 84, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 140, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'milk',
            crop: 'milk',
            name: L('COW PASTURE', 'PRADO DE VACAS'),
            corner: { x: -15, z: -15, center: true },
            cost: { wheat: 10, milk: 3 },
            turrets: { wheat: 40, milk: 12 },
            locked: { land: 'nw', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: vacas del campo de tiro (un cubo cada una)
            levels: [
                { w: 6, d: 5, sheaves: 4, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 6, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 9, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 13, arena: 1.9, sign: 0x3a7ec8 },
                { w: 28, d: 28, sheaves: 18, arena: 2.4, sign: 0xc8402e },
            ],
        },
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 14, 16, 30],   // del portón del granero al sur (cruza la pista)
        [0, 16, 30, 17],    // de oeste a este, delante del granero
        [14, 0, 16, 9],     // a la trasera del granero (sale por el norte)
        [14, -13, 16, 0],   // de la casa hacia la granja (sale por el sur)
        [17, -16, 30, -14], // de la casa hacia el este
        [0, -16, 13, -14],  // de la casa hacia el oeste
    ],
};

// Torreta automática de un campo (mejora extra con el campo al máximo): una sola, que va de
// esquina en esquina (salta cada hop s a la de al lado, nunca en diagonal, como el tirador entre torres). Dispara a ráfagas (burst
// balas, una cada rate s) como una ametralladora. En el mapa, plantada en unos sacos en cada
// esquina, recoge sola lo que esté maduro, una mata cada every s (mientras el juego está
// abierto), y entre tanto no para de tirotear el campo. En el campo de tiro va de un mástil a
// otro (de alto mast, en cada torre menos la tuya): acribilla una mata con una ráfaga y la
// recoge, descansa cool s y a por otra. Lo que recoge no suma a las rachas.
// Munición: ammo matas recogidas (en el mapa y en el campo de tiro) y se queda sin balas, quieta
// hasta que se recargue en el panel del campo pagando reload monedas de oro (las de cartón del
// mercader; a medio gastar, la parte que falta, al menos 1).
export const TURRETS = { every: 4, cool: 0.7, burst: 6, rate: 0.075, aim: 0.35, mast: 2.4, hop: 7, ammo: 60, reload: 6 };

// Fichas de los edificios: un texto corto debajo del nombre
export const INFO = {
    silo: L('GRAIN SILO. KEEPS THE HARVEST DRY.', 'SILO DE GRANO. MANTIENE SECA LA COSECHA.'),
    house: L('HOME SWEET HOME.', 'HOGAR, DULCE HOGAR.'),
    tractor: L('READY TO PLOUGH.', 'LISTO PARA ARAR.'),
};

export const FIELD_BY_ID = Object.fromEntries(FARM.fields.map((f) => [f.id, f]));

export const LAND_BY_ID = Object.fromEntries(FARM.lands.map((l) => [l.id, l]));

// Vallas de la cuadrícula de 3×3 parcelas: cada lado de 30 casillas, con un portón (hueco) donde
// pasa un camino. [eje de la línea, dónde está, hueco desde, hasta]
const GRID = [-30, 0, 30, 60];
const GATES = [
    ['x', 0, 14, 17],    // a la parcela oeste
    ['x', 0, -16, -14],  // al prado de vacas
    ['x', 30, 14, 17],   // a la parcela este
    ['x', 30, -16, -14], // el camino al claro del comerciante
    ['z', 0, 14, 16],    // entre los campos y la casa
    ['z', 30, 14, 16],   // el camino principal
    ['z', 60, 14, 16],   // ... que sigue hacia fuera
];
for (const v of GRID) {
    for (let k = 0; k < 3; k++) {
        const a0 = GRID[k], a1 = GRID[k + 1];
        const gate = (ax) => GATES.find(([e, at, g0, g1]) => e === ax && at === v && g0 >= a0 && g1 <= a1);
        const gx = gate('x'), gz = gate('z');
        FARM.fences.push({ from: [v, a0], to: [v, a1], ...(gx ? { gap: [gx[2], gx[3]] } : {}) });
        FARM.fences.push({ from: [a0, v], to: [a1, v], ...(gz ? { gap: [gz[2], gz[3]] } : {}) });
    }
}

// ---------- Composición del mapa ----------
// Cada parcela de 30×30 casillas guarda su lógica en sus coordenadas de siempre (from: su esquina
// en la cuadrícula de antes), pero en el mapa rellena su zona entera del valle (world/valley.js):
// su centro va al punto más hondo de la zona y desde ahí se estira (o se encoge) en cada dirección
// hasta el borde de la zona. Lo de cerca del centro (el granero, la casa, el cruce) queda tal cual;
// lo de fuera se reparte hasta el borde. En el campo de tiro todo sigue siendo cuadrado.
//   gates  por dónde salen sus caminos (en sus coordenadas de siempre, en su borde)
export const PLACES = [
    { id: 'farm', from: [0, 0], gates: [[15, 30], [0, 16.5], [30, 16.5], [15, 0]] },
    { id: 'wheatP', from: [90, 0], gates: [] },
    { id: 'tomatoP', from: [90, 30], gates: [] },
    { id: 'house', from: [0, -30], gates: [[15, 0], [30, -15], [0, -15]] },
    { id: 'merchant', from: [30, -30], gates: [] },
    { id: 'west', from: [-30, 0], gates: [] },
    { id: 'east', from: [30, 0], gates: [] },
    { id: 'nw', from: [-30, -30], gates: [] },
    { id: 'south', from: [0, 30], gates: [] },
    { id: 'se', from: [30, 30], gates: [] },
    { id: 'sw', from: [-30, 30], gates: [] },
    { id: 'nw2', from: [60, -30], gates: [] },
    { id: 'west2', from: [60, 0], gates: [] },
    { id: 'east2', from: [60, 30], gates: [] },
];
const NA = 96; // direcciones en las que se mide la zona desde su centro
{
    // Lo lejos que está cada celda del borde de su zona (para buscar el centro de cada una)
    const N = GN * GN, depth = new Int16Array(N).fill(-1), q = [];
    for (let k = 0; k < N; k++) {
        if (G.reg[k] < 0 || G.water[k]) continue;
        const i = k % GN, nb = [i > 0 ? k - 1 : -1, i < GN - 1 ? k + 1 : -1, k - GN, k + GN];
        if (nb.some((j) => j < 0 || j >= N || G.reg[j] !== G.reg[k] || G.water[j])) { depth[k] = 0; q.push(k); }
    }
    for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi], i = k % GN;
        for (const j of [i > 0 ? k - 1 : -1, i < GN - 1 ? k + 1 : -1, k - GN, k + GN]) {
            if (j < 0 || j >= N || depth[j] >= 0 || G.reg[j] !== G.reg[k] || G.water[j]) continue;
            depth[j] = depth[k] + 1;
            q.push(j);
        }
    }
    for (const P of PLACES) {
        P.ri = REGIONS.findIndex((r) => r.place === P.id);
        P.rot = 0;
        const R = REGIONS[P.ri], [sx, sz] = toXZ(...R.seeds[0]);
        // El centro: la celda más honda (y, entre las igual de hondas, la más cerca de su semilla)
        let best = -1, bs = -Infinity;
        for (let k = 0; k < N; k++) {
            if (G.reg[k] !== P.ri || G.water[k]) continue;
            const sc = depth[k] - Math.hypot(cellX(k) - sx, cellZ(k) - sz) * 0.02;
            if (sc > bs) { bs = sc; best = k; }
        }
        P.c = [cellX(best), cellZ(best)];
        P.at = [P.c[0] - 15, P.c[1] - 15];
        P.h = R.h;
        // Hasta dónde llega la zona en cada dirección (sin pasarse: el mínimo con las de al lado)
        const raw = [];
        for (let a = 0; a < NA; a++) {
            const ang = (a / NA) * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
            let t = 0;
            while (t < 90 && regionAt(P.c[0] + dx * t, P.c[1] + dz * t) === P.ri) t += 0.5;
            raw.push(Math.max(2, t - 0.6));
        }
        P.reach = raw.map((_, a) => Math.min(...[-1, 0, 1].map((d) => raw[(a + d + NA) % NA])));
        // Lo de dentro de este radio queda sin estirar (el granero, la casa, el cruce de caminos)
        P.core = Math.min(6, Math.min(...P.reach) * 0.6);
    }
}
// Cuánto llega la zona de P en la dirección ang (interpolado entre las medidas)
function reachAt(P, ang) {
    const f = ((ang / (Math.PI * 2)) * NA + NA) % NA, i = Math.floor(f), k = f - i;
    return P.reach[i] * (1 - k) + P.reach[(i + 1) % NA] * k;
}
// Del cuadrado a la zona: un desplazamiento (dx, dz) desde el centro del cuadrado, en el mundo
function stretch(P, dx, dz, inverse = false) {
    const d = Math.hypot(dx, dz);
    if (d <= P.core) return [dx, dz];
    const ang = Math.atan2(dz, dx), sq = 15 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))), r = reachAt(P, ang);
    const d2 = inverse ? P.core + ((d - P.core) * (sq - P.core)) / (r - P.core) : P.core + ((d - P.core) * (r - P.core)) / (sq - P.core);
    return [(dx / d) * d2, (dz / d) * d2];
}
const placeOf = (x, z) => PLACES.find(({ from: [x0, z0] }) => x >= x0 && x < x0 + 30 && z >= z0 && z < z0 + 30);
// Un punto de la parcela P (en sus coordenadas de siempre), en el mundo: estirado hasta su zona
export function placeToWorld(P, x, z, y = 0) {
    const [dx, dz] = stretch(P, x - P.from[0] - 15, z - P.from[1] - 15);
    return { x: P.c[0] + dx, y: y + P.h, z: P.c[1] + dz, place: P };
}
// Y al revés: un punto del mundo, en las coordenadas de siempre de la parcela P
export function worldToPlace(P, x, z) {
    const [dx, dz] = stretch(P, x - P.c[0], z - P.c[1], true);
    return { x: P.from[0] + 15 + dx, z: P.from[1] + 15 + dz };
}
// Lo que se cuelga del grupo de una parcela (que solo la lleva a su sitio, sin estirar): dónde
// tiene que ir dentro del grupo un punto de sus coordenadas de siempre para caer donde toca
export function stretchLocal(x, z) {
    const P = placeOf(x, z);
    if (!P) return { x, z };
    const [dx, dz] = stretch(P, x - P.from[0] - 15, z - P.from[1] - 15);
    return { x: P.from[0] + 15 + dx, z: P.from[1] + 15 + dz };
}
// De las coordenadas de siempre (de una parcela) al mundo (fuera de las parcelas, tal cual)
export function toWorld(x, z, y = 0) {
    const P = placeOf(x, z);
    return P ? placeToWorld(P, x, z, y) : { x, y, z, place: null };
}
// La parcela que cubre un punto del mundo: la de su zona (los rincones a los que no llega su
// cuadrado estirado toman lo de su borde más cercano)
export function floorPlace(x, z) {
    const ri = regionAt(x, z);
    return ri < 0 ? null : PLACES.find((p) => p.ri === ri) || null;
}
// Una puerta de una parcela, en el mundo, y hacia dónde sale (ox, oz)
export function gateWorld(id, i) {
    const P = PLACES.find((p) => p.id === id), [gx, gz] = P.gates[i];
    const lx = gx - P.from[0], lz = gz - P.from[1];
    const ox = lx <= 0 ? -1 : lx >= 30 ? 1 : 0, oz = lz <= 0 ? -1 : lz >= 30 ? 1 : 0;
    const w = placeToWorld(P, gx - ox * 0.01, gz - oz * 0.01);
    return { x: w.x, z: w.z, y: P.h, ox, oz };
}
// ¿Este punto (en las coordenadas de siempre) es de su parcela? (ahora la parcela entera cae en su zona)
export function inShapeOf() {
    return true;
}
// El poste de cada parcela en venta: a un lado de su centro (fuera de su campo al máximo, que
// ocupa del 1 al 29), del lado que mira a la granja
{
    const F = PLACES[0], fx = F.at[0] + 15, fz = F.at[1] + 15;
    for (const l of FARM.lands) {
        const P = PLACES.find((p) => p.id === l.id), cx = P.at[0] + 15, cz = P.at[1] + 15;
        const dx = fx - cx, dz = fz - cz;
        const sides = [[Math.sign(dx) || 1, 0], [0, Math.sign(dz) || 1], [-(Math.sign(dx) || 1), 0], [0, -(Math.sign(dz) || 1)]];
        if (Math.abs(dz) > Math.abs(dx)) [sides[0], sides[1]] = [sides[1], sides[0]];
        const [ox, oz] = sides[0], post = { x: P.from[0] + 15 + ox * 14.4, z: P.from[1] + 15 + oz * 14.4 };
        l.post = post || { x: P.from[0] + 15, z: P.from[1] + 15 };
    }
}
// Lo que abarca el valle: en la pantalla (u, v) y en el mundo (para la cámara)
FARM.valley = { w: VW, h: VH, toUV, toXZ };
FARM.world = { x0: -VW * 0.71, z0: -VH * 0.71, x1: VW * 0.71, z1: VH * 0.71 };
FARM.view = { ...FARM.world };

// La forma de un campo (no un rectángulo): una mancha de esquinas redondeadas y borde irregular
// dentro de su rectángulo f, distinta en cada campo (seed)
export function inFieldShape(f, seed, x, z) {
    const u = (x - f.cx) / (f.w / 2), v = (z - f.cz) / (f.d / 2), a = Math.atan2(v, u);
    // Cuanto más grande, más cuadrado (y menos ondulado): en el mapa la parcela se estira hasta
    // su zona, así que un campo que llena su parcela llena la zona y su borde es el de la zona
    const big = Math.min(1, Math.min(f.w, f.d) / 28) ** 3, e = 2.6 + 9 * big;
    const R = 1 - (0.05 * (1 + Math.sin(a * 3 + seed)) + 0.03 * (1 + Math.sin(a * 7 + seed * 2.3))) * (1 - 0.8 * big);
    return Math.abs(u) ** e + Math.abs(v) ** e <= R ** e;
}
