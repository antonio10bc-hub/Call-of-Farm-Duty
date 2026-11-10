import { L } from '../core/I18n.js';

// La vida del mercader a lo largo del tiempo (la lógica, en game/FarmState.js):
//  - confianza: sube con cada encargo cumplido; por niveles (1-5) paga más, pide más variado, te
//    saluda distinto y su campamento crece (y deja cosas en el claro entre visitas)
//  - racha: visitas seguidas con todo cumplido; cada 3, la siguiente trae un regalo
//  - ánimo: contento si cumpliste la última; serio si lo dejaste plantado dos veces seguidas
//  - encargos especiales (dan una pieza de colección), combinados (varios cultivos, pagan más) y
//    urgentes (con cuenta atrás: a tiempo, pagan el doble)
//  - su tienda: sus objetos raros (content/merchants.js); lo que se compra (o te regala) decora
//    el cráter del pueblo
// (cada mercader, lo suyo: ver content/merchants.js)

export const TRUST = [0, 4, 10, 20, 35]; // puntos para cada nivel (1 a 5)
export const trustLevel = (t) => TRUST.reduce((lv, need, i) => (t >= need ? i + 1 : lv), 1);
export const TRUST_PAY = 0.06;   // lo que sube el oro por nivel
export const MOOD_PAY = { happy: 1.1, neutral: 1, serious: 0.9 };
export const GIFT_EVERY = 3;     // visitas seguidas con todo cumplido para un regalo
export const URGENT = { secs: 150, pay: 2 }; // el urgente: tiempo y lo que multiplica a tiempo
export const BASKET_PAY = 1.3;   // el combinado
export const SPECIAL = { size: 1.6, gold: 1.5 }; // el especial: más grande; si ya tienes todo, oro

// FORCE: lo que fija DEBUG (null: lo normal) para la fiesta
export const FORCE = { party: null };

export const LEVEL_NAMES = [L('STRANGER', 'DESCONOCIDO'), L('CUSTOMER', 'CLIENTE'), L('REGULAR', 'HABITUAL'), L('PARTNER', 'SOCIO'), L('BEST FRIEND', 'AMIGO DEL ALMA')];

// Cómo saluda según la confianza (de desconfiado a casi confesar que no es humano)
export const HELLO = [
    [L('ARE YOU THE FARMER? I PAY IN GOLD. REAL GOLD.', '¿TÚ ERES EL GRANJERO? PAGO EN ORO. ORO DE VERDAD.'), L('I CAME BY ROAD. LIKE HUMANS DO.', 'HE VENIDO POR CARRETERA. COMO LOS HUMANOS.')],
    [L('AH, YOU AGAIN. GOOD CROPS LAST TIME.', 'AH, TÚ OTRA VEZ. BUENA COSECHA LA ÚLTIMA VEZ.'), L('I MISSED THIS FIELD. AND YOUR CROPS.', 'ECHABA DE MENOS ESTE CAMPO. Y TU COSECHA.')],
    [L('HELLO, FARM-FRIEND! WHAT HAVE YOU GOT TODAY?', '¡HOLA, AMIGO GRANJERO! ¿QUÉ TIENES HOY?'), L('I BROUGHT YOU SOMETHING NICE IN THE SHOP.', 'TE HE TRAÍDO ALGO BONITO EN LA TIENDA.')],
    [L('PARTNER! THE GALAX... THE CITY LOVES YOUR CROPS.', '¡SOCIO! EN LA GALAX... EN LA CIUDAD LES ENCANTA TU COSECHA.'), L('BETWEEN US: MY VEHICLE FLIES. A LITTLE.', 'ENTRE NOSOTROS: MI VEHÍCULO VUELA. UN POCO.')],
    [L('BEST FRIEND! FINE: I AM NOT EXACTLY FROM HERE.', '¡AMIGO DEL ALMA! VALE: NO SOY EXACTAMENTE DE AQUÍ.'), L('YOU ARE MY FAVOURITE HUMAN. DON\'T TELL THE OTHERS.', 'ERES MI HUMANO FAVORITO. NO SE LO DIGAS A LOS DEMÁS.')],
];
export const MOOD_LINES = {
    happy: L('I AM IN A GREAT MOOD! I PAY A BIT MORE TODAY.', '¡ESTOY DE BUEN HUMOR! HOY PAGO UN POCO MÁS.'),
    serious: L('YOU LEFT ME HANGING... I PAY A BIT LESS TODAY.', 'ME DEJASTE PLANTADO... HOY PAGO UN POCO MENOS.'),
};
export const MOODS = { happy: L('HAPPY', 'CONTENTO'), neutral: L('CALM', 'TRANQUILO'), serious: L('SERIOUS', 'SERIO') };
