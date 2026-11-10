import { L } from '../core/I18n.js';
import { FORCE } from './merchantLife.js';

// Lo común a todos los mercaderes (cada uno, en content/merchants.js):
//   orders   encargos por visita
//   size     cuánto pide de un cultivo: de [min, max] veces los blancos del campo a su nivel,
//            redondeado a step y nunca menos de min
//   rate     monedas de oro por cada unidad entregada de cada cultivo (se redondea hacia arriba)
//   site     su parcela [x0, z0, x1, z1)
// Visita rara: una de cada cuatro (siempre las mismas: depende del número de visita), viene de
// fiesta (gorro de cumpleaños y bufanda dorada) y paga más (rare: lo que multiplica el oro). En las
// pruebas, nunca
export const RARE = { every: 4, pay: 1.6 };
export const rareVisit = (visit) => FORCE.party !== null ? FORCE.party : !(typeof location !== 'undefined' && /[?&]test/.test(location.search)) && (Math.imul(visit | 0, 2654435761) >>> 0) % RARE.every === 1;

export const MERCHANT = {
    cycle: 300,
    stay: 240,
    orders: 3,
    size: [0.25, 0.6],
    step: 5,
    min: 5,
    rate: { wheat: 0.12, tomato: 0.35, pumpkin: 0.9, corn: 0.2, milk: 0.7, wool: 0.8, egg: 0.75, truffle: 1.1, fish: 0.6 },
    site: { zone: [30, -30, 60, 0] }, // (su parcela: en el mapa llena su zona; el pueblo, en content/merchants.js)
    name: L('MERCHANT', 'MERCADER'),
    lines: {
        thanks: L('A PLEASURE DOING HUMAN BUSINESS!', '¡UN PLACER HACER NEGOCIOS HUMANOS!'),
        short: L('THAT IS NOT ENOUGH, EARTHLING... I MEAN, FRIEND.', 'NO TE LLEGA, TERRÍCOLA... DIGO, AMIGO.'),
        done: L('ALL DONE! TIME TO DRIVE MY CAR HOME.', '¡TODO LISTO! ME VUELVO EN MI COCHE.'),
        away: L('THE MERCHANT IS ON THE ROAD. BY CAR.', 'EL MERCADER ESTÁ DE CAMINO. EN COCHE.'),
    },
};
