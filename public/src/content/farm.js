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
    // Campos de trigo (en casillas): esquina superior izquierda y tamaño
    fields: [
        { x: 3, z: 16, w: 5, d: 4 },
        { x: 9, z: 16, w: 5, d: 4 },
        { x: 16, z: 16, w: 5, d: 4 },
        { x: 3, z: 21, w: 5, d: 4 },
        { x: 9, z: 21, w: 5, d: 4 },
        { x: 16, z: 21, w: 5, d: 4 },
    ],
    // Caminos de tierra: rectángulos de casillas [x0, z0, x1, z1) (el final no entra)
    paths: [
        [14, 13, 16, 30],   // camino principal hacia el sur
        [3, 15, 25, 16],    // entre el granero y los campos
        [3, 20, 21, 21],    // entre las dos filas de campos
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
