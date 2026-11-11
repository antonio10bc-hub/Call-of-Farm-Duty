import { L } from '../core/I18n.js';
import { MERCHANT } from './merchant.js';

// Los mercaderes: siete alienígenas muy mal disfrazados de humanos (careta plana con su goma), cada
// uno en su ovni disfrazado de un vehículo distinto, más la nave madre. Llegan cuando quieren (al
// azar, cada uno con su reloj) por su surco hasta el cráter del centro de su zona, donde montan su
// puesto. Cada uno tiene su cultivo favorito (siempre pide de ese, y lo paga mejor), su confianza
// (ver merchantLife.js) y su tienda de objetos raros: lo que les compras decora el cráter, que se
// va haciendo un pueblecito.
//   fav       cultivo favorito (su primer encargo, si tienes ese campo; +fav.pay de oro)
//   vehicle   el disfraz de su ovni (render/merchants.js) y lo grande que es (len: largo)
//   skin...   los colores del alienígena: piel, gabardina y sombrero
//   angle     por dónde llega: su surco sale del cráter en esa dirección (grados; 0 = +x, 90 = +z)
//   fav2            su segundo favorito (lo pide en su segundo encargo y también lo paga mejor)
//   slot, p, stay   su reloj: cada slot s, con probabilidad p, viene y se queda stay s
//   pay       lo que multiplica el oro de sus encargos
export const FAV_PAY = 1.25;
export const MERCHANTS = [
    { id: 'm0', name: L('THE MERCHANT', 'EL MERCADER'), fav: 'tomato', vehicle: 'car', len: 4.9, skin: 0x7dff4a, coat: 0x8a6a4a, hat: 0x4a3a2a, angle: 30, slot: 360, p: 0.7, stay: 240, pay: 1,
        intro: L('I CAME BY CAR. A NORMAL CAR. RED. HUMAN.', 'HE VENIDO EN COCHE. UN COCHE NORMAL. ROJO. HUMANO.') },
    { id: 'm1', name: L('THE BUS DRIVER', 'EL DEL AUTOBÚS'), fav: 'wheat', vehicle: 'bus', len: 7.4, skin: 0xb87dff, coat: 0x3a5a8a, hat: 0x2a3a5a, angle: 100, slot: 420, p: 0.55, stay: 210, pay: 1,
        intro: L('ALL ABOARD! ER... I MEAN, HELLO. I DRIVE A BUS. FOR HUMANS.', '¡VIAJEROS AL TREN! DIGO... HOLA. CONDUZCO UN AUTOBÚS. DE HUMANOS.') },
    { id: 'm2', name: L('THE MINI LADY', 'LA DEL MINI'), fav: 'egg', vehicle: 'mini', len: 3.2, skin: 0x7ad8ff, coat: 0xd86a8a, hat: 0xffd23f, angle: -5, slot: 420, p: 0.55, stay: 210, pay: 1,
        intro: L('MY CAR IS SMALL. MY LEGS ARE NOT. THE NORMAL AMOUNT OF LEGS.', 'MI COCHE ES PEQUEÑO. MIS PIERNAS NO. LAS PIERNAS NORMALES, VAYA.') },
    { id: 'm3', name: L('THE ICE CREAM MAN', 'EL HELADERO'), fav: 'milk', fav2: 'honey', vehicle: 'icecream', len: 5.4, skin: 0xffb07a, coat: 0xf3ead2, hat: 0xff8ab8, angle: 65, slot: 420, p: 0.55, stay: 210, pay: 1,
        intro: L('ICE CREAM! MADE WITH MILK. FROM COWS. NOT FROM SPACE.', '¡HELADOS! HECHOS CON LECHE. DE VACA. NO DEL ESPACIO.') },
    { id: 'm4', name: L('THE TRUCKER', 'LA CAMIONERA'), fav: 'corn', vehicle: 'truck', len: 6.6, skin: 0xff7ae0, coat: 0x5a6a3a, hat: 0xc8402e, angle: 135, slot: 420, p: 0.55, stay: 210, pay: 1,
        intro: L('TEN TONS OF CORN, PLEASE. FOR... HUMAN POPCORN.', 'DIEZ TONELADAS DE MAÍZ, POR FAVOR. PARA... PALOMITAS HUMANAS.') },
    { id: 'm5', name: L('THE CAMPER', 'EL CAMPISTA'), fav: 'fish', fav2: 'sunflower', vehicle: 'camper', len: 6.0, skin: 0xffe07a, coat: 0x4a8a6a, hat: 0x6a4a2a, angle: -40, slot: 420, p: 0.55, stay: 210, pay: 1,
        intro: L('I LOVE NATURE. AND FISH. RAW FISH. LIKE EVERY HUMAN.', 'ME ENCANTA LA NATURALEZA. Y EL PESCADO. CRUDO. COMO A TODO HUMANO.') },
    { id: 'm6', name: L('THE FAKE FARMER', 'EL FALSO GRANJERO'), fav: 'pumpkin', vehicle: 'tractor', len: 4.4, skin: 0x5ae8c8, coat: 0x8a4a2a, hat: 0xe8c050, angle: 170, slot: 420, p: 0.55, stay: 210, pay: 1,
        intro: L('HOWDY, FELLOW FARMER! I ALSO FARM. PUMPKINS. ON EARTH.', '¡BUENAS, COLEGA! YO TAMBIÉN SOY GRANJERO. DE CALABAZAS. EN LA TIERRA.') },
    { id: 'mother', name: L('THE MOTHERSHIP', 'LA NAVE MADRE'), fav: 'truffle', vehicle: 'mother', len: 0, skin: 0xc8a0ff, coat: 0x4a3a6a, hat: 0x8a5ad8, angle: -115, slot: 1200, p: 0.4, stay: 300, pay: 1.6, mother: true,
        intro: L('GREETINGS FROM... THE VILLAGE. A NORMAL FLOATING VILLAGE.', 'SALUDOS DESDE... EL PUEBLO. UN PUEBLO FLOTANTE NORMAL.') },
];
export const MERCHANT_BY_ID = Object.fromEntries(MERCHANTS.map((m) => [m.id, m]));

