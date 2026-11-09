import { L } from '../core/I18n.js';

// La vida del mercader a lo largo del tiempo (la lógica, en game/FarmState.js):
//  - confianza: sube con cada encargo cumplido; por niveles (1-5) paga más, pide más variado, te
//    saluda distinto y su campamento crece (y deja cosas en el claro entre visitas)
//  - racha: visitas seguidas con todo cumplido; cada 3, la siguiente trae un regalo
//  - ánimo: contento si cumpliste la última; serio si lo dejaste plantado dos veces seguidas
//  - encargos especiales (dan una pieza de colección), combinados (varios cultivos, pagan más) y
//    urgentes (con cuenta atrás: a tiempo, pagan el doble)
//  - su primo: algunas visitas viene con él, que pide un cultivo distinto y paga más
//  - su tienda: cada visita trae 2-3 cosas distintas (algunas, solo en las visitas de fiesta);
//    lo que se compra (o te regala) se ve en el mapa

export const TRUST = [0, 4, 10, 20, 35]; // puntos para cada nivel (1 a 5)
export const trustLevel = (t) => TRUST.reduce((lv, need, i) => (t >= need ? i + 1 : lv), 1);
export const TRUST_PAY = 0.06;   // lo que sube el oro por nivel
export const MOOD_PAY = { happy: 1.1, neutral: 1, serious: 0.9 };
export const GIFT_EVERY = 3;     // visitas seguidas con todo cumplido para un regalo
export const URGENT = { secs: 150, pay: 2 }; // el urgente: tiempo y lo que multiplica a tiempo
export const BASKET_PAY = 1.3;   // el combinado
export const SPECIAL = { size: 1.6, gold: 1.5 }; // el especial: más grande; si ya tienes todo, oro
export const COUSIN = { every: 5, pay: 1.5 };

const TEST = typeof location !== 'undefined' && /[?&]test/.test(location.search);
// ¿Viene con su primo? (algunas visitas; en las pruebas, nunca)
// FORCE: lo que fija DEBUG (null: lo normal) para la fiesta y el primo
export const FORCE = { party: null, cousin: null };
export const cousinVisit = (visit) => (FORCE.cousin !== null ? FORCE.cousin : !TEST && (visit | 0) % COUSIN.every === 2);

export const LEVEL_NAMES = [L('STRANGER', 'DESCONOCIDO'), L('CUSTOMER', 'CLIENTE'), L('REGULAR', 'HABITUAL'), L('PARTNER', 'SOCIO'), L('BEST FRIEND', 'AMIGO DEL ALMA')];

// Cómo saluda según la confianza (de desconfiado a casi confesar que no es humano)
export const HELLO = [
    [L('ARE YOU THE FARMER? I PAY IN GOLD. REAL GOLD.', '¿TÚ ERES EL GRANJERO? PAGO EN ORO. ORO DE VERDAD.'), L('I CAME BY CAR. A NORMAL CAR.', 'HE VENIDO EN COCHE. UN COCHE NORMAL.')],
    [L('AH, YOU AGAIN. GOOD CROPS LAST TIME.', 'AH, TÚ OTRA VEZ. BUENA COSECHA LA ÚLTIMA VEZ.'), L('MY CAR AND I MISSED THIS FIELD.', 'MI COCHE Y YO ECHÁBAMOS DE MENOS ESTE CAMPO.')],
    [L('HELLO, FARM-FRIEND! WHAT HAVE YOU GOT TODAY?', '¡HOLA, AMIGO GRANJERO! ¿QUÉ TIENES HOY?'), L('I BROUGHT YOU SOMETHING NICE IN THE SHOP.', 'TE HE TRAÍDO ALGO BONITO EN LA TIENDA.')],
    [L('PARTNER! THE GALAX... THE CITY LOVES YOUR WHEAT.', '¡SOCIO! EN LA GALAX... EN LA CIUDAD LES ENCANTA TU TRIGO.'), L('BETWEEN US: THE CAR FLIES. A LITTLE.', 'ENTRE NOSOTROS: EL COCHE VUELA. UN POCO.')],
    [L('BEST FRIEND! FINE: I AM NOT EXACTLY FROM HERE.', '¡AMIGO DEL ALMA! VALE: NO SOY EXACTAMENTE DE AQUÍ.'), L('YOU ARE MY FAVOURITE HUMAN. DON\'T TELL THE OTHERS.', 'ERES MI HUMANO FAVORITO. NO SE LO DIGAS A LOS DEMÁS.')],
];
export const MOOD_LINES = {
    happy: L('I AM IN A GREAT MOOD! I PAY A BIT MORE TODAY.', '¡ESTOY DE BUEN HUMOR! HOY PAGO UN POCO MÁS.'),
    serious: L('YOU LEFT ME HANGING... I PAY A BIT LESS TODAY.', 'ME DEJASTE PLANTADO... HOY PAGO UN POCO MENOS.'),
};
export const COUSIN_LINE = L('THIS IS MY COUSIN. HE ALSO CAME BY CAR. A DIFFERENT CAR.', 'ESTE ES MI PRIMO. TAMBIÉN HA VENIDO EN COCHE. OTRO COCHE.');
export const MOODS = { happy: L('HAPPY', 'CONTENTO'), neutral: L('CALM', 'TRANQUILO'), serious: L('SERIOUS', 'SERIO') };

// Su tienda y la colección: lo que se compra (con oro) o te regala; todo se ve en el mapa (en su
// claro; la chistera, en el pato del lacito). party: solo en las visitas de fiesta
export const CATALOG = [
    { id: 'gnome', name: L('ALIEN GNOME', 'GNOMO ALIENÍGENA'), gold: 12 },
    { id: 'duckhat', name: L('TOP HAT FOR THE DUCK', 'CHISTERA PARA EL PATO'), gold: 10 },
    { id: 'flamingo', name: L('PLASTIC FLAMINGO', 'FLAMENCO DE PLÁSTICO'), gold: 8 },
    { id: 'banner', name: L('ALIEN BANNER', 'BANDERA ALIENÍGENA'), gold: 15 },
    { id: 'trophy', name: L('GOLDEN TROPHY', 'TROFEO DORADO'), gold: 25 },
    { id: 'discoball', name: L('DISCO BALL', 'BOLA DE DISCOTECA'), gold: 20, party: true },
    { id: 'statue', name: L('STATUE OF THE MERCHANT', 'ESTATUA DEL MERCADER'), gold: 40, party: true },
];
export const ITEM = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
export const COLLECTION = CATALOG.map((c) => c.id);

// Lo que trae a la venta en una visita: 2 o 3 cosas, siempre las mismas para esa visita
export function stockFor(visit, party) {
    const pool = CATALOG.filter((c) => !c.party || party);
    let s = (Math.imul(visit | 0, 2246822519) >>> 0) || 1;
    const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2654435761) >>> 0) % 1000) / 1000;
    const out = [], n = 2 + (rnd() < 0.5 ? 1 : 0);
    if (party) out.push(pool.find((c) => c.party && !out.includes(c.id)).id); // (la de fiesta, siempre)
    while (out.length < n && out.length < pool.length) {
        const c = pool[Math.floor(rnd() * pool.length)];
        if (!out.includes(c.id)) out.push(c.id);
    }
    return out;
}
