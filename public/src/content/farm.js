import { L } from '../core/I18n.js';

// Plano de la granja (en casillas). Cada edificio se puede tocar para ver su ficha.
//   kind      modelo que se construye (render/structures.js)
//   x, z      centro; w, d: huella en casillas (para tocarlo y para el camino)
//   ry        giro en cuartos de vuelta
export const FARM = {
    size: 30, // casillas de lado de la parcela jugable (el césped sigue hasta el horizonte)
    structures: [
        { id: 'barn', kind: 'barn', x: 15, z: 11, w: 5, d: 4, ry: 0, name: L('BARN', 'GRANERO') },
        { id: 'silo', kind: 'silo', x: 19.5, z: 10, w: 2, d: 2, name: L('SILO', 'SILO') },
        { id: 'house', kind: 'house', x: 8, z: 7, w: 4, d: 4, ry: 0, name: L('FARMHOUSE', 'CASA') },
        { id: 'tractor', kind: 'tractor', x: 11.5, z: 13, w: 2, d: 3, ry: 1, name: L('TRACTOR', 'TRACTOR') },
    ],
    // Campos de cultivo. Cada uno crece al mejorarlo desde una esquina fija (corner) hacia
    // los lados que marcan dx, dz (+1 / -1).
    //   cost      lo que cuesta cada mejora, por recurso
    //   locked    empieza como un terreno abandonado lleno de chatarra; se puede desbloquear
    //             cuando el campo `after` llega a su nivel máximo (disparando al barril rojo)
    //   levels    w, d: tamaño en casillas; sheaves: blancos en el campo de tiro; sign: color del cartel
    fields: [
        {
            id: 'wheat',
            crop: 'wheat',
            name: L('WHEAT FIELD', 'CAMPO DE TRIGO'),
            corner: { x: 14, z: 16, dx: -1, dz: 1 }, // junto al cruce de caminos
            cost: { wheat: 3 },
            // El último llena el hueco entre el camino, la valla y los árboles (x 3..14, z 16..27)
            levels: [
                { w: 4, d: 3, sheaves: 6, sign: 0x9a6a3a },
                { w: 6, d: 4, sheaves: 10, sign: 0xb07a44 },
                { w: 8, d: 6, sheaves: 16, sign: 0x5a9e32 },
                { w: 10, d: 8, sheaves: 23, sign: 0x3a7ec8 },
                { w: 11, d: 11, sheaves: 32, sign: 0xc8402e },
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
                { w: 5, d: 4, sheaves: 4, sign: 0x9a6a3a },
                { w: 7, d: 5, sheaves: 7, sign: 0xb07a44 },
                { w: 9, d: 7, sheaves: 11, sign: 0x5a9e32 },
                { w: 11, d: 9, sheaves: 16, sign: 0x3a7ec8 },
                { w: 12, d: 11, sheaves: 22, sign: 0xc8402e },
            ],
        },
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 13, 16, 30],   // camino principal hacia el sur
        [3, 15, 25, 16],    // entre el granero y los campos
        [8, 9, 9, 15],      // de la casa al camino
        [9, 9, 12, 10],     // de la casa al granero
    ],
};

// Fichas de los edificios: un texto corto debajo del nombre
export const INFO = {
    barn: L('STORES ALL YOUR HARVEST.', 'GUARDA TODA TU COSECHA.'),
    silo: L('GRAIN SILO. KEEPS THE HARVEST DRY.', 'SILO DE GRANO. MANTIENE SECA LA COSECHA.'),
    house: L('HOME SWEET HOME.', 'HOGAR, DULCE HOGAR.'),
    tractor: L('READY TO PLOUGH.', 'LISTO PARA ARAR.'),
};

export const FIELD_BY_ID = Object.fromEntries(FARM.fields.map((f) => [f.id, f]));
