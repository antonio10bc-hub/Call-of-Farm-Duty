import { L } from '../core/I18n.js';
import { groundRaw, quant } from '../world/terrain.js';

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
    ],
    // Las demás parcelas de la cuadrícula de 3×3 (la de los campos, con el granero, en el
    // centro). Las que se compran con el oro del comerciante (price) empiezan abandonadas (árboles,
    // matorral y chatarra) con su cartel de EN VENTA; una vez compradas se desbloquean como
    // cualquier terreno (disparando al barril de su campo) y queda limpia, con el campo de su
    // cultivo nuevo (field). Las de soon, de momento abandonadas y sin nada que desbloquear.
    // Sin comprar se ven oscuras (como en sombra) y con su poste (SE VENDE o PRONTO); al comprarla
    // la oscuridad se retira en una onda desde el poste, que salta, y queda tu bandera.
    //   price   monedas de oro que cuesta
    //   post    dónde está el poste (y luego la bandera)
    lands: [
        { id: 'west', rect: [-30, 0, 0, 30], price: 15, field: 'pumpkin', post: { x: -1.1, z: 13.2 }, name: L('WEST PLOT', 'PARCELA OESTE') },
        { id: 'east', rect: [30, 0, 60, 30], price: 25, field: 'corn', post: { x: 31.1, z: 13.2 }, name: L('EAST PLOT', 'PARCELA ESTE') },
        { id: 'nw', rect: [-30, -30, 0, 0], price: 40, field: 'milk', post: { x: -1.1, z: -12.8 }, name: L('NORTH-WEST PLOT', 'PARCELA NOROESTE') },
        { id: 'sw', rect: [-30, 30, 0, 60], soon: true, post: { x: -1.4, z: 31.4 } },
        { id: 'south', rect: [0, 30, 30, 60], soon: true, post: { x: 17.4, z: 32.2 } },
        { id: 'se', rect: [30, 30, 60, 60], soon: true, post: { x: 31.4, z: 31.4 } },
    ],
    bounds: { x0: -30, z0: -30, x1: 60, z1: 60 }, // toda la cuadrícula de parcelas
    view: { x0: -30, z0: -30, x1: 60, z1: 60 },   // hasta dónde se mueve la cámara
    // Vallas: tramos rectos de [x, z] a [x, z]; gap: hueco [desde, hasta] a lo largo del tramo
    // (las de la cuadrícula, con sus portones, al final del archivo)
    fences: [],
    // El granero (armamento: rachas de bajas y mejoras del rifle) ocupa la mitad de arriba de la
    // primera parcela (zone). Empieza sin mejorar, con su recinto (yard) pequeño y el resto de la
    // zona abandonado: tierra sucia, árboles, matorral y chatarra. Cada nivel agranda el recinto
    // (lo de dentro se limpia) y le añade construcciones.
    //   cost   lo que cuesta llegar a ese nivel
    barn: {
        zone: [1, 1, 29, 15],
        levels: [
            { yard: [8, 6, 22, 15] },
            { yard: [6, 5, 24, 15], cost: { wheat: 5 } },
            { yard: [5, 4, 25, 15], cost: { wheat: 15 } },
            { yard: [3, 3, 27, 15], cost: { wheat: 30 } },
            { yard: [2, 2, 28, 15], cost: { wheat: 40, tomato: 15 } },
            { yard: [1, 1, 29, 15], cost: { wheat: 60, tomato: 30 } },
        ],
    },
    // La casa y su parcela: empieza en ruinas con toda la parcela abandonada (zone). Nivel 1: la
    // casita arreglada y limpio alrededor; 2: gran parte de la parcela; 3: toda (clear).
    //   cost   lo que cuesta llegar a ese nivel
    house: {
        zone: [1, -29, 29, -1],
        levels: [
            { clear: null },
            { clear: [10, -20, 21, -10], cost: { wheat: 8 } },
            { clear: [4, -26, 26, -4], cost: { wheat: 20 } },
            { clear: [1, -29, 29, -1], cost: { wheat: 35, tomato: 10 } },
        ],
    },
    structures: [
        { id: 'barn', kind: 'barn', x: 15, z: 11, w: 5, d: 4, ry: 0, name: L('BARN', 'GRANERO') },
        { id: 'silo', kind: 'silo', x: 19.5, z: 10, w: 2, d: 2, name: L('SILO', 'SILO') },
        { id: 'house', kind: 'house', x: 15, z: -15, w: 4, d: 4, ry: 0, name: L('FARMHOUSE', 'CASA') }, // en el centro de su parcela
        { id: 'tractor', kind: 'tractor', x: 9.9, z: 13.2, w: 2, d: 3, ry: 1, name: L('TRACTOR', 'TRACTOR') }, // apartado de las cajas del granero
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
            corner: { x: 14, z: 16, dx: -1, dz: 1 }, // junto al cruce de caminos
            cost: { wheat: 3 },
            turrets: { wheat: 40 },
            // Lo primero del juego: limpiar este terreno para poder sembrar trigo
            locked: { barn: true, name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena el hueco entre el camino, la valla y los árboles (x 3..14, z 16..27)
            levels: [
                { w: 4, d: 3, sheaves: 18, arena: 1, sign: 0x9a6a3a },
                { w: 6, d: 4, sheaves: 36, arena: 1.2, sign: 0xb07a44 },
                { w: 8, d: 6, sheaves: 64, arena: 1.45, sign: 0x5a9e32 },
                { w: 10, d: 8, sheaves: 100, arena: 1.75, sign: 0x3a7ec8 },
                { w: 11, d: 11, sheaves: 150, arena: 2.1, sign: 0xc8402e },
            ],
        },
        {
            id: 'tomato',
            crop: 'tomato',
            name: L('TOMATO FIELD', 'CAMPO DE TOMATES'),
            corner: { x: 16, z: 16, dx: 1, dz: 1 }, // la otra esquina del cruce, frente al trigo
            cost: { wheat: 5, tomato: 3 },
            turrets: { wheat: 40, tomato: 25 },
            locked: { after: 'wheat', name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena el hueco entre el camino y la valla (x 16..28, z 16..27)
            levels: [
                { w: 5, d: 4, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 7, d: 5, sheaves: 12, arena: 1.2, sign: 0xb07a44 },
                { w: 9, d: 7, sheaves: 22, arena: 1.45, sign: 0x5a9e32 },
                { w: 11, d: 9, sheaves: 36, arena: 1.75, sign: 0x3a7ec8 },
                { w: 12, d: 11, sheaves: 56, arena: 2.1, sign: 0xc8402e },
            ],
        },
        // Los de las parcelas que se compran (con su cultivo nuevo y su forma de disparar)
        // Los de las parcelas que se compran (con su cultivo nuevo y su forma de disparar). Al nivel
        // máximo ocupan casi toda su parcela (con un margen de aire)
        {
            id: 'pumpkin',
            crop: 'pumpkin',
            name: L('PUMPKIN PATCH', 'CAMPO DE CALABAZAS'),
            corner: { x: -2, z: 2, dx: -1, dz: 1 }, // junto al portón de la parcela oeste
            cost: { wheat: 8, pumpkin: 2 },
            turrets: { wheat: 40, pumpkin: 10 },
            locked: { land: 'west', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 6, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 10, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 15, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 22, arena: 1.9, sign: 0x3a7ec8 },
                { w: 26, d: 26, sheaves: 32, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'corn',
            crop: 'corn',
            name: L('CORN FIELD', 'CAMPO DE MAÍZ'),
            corner: { x: 32, z: 2, dx: 1, dz: 1 }, // junto al portón de la parcela este
            cost: { wheat: 6, corn: 5 },
            turrets: { wheat: 40, corn: 30 },
            locked: { land: 'east', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 6, d: 5, sheaves: 16, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 30, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 52, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 84, arena: 1.9, sign: 0x3a7ec8 },
                { w: 26, d: 26, sheaves: 140, arena: 2.4, sign: 0xc8402e },
            ],
        },
        {
            id: 'milk',
            crop: 'milk',
            name: L('COW PASTURE', 'PRADO DE VACAS'),
            corner: { x: -2, z: -2, dx: -1, dz: -1 }, // junto a la esquina de la casa y la parcela oeste
            cost: { wheat: 10, milk: 3 },
            turrets: { wheat: 40, milk: 12 },
            locked: { land: 'nw', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            // sheaves: vacas del campo de tiro (un cubo cada una)
            levels: [
                { w: 6, d: 5, sheaves: 4, arena: 1, sign: 0x9a6a3a },
                { w: 10, d: 9, sheaves: 6, arena: 1.25, sign: 0xb07a44 },
                { w: 15, d: 14, sheaves: 9, arena: 1.55, sign: 0x5a9e32 },
                { w: 20, d: 19, sheaves: 13, arena: 1.9, sign: 0x3a7ec8 },
                { w: 26, d: 26, sheaves: 18, arena: 2.4, sign: 0xc8402e },
            ],
        },
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 13, 16, 60],   // camino principal hacia el sur (cruza la parcela de abajo)
        [-2, 15, 32, 16],   // entre el granero y los campos (y a los portones de las parcelas oeste y este)
        [14, -13, 16, 9],   // de la casa a la trasera del granero (por el portón)
        [17, -16, 34, -14], // de la casa al claro del bosque donde aterriza el comerciante
        [-2, -16, 13, -14], // de la casa al portón del prado de vacas (a la izquierda)
    ],
};