// El cráter del centro y lo de alrededor, en las coordenadas del grupo de su parcela (el centro de
// la zona es (cx, cz); las medidas, las del mundo):
//   R       radio del cráter (el anillo de tierra levantada, con huecos donde entran los surcos)
//   stall   a qué distancia del centro monta cada uno su puesto
//   pad     a qué distancia está la nave madre (en el hueco entre surcos, detrás del cráter);
//           impact: el radio de la zona arrasada por su aterrizaje (árboles tumbados, tierra)
//   fire    la hoguera (entre dos puestos, al borde del cráter)
export const VILLAGE = { cx: 45, cz: -15, R: 10, stall: 8.4, pad: 20, impact: 14, fire: { r: 8.6, angle: 152 } };
export const polar = (r, deg) => ({ x: VILLAGE.cx + Math.cos((deg * Math.PI) / 180) * r, z: VILLAGE.cz + Math.sin((deg * Math.PI) / 180) * r });

// Lo que vende cada uno: objetos raros (de su estilo) que, comprados, decoran el cráter. at: dónde
// va (r, y el ángulo: desde el suyo con da, o fijo con a)
export const DECOR = [
    { id: 'gnome', by: 'm0', name: L('ALIEN GNOME', 'GNOMO ALIENÍGENA'), gold: 12, r: 6, da: -16 },
    { id: 'flamingo', by: 'm0', name: L('PLASTIC FLAMINGO', 'FLAMENCO DE PLÁSTICO'), gold: 8, r: 6, da: 16 },
    { id: 'trophy', by: 'm0', name: L('GOLDEN TROPHY', 'TROFEO DORADO'), gold: 25, r: 4.2, da: 0 },
    { id: 'banner', by: 'm1', name: L('ALIEN BANNER', 'BANDERA ALIENÍGENA'), gold: 15, r: 6, da: -16 },
    { id: 'stand', by: 'm1', name: L('MARKET STAND', 'PUESTO DE MERCADO'), gold: 20, r: 6, da: 16 },
    { id: 'bench', by: 'm1', name: L('PARK BENCH', 'BANCO DEL PARQUE'), gold: 10, r: 4.2, da: 0 },
    { id: 'lamps', by: 'm2', name: L('STREET LAMPS', 'FAROLAS'), gold: 14, r: 6, da: -16 },
    { id: 'mailbox', by: 'm2', name: L('MAILBOX (FOR HUMAN LETTERS)', 'BUZÓN (DE CARTAS HUMANAS)'), gold: 8, r: 6, da: 16 },
    { id: 'flowers', by: 'm2', name: L('ALIEN FLOWER BED', 'PARTERRE ALIENÍGENA'), gold: 12, r: 4.2, da: 0 },
    { id: 'shrubs', by: 'm3', name: L('GLOWING SHRUBS', 'ARBUSTOS QUE BRILLAN'), gold: 10, r: 6, da: -16 },
    { id: 'cone', by: 'm3', name: L('GIANT ICE CREAM SIGN', 'CUCURUCHO GIGANTE'), gold: 18, r: 6, da: 16 },
    { id: 'lights', by: 'm3', name: L('STRING LIGHTS', 'GUIRNALDA DE LUCES'), gold: 16, r: 4.2, da: 0 },
    { id: 'well', by: 'm4', name: L('STONE WELL', 'POZO DE PIEDRA'), gold: 16, r: 6, da: -16 },
    { id: 'dish', by: 'm4', name: L('SATELLITE DISH', 'ANTENA PARABÓLICA'), gold: 20, r: 6, da: 16 },
    { id: 'signpost', by: 'm4', name: L('SIGNPOST TO EVERYWHERE', 'POSTE A TODAS PARTES'), gold: 8, r: 4.2, da: 0 },
    { id: 'telescope', by: 'm5', name: L('TELESCOPE (TO SEE HOME)', 'TELESCOPIO (PARA VER CASA)'), gold: 18, r: 6, da: -16 },
    { id: 'crystal', by: 'm5', name: L('SPACE CRYSTAL', 'CRISTAL ESPACIAL'), gold: 14, r: 6, da: 16 },
    { id: 'mushrooms', by: 'm5', name: L('GIANT MUSHROOMS', 'SETAS GIGANTES'), gold: 10, r: 4.2, da: 0 },
    { id: 'mill', by: 'm6', name: L('LITTLE WINDMILL', 'MOLINILLO DE VIENTO'), gold: 22, r: 6, da: -16 },
    { id: 'pumpkins', by: 'm6', name: L('ALIEN PUMPKINS', 'CALABAZAS ALIENÍGENAS'), gold: 10, r: 6, da: 16 },
    { id: 'scarecrow', by: 'm6', name: L('ALIEN SCARECROW', 'ESPANTAPÁJAROS ALIENÍGENA'), gold: 12, r: 4.2, da: 0 },
    { id: 'fountain', by: 'mother', name: L('GOLDEN FOUNTAIN', 'FUENTE DORADA'), gold: 60, r: 0, a: 0 },
    { id: 'statue', by: 'mother', name: L('STATUE OF THE MERCHANTS', 'ESTATUA DE LOS MERCADERES'), gold: 50, r: 2.6, a: -115 },
    { id: 'discoball', by: 'mother', name: L('DISCO BALL', 'BOLA DE DISCOTECA'), gold: 30, r: 2.6, a: 40 },
    { id: 'tree', by: 'mother', name: L('GIANT ALIEN TREE', 'ÁRBOL ALIENÍGENA GIGANTE'), gold: 45, r: 2.6, a: 160 },
];
// Lo exclusivo de la nave madre: cada visita trae uno distinto (solo se vende esa visita); va en su
// zona de impacto, junto al camino al cráter (a: fijo, r desde el centro del cráter)
export const EXCLUSIVE = [
    { id: 'arch', by: 'mother', exclusive: true, name: L('CRYSTAL ARCH', 'ARCO DE CRISTAL'), gold: 70, r: 13, a: -97 },
    { id: 'totem', by: 'mother', exclusive: true, name: L('ALIEN TOTEM', 'TÓTEM ALIENÍGENA'), gold: 55, r: 13, a: -133 },
    { id: 'holo', by: 'mother', exclusive: true, name: L('HOLOGRAM OF HOME', 'HOLOGRAMA DE CASA'), gold: 80, r: 15.5, a: -87 },
    { id: 'rocket', by: 'mother', exclusive: true, name: L('FAIRGROUND ROCKET', 'COHETE DE FERIA'), gold: 65, r: 15.5, a: -143 },
    { id: 'pond', by: 'mother', exclusive: true, name: L('GLOWING POND', 'CHARCA QUE BRILLA'), gold: 50, r: 11.6, a: -84 },
    { id: 'saucer', by: 'mother', exclusive: true, name: L('SOUVENIR SAUCER', 'PLATILLO DE RECUERDO'), gold: 60, r: 11.6, a: -146 },
];
// El exclusivo de una visita de la nave madre (si ya lo tienes, el siguiente que no tengas)
export function exclusiveFor(visit, owned) {
    for (let k = 0; k < EXCLUSIVE.length; k++) {
        const it = EXCLUSIVE[(((visit | 0) % EXCLUSIVE.length) + k) % EXCLUSIVE.length];
        if (!owned.includes(it.id)) return it.id;
    }
    return null;
}
export const ALL_DECOR = [...DECOR, ...EXCLUSIVE];
export const DECOR_BY_ID = Object.fromEntries(ALL_DECOR.map((d) => [d.id, d]));

