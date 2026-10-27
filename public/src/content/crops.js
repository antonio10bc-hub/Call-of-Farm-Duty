import { L } from '../core/I18n.js';

// Cultivos. De momento solo trigo.
//   growTime   segundos reales desde que se siembra hasta que está listo
//   stages     color de los tallos en cada fase (brote → verde → amarillando → maduro)
//   ear        color de la espiga madura
//   sheaves    matas maduras que aparecen en el campo de tiro por cada campo listo
export const CROPS = {
    wheat: {
        name: L('WHEAT', 'TRIGO'),
        growTime: 30,
        stages: [0x6fbf3a, 0x8fcc40, 0xc8c84a, 0xe8b830],
        ear: 0xf6cf4a,
        earDark: 0xd9a42e,
        sheaves: 6,
    },
};
