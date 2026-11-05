import { L } from '../core/I18n.js';

// Cultivos.
//   name       nombre del recurso que da (contador, costes)
//   icon       sprite de la interfaz (clase CSS <icon>-ico y --px-<icon>)
//   growTime   segundos reales desde que se siembra hasta que está listo
//   stages     color de la planta en cada fase (brote → verde → madurando → maduro)
//   burst      colores de lo que salta al recogerlo en el campo de tiro
//   unit       cómo se llama cada blanco en las fichas (matas, tomates...)
//   loot       color del hatillo que se llevan los alienígenas al robarlo
//   stub       colores del rastrojo de su campo de tiro
export const CROPS = {
    wheat: {
        name: L('WHEAT', 'TRIGO'),
        icon: 'wheat',
        growTime: 30,
        stages: [0x6fbf3a, 0x8fcc40, 0xc8c84a, 0xe8b830],
        ear: 0xf6cf4a,
        earDark: 0xd9a42e,
        burst: [0xf6cf4a, 0xffe9a0, 0xd9a42e, 0xfff6dc],
        chaff: [0xe8b830, 0xc8c84a, 0xfff3d6],
        unit: L('BUNDLES', 'MATAS'),
        loot: 0xf6cf4a,
    },
    // Tomates: matas verdes con tutor y tomates gigantes (verdes mientras crecen)
    tomato: {
        name: L('TOMATOES', 'TOMATES'),
        icon: 'tomato',
        growTime: 45,
        stages: [0x6fbf3a, 0x4caf3c, 0x3d9a34, 0x3d9a34],
        leaves: [0x4caf3c, 0x3d9a34, 0x2f8a2c],
        fruit: 0xe8352a,
        fruitDark: 0xc0281e,
        unripe: 0x9ad04a,
        calyx: 0x2f8a2c,
        stake: 0xb07a44,
        burst: [0xe8352a, 0xff6a4a, 0xc0281e, 0xffd23f],
        chaff: [0xff8a6a, 0x4caf3c, 0xfff3d6],
        unit: L('TOMATOES', 'TOMATES'),
        loot: 0xe8352a,
    },
    // Calabazas gigantes tumbadas entre sus hojas: aguantan hp disparos (y paran la bala); cada
    // tiro las va resquebrajando
    pumpkin: {
        name: L('PUMPKINS', 'CALABAZAS'),
        icon: 'pumpkin',
        growTime: 60,
        hp: 3,
        stages: [0x6fbf3a, 0x5aa83a, 0x4a9a34, 0x3d8a2c],
        leaves: [0x4a9a34, 0x3d8a2c, 0x5aa83a],
        fruit: 0xf08a1e,
        fruitDark: 0xd06a10,
        unripe: 0x9ad04a,
        calyx: 0x5a7a2a,
        burst: [0xf08a1e, 0xffb04a, 0xd06a10, 0xfff3d6],
        chaff: [0xffe9a0, 0x4a9a34, 0xd06a10],
        unit: L('PUMPKINS', 'CALABAZAS'),
        loot: 0xf08a1e,
        stub: [0x4a9a34, 0x3d8a2c, 0x8a7a4a],
    },
    // Maíz: matas muy altas en hileras con las mazorcas arriba (las hileras dan colaterales
    // largos); las matas tapan la vista
    corn: {
        name: L('CORN', 'MAÍZ'),
        icon: 'corn',
        growTime: 50,
        stages: [0x6fbf3a, 0x8fcc40, 0x9ac040, 0xa8b048],
        leaves: [0x7ab83a, 0x6aa832, 0x8ac04a],
        fruit: 0xffd23f,
        fruitDark: 0xe8b830,
        unripe: 0xc8e070,
        calyx: 0x9ac04a,
        stalk: 0x8ab83a,
        burst: [0xffd23f, 0xfff3a0, 0xe8b830, 0xfff6dc],
        chaff: [0xc8e070, 0x9ac04a, 0xfff3d6],
        unit: L('COBS', 'MAZORCAS'),
        loot: 0xffd23f,
        stub: [0x9ac04a, 0x8a7a4a, 0x7ab83a],
    },
};