// El nivel del pueblo, según cuántas cosas tiene (y el oro que te dan al llegar a cada uno)
export const VILLAGE_LEVELS = [
    { n: 0, name: L('CAMP', 'CAMPAMENTO'), gold: 0 },
    { n: 4, name: L('HAMLET', 'ALDEA'), gold: 20 },
    { n: 9, name: L('VILLAGE', 'PUEBLO'), gold: 40 },
    { n: 16, name: L('TOWN', 'VILLA'), gold: 60 },
    { n: 24, name: L('CITY', 'CIUDAD'), gold: 100 },
];
// Las tres fases del pueblo (por lo comprado): 1 campamento (plaza y calles de tierra), 2 pueblo
// (plaza empedrada, ronda interior, tres calles pavimentadas y las casas de sus mercaderes), 3
// ciudad (todas las calles con farolas, todas las casas, ronda exterior y la avenida de la nave madre)
export const TOWN = { phase2: 9, phase3: 24, first: ['m0', 'm2', 'm4'] };
// La ampliación del pueblo (con el pueblo terminado, fase 3): cada paso construye la siguiente
// pieza (la ronda, casas sueltas, grupitos de casas, el mercado, el parque, el barrio tecnológico,
// la arboleda), de dentro hacia fuera. Lo que cuesta cada paso, en oro
// Lo que da cada barrio especial al construirlo: el mercado paga más por los encargos, el parque
// da más confianza con cada entrega, el barrio tecnológico abarata los deseos del pozo y la
// arboleda alarga lo que se quedan los mercaderes
export const TOWN_PERKS = { market: { pay: 1.2 }, park: { trust: 1 }, tech: { wish: 0.75 }, grove: { stay: 1.25 } };
export const expandCost = (step) => 6 + Math.floor(step / 4) * 2;
export const townPhase = (n) => (n >= TOWN.phase3 ? 3 : n >= TOWN.phase2 ? 2 : 1);
// Las calles pavimentadas en cada fase (los mercaderes de esas calles)
export const pavedIn = (phase) => (phase >= 3 ? MERCHANTS.filter((m) => !m.mother).map((m) => m.id) : phase === 2 ? TOWN.first : []);
export const villageLevel = (n) => VILLAGE_LEVELS.reduce((lv, L0, i) => (n >= L0.n ? i : lv), 0);
// Los habitantes: con cuántas cosas se queda a vivir cada uno en el pueblo
export const RESIDENTS = [8, 15, 22];

