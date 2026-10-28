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
    bounds: { x0: 0, z0: -30, x1: 30, z1: 30 }, // todo lo vallado (hasta aquí se mueve la cámara)
    // Vallas: tramos rectos de [x, z] a [x, z]; gap: hueco [desde, hasta] a lo largo del tramo
    fences: [
        { from: [0, -30], to: [0, 30] },
        { from: [30, -30], to: [30, 30], gap: [-16, -14] }, // salida del camino del comerciante
        { from: [0, -30], to: [30, -30] },
        { from: [0, 30], to: [30, 30], gap: [14, 16] },     // entrada del camino principal
        { from: [0, 0], to: [30, 0], gap: [14, 16] },       // portón entre las dos parcelas
    ],
    // El granero (cuartel de las rachas de bajas) ocupa la mitad de arriba de la primera parcela
    // (zone). Empieza sin mejorar, con su recinto (yard) pequeño y el resto de la zona
    // abandonado: tierra sucia, árboles, matorral y chatarra. Cada nivel agranda el recinto (lo
    // de dentro se limpia), le añade construcciones y desbloquea una racha (killstreaks.js:
    // barn); el último da un hueco más para llevar rachas (slots).
    //   cost   lo que cuesta llegar a ese nivel
    barn: {
        zone: [1, 1, 29, 15],
        levels: [
            { yard: [8, 6, 22, 15], slots: 2 },
            { yard: [6, 5, 24, 15], slots: 2, cost: { wheat: 5 } },
            { yard: [5, 4, 25, 15], slots: 2, cost: { wheat: 15 } },
            { yard: [3, 3, 27, 15], slots: 2, cost: { wheat: 30 } },
            { yard: [2, 2, 28, 15], slots: 2, cost: { wheat: 40, tomato: 15 } },
            { yard: [1, 1, 29, 15], slots: 3, cost: { wheat: 60, tomato: 30 } },
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
    //             disparando al barril rojo; con `after`, solo cuando ese campo está al máximo
    //   levels    w, d: tamaño en casillas (en el mapa); sheaves: blancos en el campo de tiro;
    //             arena: tamaño del campo de tiro (1 = el normal); sign: color del cartel.
    //             El nivel 1 apenas cambia; los altos tienen un campo de tiro mucho mayor y lleno
    fields: [
        {
            id: 'wheat',
            crop: 'wheat',
            name: L('WHEAT FIELD', 'CAMPO DE TRIGO'),
            corner: { x: 14, z: 16, dx: -1, dz: 1 }, // junto al cruce de caminos
            cost: { wheat: 3 },
            // Lo primero del juego: limpiar este terreno para poder sembrar trigo
            locked: { name: L('JUNKYARD', 'TERRENO ABANDONADO') },
            // El último llena el hueco entre el camino, la valla y los árboles (x 3..14, z 16..27)
            levels: [
                { w: 4, d: 3, sheaves: 8, arena: 1, sign: 0x9a6a3a },
                { w: 6, d: 4, sheaves: 16, arena: 1.2, sign: 0xb07a44 },
                { w: 8, d: 6, sheaves: 30, arena: 1.45, sign: 0x5a9e32 },
                { w: 10, d: 8, sheaves: 50, arena: 1.75, sign: 0x3a7ec8 },
                { w: 11, d: 11, sheaves: 80, arena: 2.1, sign: 0xc8402e },
            ],
        },
        {
            id: 'tomato',
            crop: 'tomato',
            name: L('TOMATO FIELD', 'CAMPO DE TOMATES'),
            corner: { x: 16, z: 16, dx: 1, dz: 1 }, // la otra esquina del cruce, frente al trigo
            cost: { wheat: 5, tomato: 3 },
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
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 13, 16, 30],   // camino principal hacia el sur
        [3, 15, 25, 16],    // entre el granero y los campos
        [14, -13, 16, 9],   // de la casa a la trasera del granero (por el portón)
        [17, -16, 46, -14], // de la casa hacia fuera por la derecha: por aquí llegará el comerciante
    ],
};

// Fichas de los edificios: un texto corto debajo del nombre
export const INFO = {
    silo: L('GRAIN SILO. KEEPS THE HARVEST DRY.', 'SILO DE GRANO. MANTIENE SECA LA COSECHA.'),
    house: L('HOME SWEET HOME.', 'HOGAR, DULCE HOGAR.'),
    tractor: L('READY TO PLOUGH.', 'LISTO PARA ARAR.'),
};

export const FIELD_BY_ID = Object.fromEntries(FARM.fields.map((f) => [f.id, f]));
