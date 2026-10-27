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
        { id: 'tower', kind: 'tower', x: 23.5, z: 19, w: 2, d: 2, name: L('WATCHTOWER', 'TORRE DE VIGÍA') },
        { id: 'tractor', kind: 'tractor', x: 11.5, z: 13, w: 2, d: 3, ry: 1, name: L('TRACTOR', 'TRACTOR') },
    ],
    // El campo de trigo: uno solo, que crece al mejorarlo. Su esquina superior derecha queda
    // fija junto al cruce de caminos (right, top) y se extiende hacia la izquierda y abajo.
    field: {
        right: 14,
        top: 16,
        upgradeCost: 3, // trigo por cada mejora
        // Cinco niveles, cada uno con un salto claro de tamaño y de matas (el último llena el
        // hueco entre el camino, la valla y los árboles: x 3..14, z 16..27)
        //   w, d      tamaño en casillas
        //   sheaves   matas maduras que aparecen en el campo de tiro
        //   sign      color del cartel con el nivel
        levels: [
            { w: 4, d: 3, sheaves: 6, sign: 0x9a6a3a },
            { w: 6, d: 4, sheaves: 10, sign: 0xb07a44 },
            { w: 8, d: 6, sheaves: 16, sign: 0x5a9e32 },
            { w: 10, d: 8, sheaves: 23, sign: 0x3a7ec8 },
            { w: 11, d: 11, sheaves: 32, sign: 0xc8402e },
        ],
    },
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 13, 16, 30],   // camino principal hacia el sur
        [3, 15, 25, 16],    // entre el granero y los campos
        [8, 9, 9, 15],      // de la casa al camino
        [9, 9, 12, 10],     // de la casa al granero
        [22, 16, 23, 18],   // a la torre
    ],
};

// Fichas de los edificios: un texto corto debajo del nombre
export const INFO = {
    barn: L('STORES ALL YOUR WHEAT.', 'GUARDA TODO TU TRIGO.'),
    silo: L('GRAIN SILO. KEEPS THE HARVEST DRY.', 'SILO DE GRANO. MANTIENE SECA LA COSECHA.'),
    house: L('HOME SWEET HOME.', 'HOGAR, DULCE HOGAR.'),
    tower: L('FROM UP HERE YOU SEE EVERY FIELD.', 'DESDE AQUÍ ARRIBA SE VEN TODOS LOS CAMPOS.'),
    tractor: L('READY TO PLOUGH.', 'LISTO PARA ARAR.'),
};
