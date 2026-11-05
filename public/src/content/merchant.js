import { L } from '../core/I18n.js';

// El comerciante: llega por su camino (el que sale de la parcela de la casa hacia la derecha),
// monta su puesto en el claro de al lado y pide cultivos a cambio de monedas de oro. Con el
// reloj de verdad: cada cycle s llega y se queda stay s; luego recoge y se va.
//   orders   encargos por visita (con el poblado al nivel 1; ver village)
//   size     cuánto pide de un cultivo: de [min, max] veces los blancos del campo a su nivel,
//            redondeado a step y nunca menos de min
//   rate     monedas de oro por cada unidad entregada de cada cultivo (se redondea hacia arriba)
//   spot     el claro (casillas [x0, z0, x1, z1)) y dónde va cada cosa
export const MERCHANT = {
    cycle: 300,
    stay: 240,
    orders: 3,
    size: [0.25, 0.6],
    step: 5,
    min: 5,
    rate: { wheat: 0.12, tomato: 0.35, pumpkin: 0.9, corn: 0.2 },
    clearing: [33, -22, 41, -16],
    stall: { x: 37, z: -19.6 },
    wagon: { x: 39.6, z: -20.6, from: 54, road: -15 },
    fire: { x: 34.6, z: -17.4 },
    // El poblado del comerciante: toda su parcela (zone), abandonada salvo lo limpio de su nivel
    // (clear). Cada nivel limpia más, le añade construcciones (render/merchant.js) y trae un
    // comerciante mejor: más encargos (orders) y mejor pagados (pay, por el oro de cada uno).
    //   cost   lo que cuesta llegar a ese nivel
    village: {
        zone: [31, -29, 59, -1],
        levels: [
            { clear: [32, -23, 44, -11], orders: 3, pay: 1 },
            { clear: [31, -28, 53, -4], orders: 4, pay: 1.4, cost: { gold: 20, wheat: 60 } },
            { clear: [31, -29, 59, -1], orders: 5, pay: 1.8, cost: { gold: 50, wheat: 120, tomato: 40 } },
        ],
        name: L('MERCHANT VILLAGE', 'POBLADO'),
    },
    name: L('MERCHANT', 'MERCADER'),
    lines: {
        hello: [
            L('FRESH CROPS? I PAY IN GOLD.', '¿COSECHA FRESCA? PAGO EN ORO.'),
            L('THE ROAD WAS LONG. WHAT HAVE YOU GOT?', 'EL CAMINO FUE LARGO. ¿QUÉ TIENES?'),
            L('GOLD FOR GRAIN, FRIEND. FAIR DEAL.', 'ORO POR GRANO, AMIGO. TRATO JUSTO.'),
        ],
        thanks: L('A PLEASURE DOING BUSINESS!', '¡UN PLACER HACER NEGOCIOS!'),
        short: L('THAT IS NOT ENOUGH, FRIEND.', 'NO TE LLEGA, AMIGO.'),
        done: L('ALL DONE! SEE YOU NEXT TIME.', '¡TODO LISTO! HASTA LA PRÓXIMA.'),
        away: L('THE MERCHANT IS ON THE ROAD.', 'EL MERCADER ESTÁ DE CAMINO.'),
    },
};

// Su reloj: ¿está ahora?, cuánto falta para que cambie y qué visita es (cada visita trae sus
// encargos). force: 'here' o 'away' para fijarlo (DEBUG y las pruebas); null, el del reloj.
export class MerchantClock {
    constructor(force = null) {
        this.force = force;
    }

    t(now = Date.now()) {
        return (now / 1000) % MERCHANT.cycle;
    }

    get here() {
        return this.force ? this.force === 'here' : this.t() < MERCHANT.stay;
    }

    // Segundos para que se vaya (si está) o vuelva (si no); null si está fijado
    get left() {
        if (this.force) return null;
        const t = this.t();
        return t < MERCHANT.stay ? MERCHANT.stay - t : MERCHANT.cycle - t;
    }

    // Número de la visita (fijado en DEBUG, cuenta como la del reloj)
    get visit() {
        return Math.floor(Date.now() / 1000 / MERCHANT.cycle);
    }
}
