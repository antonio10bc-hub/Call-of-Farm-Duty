import { L } from '../core/I18n.js';

// Cultivos. De momento solo trigo.
//   growTime   segundos reales desde que se siembra hasta que está listo
//   stages     colores de los tallos en cada fase (semilla → brote → verde → dorado)
//   sheaves    haces que aparecen en el campo de tiro por cada parcela lista
export const CROPS = {
    wheat: {
        name: L('WHEAT', 'TRIGO'),
        growTime: 25,
        stages: [0x6fbf3a, 0x5cc83e, 0x9ad84a, 0xffd23f],
        ear: 0xffe680,
        sheaves: 4,
        sheaf: { body: 0xffc93a, dark: 0xd6962a, band: 0xc0462a, ear: 0xfff0a0 },
    },
};
