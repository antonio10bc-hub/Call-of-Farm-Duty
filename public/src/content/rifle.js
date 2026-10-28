import { L } from '../core/I18n.js';

// Mejoras del rifle (en el granero, pestaña RIFLE): cada una con 5 niveles que se pagan con
// cosecha. Es la otra forma de progresar del granero además de sus niveles y las rachas.
//   values  lo que vale en cada nivel (el 0 es el rifle de serie)
//     zoom    campo de visión con la mira (grados: menos = más zoom)
//     steady  multiplica el vaivén y el temblor de la mira (y lo que tarda en asentarse)
//     bolt    segundos del cerrojo entre un disparo y el siguiente
//   cost    lo que cuesta llegar a cada nivel (del 1 al 5); los dos últimos piden tomates
const COST = [{ wheat: 4 }, { wheat: 10 }, { wheat: 20 }, { wheat: 30, tomato: 8 }, { wheat: 45, tomato: 20 }];

export const RIFLE = [
    { id: 'zoom', icon: 'rf-zoom', name: L('SCOPE', 'MIRA'), desc: L('MORE ZOOM: FAR TARGETS LOOK BIGGER.', 'MÁS ZOOM: LO LEJANO SE VE MÁS GRANDE.'),
        values: [12, 10.5, 9, 7.8, 6.8, 6], cost: COST },
    { id: 'steady', icon: 'rf-steady', name: L('STABILITY', 'ESTABILIDAD'), desc: L('LESS SWAY, AND THE SCOPE SETTLES SOONER.', 'MENOS VAIVÉN Y LA MIRA SE ASIENTA ANTES.'),
        values: [1, 0.8, 0.64, 0.5, 0.38, 0.28], cost: COST },
    { id: 'bolt', icon: 'rf-bolt', name: L('BOLT', 'CERROJO'), desc: L('LESS WAIT BETWEEN SHOTS.', 'MENOS ESPERA ENTRE DISPARO Y DISPARO.'),
        values: [0.7, 0.6, 0.52, 0.45, 0.39, 0.33], cost: COST },
];

export const RIFLE_BY_ID = Object.fromEntries(RIFLE.map((r) => [r.id, r]));
export const RIFLE_MAX = COST.length;

// Los valores del rifle con estos niveles ({ zoom, steady, bolt })
export function rifleStats(levels = {}) {
    return Object.fromEntries(RIFLE.map((r) => [r.id, r.values[Math.min(RIFLE_MAX, levels[r.id] | 0)]]));
}