// Torreta automática de un campo (mejora extra con el campo al máximo): una sola, que va de
// esquina en esquina (salta cada hop s a la de al lado, nunca en diagonal, como el tirador entre torres). Dispara a ráfagas (burst
// balas, una cada rate s) como una ametralladora. En el mapa, plantada en unos sacos en cada
// esquina, recoge sola lo que esté maduro, una mata cada every s (mientras el juego está
// abierto), y entre tanto no para de tirotear el campo. En el campo de tiro va de un mástil a
// otro (de alto mast, en cada torre menos la tuya): acribilla una mata con una ráfaga y la
// recoge, descansa cool s y a por otra. Lo que recoge no suma a las rachas.
export const TURRETS = { every: 4, cool: 0.7, burst: 6, rate: 0.075, aim: 0.35, mast: 2.4, hop: 7 };

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
// en la cuadrícula de antes), pero se ve en otro sitio del mapa: repartidas sin filas ni columnas
// por el valle (at: la esquina de su sitio), algunas giradas (rot: cuartos de vuelta) y cada una a
// la altura del terreno donde cae (h, de world/terrain.js): en una colina, alta; junto al río, baja.
//   gates  dónde sale cada camino de la parcela (en sus coordenadas de siempre, en su borde)
export const PLACES = [
    { id: 'farm', from: [0, 0], at: [0, 0], rot: 0, gates: [[15, 30], [0, 15.5], [30, 15.5], [15, 0], [30, 25]] },
    { id: 'house', from: [0, -30], at: [14, -52], rot: 0, gates: [[15, 0], [30, -15], [0, -15]] },
    { id: 'merchant', from: [30, -30], at: [66, -72], rot: 1, gates: [[30, -15]] },
    { id: 'west', from: [-30, 0], at: [-72, -12], rot: 3, gates: [[0, 15.5]] },
    { id: 'east', from: [30, 0], at: [54, 16], rot: 0, gates: [[30, 15.5], [60, 15]] },
    { id: 'nw', from: [-30, -30], at: [-48, -68], rot: 1, gates: [[0, -15]] },
    { id: 'south', from: [0, 30], at: [-4, 58], rot: 2, gates: [[15, 30], [30, 45], [0, 45]] },
    { id: 'se', from: [30, 30], at: [62, 64], rot: 3, gates: [[30, 45]] },
    { id: 'sw', from: [-30, 30], at: [-76, 42], rot: 1, gates: [[0, 45], [-30, 45]] },
];
for (const P of PLACES) P.h = quant(groundRaw(P.at[0] + 15, P.at[1] + 15));
// Caminos entre parcelas: [parcela, puerta] a [parcela, puerta]; sin destino ('soon'), un ramal
// que se pierde hacia fuera con su barrera de PRÓXIMAMENTE (hueco para futuras parcelas)
export const ROADS = [
    [['farm', 3], ['house', 0]],
    [['farm', 1], ['west', 0]],
    [['farm', 2], ['east', 0]],
    [['farm', 0], ['south', 0]],
    [['house', 1], ['merchant', 0]],
    [['house', 2], ['nw', 0]],
    [['south', 1], ['se', 0]],
    [['south', 2], ['sw', 0]],
    [['east', 1], 'soon', [124, 34]],
    [['sw', 1], 'soon', [-108, 74]],
];
const placeOf = (x, z) => PLACES.find(({ from: [x0, z0] }) => x >= x0 && x < x0 + 30 && z >= z0 && z < z0 + 30);
// Un punto de la parcela P (en sus coordenadas de siempre), en el mundo: girado sobre su centro
// (como el grupo de la parcela: rotation.y = rot·90°) y llevado a su sitio y su altura
export function placeToWorld(P, x, z, y = 0) {
    const a = (P.rot || 0) * (Math.PI / 2), c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const dx = x - P.from[0] - 15, dz = z - P.from[1] - 15;
    return { x: P.at[0] + 15 + dx * c + dz * s, y: y + P.h, z: P.at[1] + 15 - dx * s + dz * c, place: P };
}
// Y al revés: un punto del mundo, en las coordenadas de siempre de la parcela P
export function worldToPlace(P, x, z) {
    const a = (P.rot || 0) * (Math.PI / 2), c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const dx = x - P.at[0] - 15, dz = z - P.at[1] - 15;
    return { x: P.from[0] + 15 + dx * c - dz * s, z: P.from[1] + 15 + dx * s + dz * c };
}
// De las coordenadas de siempre (de una parcela) al mundo (fuera de las parcelas, tal cual)
export function toWorld(x, z, y = 0) {
    const P = placeOf(x, z);
    return P ? placeToWorld(P, x, z, y) : { x, y, z, place: null };
}
// Una puerta de una parcela, en el mundo, y hacia dónde sale (ox, oz)
export function gateWorld(id, i) {
    const P = PLACES.find((p) => p.id === id), [gx, gz] = P.gates[i];
    const lx = gx - P.from[0], lz = gz - P.from[1];
    const ox = lx <= 0 ? -1 : lx >= 30 ? 1 : 0, oz = lz <= 0 ? -1 : lz >= 30 ? 1 : 0;
    const w = placeToWorld(P, gx, gz), o = placeToWorld(P, gx + ox, gz + oz);
    return { x: w.x, z: w.z, y: P.h, ox: Math.round(o.x - w.x), oz: Math.round(o.z - w.z) };
}
// Lo que abarca el mundo (para la cámara)
FARM.world = { x0: -100, z0: -96, x1: 120, z1: 116 };
FARM.view = { ...FARM.world };