// Los celos: si a otro le tienes más confianza (jealous niveles más), te paga más para recuperarte
export const JEALOUS = { gap: 2, pay: 1.15 };

// Día de mercado: de vez en cuando vienen todos a la vez un rato (cada slot s, con probabilidad p,
// stay s); sus encargos pagan más
export const MARKET = { slot: 1800, p: 0.4, stay: 180, pay: 1.25 };
export const MARKET_FORCE = { on: null }; // (DEBUG: null, true o false)
const TEST_ = typeof location !== 'undefined' && /[?&]test/.test(location.search);
// Lo que le queda al día de mercado de ahora (s), o null si no hay
export function marketLeft(t = Date.now() / 1000) {
    if (MARKET_FORCE.on !== null) return MARKET_FORCE.on ? Infinity : null;
    if (TEST_) return null;
    const n = Math.floor(t / MARKET.slot), h = (k) => ((Math.imul(n * 7919 + k, 2654435761) >>> 0) % 10000) / 10000;
    if (h(1) >= MARKET.p) return null;
    const from = n * MARKET.slot + h(2) * (MARKET.slot - MARKET.stay);
    return t >= from && t < from + MARKET.stay ? from + MARKET.stay - t : null;
}
export const marketNow = (t) => marketLeft(t) !== null;

