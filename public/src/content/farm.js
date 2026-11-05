import { L } from '../core/I18n.js';

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
    // Parcelas que se compran con el oro del comerciante, a los lados y delante de la de los
    // campos. Empiezan abandonadas (árboles, matorral y chatarra) con su cartel de EN VENTA; una
    // vez compradas se desbloquean como cualquier terreno (disparando al barril de su campo) y
    // queda limpia, con el campo de su cultivo nuevo (field).
    // Sin comprar se ve oscura (como en sombra) y con un poste de SE VENDE junto a su portón; al
    // comprarla la oscuridad se retira en una onda desde el poste, que salta, y queda tu bandera.
    //   price   monedas de oro que cuesta
    //   post    dónde está el poste (y luego la bandera)
    lands: [
        { id: 'west', rect: [-30, 0, 0, 30], price: 15, field: 'pumpkin', post: { x: -2.4, z: 13.6 }, name: L('WEST PLOT', 'PARCELA OESTE') },
        { id: 'east', rect: [30, 0, 60, 30], price: 25, field: 'corn', post: { x: 32.4, z: 13.6 }, name: L('EAST PLOT', 'PARCELA ESTE') },
        { id: 'south', rect: [0, 30, 30, 60], price: 40, field: 'carrot', post: { x: 17.6, z: 32.4 }, name: L('SOUTH PLOT', 'PARCELA SUR') },
    ],
    bounds: { x0: -30, z0: -30, x1: 60, z1: 60 }, // todo lo vallado (con las parcelas en venta)
    view: { x0: -30, z0: -30, x1: 60, z1: 60 },   // hasta dónde se mueve la cámara
    // Vallas: tramos rectos de [x, z] a [x, z]; gap: hueco [desde, hasta] a lo largo del tramo
    fences: [
        { from: [0, -30], to: [0, 0] },
        { from: [0, 0], to: [0, 30], gap: [14, 17] },       // portón a la parcela oeste
        { from: [30, -30], to: [30, 0], gap: [-16, -14] },  // salida del camino del comerciante
        { from: [30, 0], to: [30, 30], gap: [14, 17] },     // portón a la parcela este
        { from: [0, -30], to: [30, -30] },
        { from: [0, 30], to: [30, 30], gap: [14, 16] },     // camino principal (a la parcela sur)
        { from: [0, 0], to: [30, 0], gap: [14, 16] },       // portón entre las dos parcelas
        // Las parcelas en venta
        { from: [-30, 0], to: [0, 0] },
        { from: [-30, 30], to: [0, 30] },
        { from: [-30, 0], to: [-30, 30] },
        { from: [30, 0], to: [60, 0] },
        { from: [30, 30], to: [60, 30] },
        { from: [60, 0], to: [60, 30] },
        { from: [0, 30], to: [0, 60] },
        { from: [30, 30], to: [30, 60] },
        { from: [0, 60], to: [30, 60], gap: [14, 16] },     // entrada del camino principal
    ],
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
            locked: { name: L('JUNKYARD', 'TERRENO ABANDONADO') },
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
        {
            id: 'pumpkin',
            crop: 'pumpkin',
            name: L('PUMPKIN PATCH', 'CAMPO DE CALABAZAS'),
            corner: { x: -9, z: 9, dx: -1, dz: 1 }, // donde acaba el camino de la parcela oeste
            cost: { wheat: 8, pumpkin: 2 },
            turrets: { wheat: 40, pumpkin: 10 },
            locked: { land: 'west', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 5, d: 4, sheaves: 5, arena: 1, sign: 0x9a6a3a },
                { w: 7, d: 5, sheaves: 8, arena: 1.2, sign: 0xb07a44 },
                { w: 9, d: 7, sheaves: 12, arena: 1.45, sign: 0x5a9e32 },
                { w: 11, d: 9, sheaves: 17, arena: 1.75, sign: 0x3a7ec8 },
                { w: 12, d: 11, sheaves: 24, arena: 2.1, sign: 0xc8402e },
            ],
        },
        {
            id: 'corn',
            crop: 'corn',
            name: L('CORN FIELD', 'CAMPO DE MAÍZ'),
            corner: { x: 39, z: 9, dx: 1, dz: 1 }, // donde acaba el camino de la parcela este
            cost: { wheat: 6, corn: 5 },
            turrets: { wheat: 40, corn: 30 },
            locked: { land: 'east', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 5, d: 4, sheaves: 14, arena: 1, sign: 0x9a6a3a },
                { w: 7, d: 5, sheaves: 26, arena: 1.2, sign: 0xb07a44 },
                { w: 9, d: 7, sheaves: 44, arena: 1.45, sign: 0x5a9e32 },
                { w: 11, d: 9, sheaves: 70, arena: 1.75, sign: 0x3a7ec8 },
                { w: 12, d: 11, sheaves: 104, arena: 2.1, sign: 0xc8402e },
            ],
        },
        {
            id: 'carrot',
            crop: 'carrot',
            name: L('CARROT FIELD', 'CAMPO DE ZANAHORIAS'),
            corner: { x: 17, z: 36, dx: 1, dz: 1 }, // junto al camino principal, en la parcela sur
            cost: { wheat: 6, carrot: 4 },
            turrets: { wheat: 40, carrot: 20 },
            locked: { land: 'south', name: L('PLOT FOR SALE', 'PARCELA EN VENTA') },
            levels: [
                { w: 5, d: 4, sheaves: 10, arena: 1, sign: 0x9a6a3a },
                { w: 7, d: 5, sheaves: 18, arena: 1.2, sign: 0xb07a44 },
                { w: 9, d: 7, sheaves: 28, arena: 1.45, sign: 0x5a9e32 },
                { w: 11, d: 9, sheaves: 42, arena: 1.75, sign: 0x3a7ec8 },
                { w: 12, d: 11, sheaves: 60, arena: 2.1, sign: 0xc8402e },
            ],
        },
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 13, 16, 60],   // camino principal hacia el sur (cruza la parcela sur)
        [-8, 15, 38, 16],   // entre el granero y los campos (y a las parcelas oeste y este)
        [14, -13, 16, 9],   // de la casa a la trasera del granero (por el portón)
        [17, -16, 46, -14], // de la casa hacia fuera por la derecha: por aquí llega el comerciante
        [33, -22, 41, -16], // el claro donde monta su puesto (content/merchant.js)
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