// La forma de una parcela (no un cuadrado): un cuadrado de esquinas muy redondeadas con el borde
// ondulado; lx, lz: el punto, desde su esquina (0..30). Igual aunque la parcela esté girada
export function inParcelShape(P, lx, lz) {
    const u = (lx - 15) / 15, v = (lz - 15) / 15, a = Math.atan2(v, u), seed = (P.at[0] * 7 + P.at[1] * 3) % 6;
    const R = 1 - 0.05 * (1 + Math.sin(a * 4 + seed)) - 0.025 * (1 + Math.sin(a * 8 + seed * 2));
    return Math.abs(u) ** 3.4 + Math.abs(v) ** 3.4 <= R ** 3.4;
}
// ¿Dentro de la forma de su parcela? (un punto en las coordenadas de siempre; fuera de las
// parcelas, sí)
export function inShapeOf(x, z) {
    const P = placeOf(x, z);
    return !P || inParcelShape(P, x - P.from[0], z - P.from[1]);
}
// La forma de un campo (no un rectángulo): una mancha de esquinas redondeadas y borde irregular
// dentro de su rectángulo f, distinta en cada campo (seed)
export function inFieldShape(f, seed, x, z) {
    const u = (x - f.cx) / (f.w / 2), v = (z - f.cz) / (f.d / 2), a = Math.atan2(v, u);
    const R = 1 - 0.05 * (1 + Math.sin(a * 3 + seed)) - 0.03 * (1 + Math.sin(a * 7 + seed * 2.3));
    return Math.abs(u) ** 2.6 + Math.abs(v) ** 2.6 <= R ** 2.6;
}
