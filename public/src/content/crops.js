import { L } from '../core/I18n.js';

// Cultivos.
//   name       nombre del recurso que da (contador, costes)
//   icon       sprite de la interfaz (clase CSS <icon>-ico y --px-<icon>)
//   growTime   segundos reales desde que se siembra hasta que está listo
//   stages     color de la planta en cada fase (brote → verde → madurando → maduro)
//   burst      colores de lo que salta al recogerlo en el campo de tiro
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
    },
};
