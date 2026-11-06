import { L } from '../core/I18n.js';

// El comerciante: un alienígena disfrazado de humano (muy mal: una careta plana con su goma).
// Llega en su ovni, también "disfrazado" de coche con una careta gigante, al claro del bosque donde
// una vez se estrelló una nave y dejó un surco largo. El ovni entra volando desde fuera de cámara,
// baja al principio del surco, lo recorre pegado al suelo como si fuera un coche y se para al
// final; baja la rampa, sale él y se pone a comerciar: pide cultivos a cambio de monedas de oro.
// Con el reloj de verdad: cada cycle s llega y se queda stay s; luego se vuelve por donde vino.
//   orders   encargos por visita
//   size     cuánto pide de un cultivo: de [min, max] veces los blancos del campo a su nivel,
//            redondeado a step y nunca menos de min
//   rate     monedas de oro por cada unidad entregada de cada cultivo (se redondea hacia arriba)
//   site     el bosque (zone) y lo despejado (clear) en casillas [x0, z0, x1, z1)
//   furrow   el surco: de dónde empieza (from, x) a dónde acaba (to, x), a lo largo de z, y su
//            ancho al final (w)
//   ufo      dónde se para el ovni; from: de dónde viene volando (fuera de cámara)
//   stall    dónde está él comerciando (el cartel y la cámara van ahí)
export const MERCHANT = {
    cycle: 300,
    stay: 240,
    orders: 3,
    size: [0.25, 0.6],
    step: 5,
    min: 5,
    rate: { wheat: 0.12, tomato: 0.35, pumpkin: 0.9, corn: 0.2 },
    site: { zone: [31, -29, 59, -1], clear: [32, -23, 59, -14] },
    furrow: { from: 58.5, to: 43.2, z: -19.2, w: 3.2 },
    ufo: { x: 41.6, z: -19.2, from: { x: 80, y: 16, z: -30 } },
    stall: { x: 38.2, z: -16.6 },
    name: L('MERCHANT', 'MERCADER'),
    lines: {
        hello: [
            L('GREETINGS, FELLOW HUMAN. I PAY IN GOLD.', 'SALUDOS, COMPAÑERO HUMANO. PAGO EN ORO.'),
            L('I CAME BY CAR. A NORMAL CAR. WHAT HAVE YOU GOT?', 'HE VENIDO EN COCHE. UN COCHE NORMAL. ¿QUÉ TIENES?'),
            L('GOLD FOR GRAIN, FRIEND. NOTHING SUSPICIOUS HERE.', 'ORO POR GRANO, AMIGO. AQUÍ NADA RARO.'),
            L('REAL GOLD COINS. THE CARDBOARD IS... FOR PROTECTION.', 'MONEDAS DE ORO DE VERDAD. EL CARTÓN ES... PARA PROTEGERLAS.'),
        ],
        thanks: L('A PLEASURE DOING HUMAN BUSINESS!', '¡UN PLACER HACER NEGOCIOS HUMANOS!'),
        short: L('THAT IS NOT ENOUGH, EARTHLING... I MEAN, FRIEND.', 'NO TE LLEGA, TERRÍCOLA... DIGO, AMIGO.'),
        done: L('ALL DONE! TIME TO DRIVE MY CAR HOME.', '¡TODO LISTO! ME VUELVO EN MI COCHE.'),
        away: L('THE MERCHANT IS ON THE ROAD. BY CAR.', 'EL MERCADER ESTÁ DE CAMINO. EN COCHE.'),
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

    // locked: aún no ha llegado a la granja (la progresión no lo ha abierto)
    get here() {
        if (this.locked) return false;
        return this.force ? this.force === 'here' : this.t() < MERCHANT.stay;
    }

    // Segundos para que se vaya (si está) o vuelva (si no); null si está fijado
    get left() {
        if (this.force || this.locked) return null;
        const t = this.t();
        return t < MERCHANT.stay ? MERCHANT.stay - t : MERCHANT.cycle - t;
    }

    // Número de la visita (fijado en DEBUG, cuenta como la del reloj)
    get visit() {
        return Math.floor(Date.now() / 1000 / MERCHANT.cycle);
    }
}