// Logros de los mercaderes (dan algo de oro la primera vez). test(state): ¿conseguido?
export const MEDALS = [
    { id: 'first', name: L('FIRST DEAL', 'PRIMER TRATO'), desc: L('DELIVER AN ORDER', 'ENTREGA UN ENCARGO'), gold: 5, test: (S) => !!S.story.sold },
    { id: 'partner', name: L('SOMEONE\'S PARTNER', 'SOCIO DE ALGUIEN'), desc: L('ONE MERCHANT AT TRUST 4', 'UN MERCADER EN CONFIANZA 4'), gold: 15, test: (S) => MERCHANTS.some((d) => S.trustOf(d.id) >= 4) },
    { id: 'friends', name: L('FRIEND OF ALL', 'AMIGO DE TODOS'), desc: L('ALL MERCHANTS AT TRUST 5', 'TODOS EN CONFIANZA 5'), gold: 100, test: (S) => MERCHANTS.every((d) => S.trustOf(d.id) >= 5) },
    { id: 'gift', name: L('RELIABLE', 'FORMAL'), desc: L('GET A STREAK GIFT', 'CONSIGUE UN REGALO DE RACHA'), gold: 10, test: (S) => !!S.flags.gift },
    { id: 'market', name: L('MARKET DAY', 'DÍA DE MERCADO'), desc: L('DELIVER ON A MARKET DAY', 'ENTREGA EN UN DÍA DE MERCADO'), gold: 15, test: (S) => !!S.flags.market },
    { id: 'exclusive', name: L('SPACE COLLECTOR', 'COLECCIONISTA ESPACIAL'), desc: L('BUY A MOTHERSHIP EXCLUSIVE', 'COMPRA UN EXCLUSIVO DE LA NAVE MADRE'), gold: 20, test: (S) => EXCLUSIVE.some((d) => S.village.includes(d.id)) },
    { id: 'full', name: L('COMPLETE VILLAGE', 'PUEBLO COMPLETO'), desc: L('EVERYTHING IN THE VILLAGE', 'TODO EN EL PUEBLO'), gold: 150, test: (S) => ALL_DECOR.every((d) => S.village.includes(d.id)) },
];
export const decorOf = (id) => DECOR.filter((d) => d.by === id);
// Dónde va cada objeto (en el grupo de la parcela)
export function decorAt(d) {
    const a = d.a !== undefined ? d.a : MERCHANT_BY_ID[d.by].angle + d.da;
    return polar(d.r, a);
}

// El reloj de cada mercader: el tiempo se parte en tramos (slot); en cada uno, con probabilidad
// p (siempre igual para ese tramo: no depende de cuándo se mire), viene en un momento al azar del
// tramo y se queda stay s. force: 'here' o 'away' para fijarlo (DEBUG y las pruebas).
const hash = (a, b) => {
    let h = Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b | 0, 1597334677);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
export class VisitClock {
    constructor(def, force = null) {
        this.def = def;
        this.force = force;
        this.seed = [...def.id].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7);
    }

    now() {
        return Date.now() / 1000;
    }

    // El tramo n: cuándo llega y se va (o null: ese tramo no viene)
    slot(n) {
        const { slot, p } = this.def, stay = Math.min(slot * 0.9, this.def.stay * (this.stayK || 1)); // (stayK: la arboleda los retiene más)
        if (hash(this.seed, n) >= p) return null;
        const from = n * slot + hash(this.seed + 1, n) * (slot - stay);
        return { from, to: from + stay };
    }

    get here() {
        if (this.locked) return false;
        if (this.until > Date.now()) return true; // (su primera visita, aunque esté fijado fuera)
        if (this.force) return this.force === 'here';
        if (marketNow()) return true; // (día de mercado: todos)
        const t = this.now(), s = this.slot(Math.floor(t / this.def.slot));
        return !!s && t >= s.from && t < s.to;
    }

    // Que venga ya (la primera vez, tras su llamada): se queda una visita entera
    arriveNow() {
        this.until = Date.now() + this.def.stay * 1000;
        this.pinned = this.visit;
    }

    // Segundos para que se vaya (si está) o llegue (si no); null si está fijado
    get left() {
        if (this.locked) return null;
        if (this.until > Date.now()) return (this.until - Date.now()) / 1000;
        if (this.force) return null;
        const t = this.now(), n0 = Math.floor(t / this.def.slot), mk = marketLeft(t);
        if (mk !== null) return mk;
        for (let n = n0; n < n0 + 60; n++) {
            const s = this.slot(n);
            if (!s) continue;
            if (t < s.from) return s.from - t;
            if (t < s.to) return s.to - t;
        }
        return null;
    }

    // Número de la visita (cada una trae sus encargos): su tramo (shift: DEBUG, visitas adelantadas)
    get visit() {
        if (this.until > Date.now() && this.pinned !== undefined) return this.pinned;
        return Math.floor(this.now() / this.def.slot) + (this.shift | 0);
    }
}

export const merchantRate = (crop) => MERCHANT.rate[crop] || 0.5;
