import { CROPS } from '../content/crops.js';
import { FARM, FIELD_BY_ID, LAND_BY_ID, TURRETS } from '../content/farm.js';
import { SHOP_ITEMS, DEFAULT_LOOK } from '../content/ufo.js';
import { ARSENAL, ARSENAL_KINDS, DEFAULT_LOADOUT, CLASSES, arsenalItem } from '../content/arsenal.js';
import { KILLSTREAKS } from '../content/killstreaks.js';
import { MERCHANT, RARE, rareVisit } from '../content/merchant.js';
import { trustLevel, TRUST_PAY, MOOD_PAY, GIFT_EVERY, URGENT, BASKET_PAY, SPECIAL } from '../content/merchantLife.js';
import { MERCHANTS, MERCHANT_BY_ID, DECOR_BY_ID, decorOf, FAV_PAY, exclusiveFor, JEALOUS, MARKET, marketNow, MEDALS, ALL_DECOR, VILLAGE_LEVELS, villageLevel } from '../content/merchants.js';

// Lo que pide un encargo: { cultivo: cuánto } (el combinado, varios)
export const orderWants = (o) => o.items || { [o.crop]: o.n };

// Estado de la granja: lo recogido de cada cultivo, cada campo (desbloqueado o no, nivel, hora
// de siembra y blancos que quedan), el nivel del granero y el equipo del fusil.
// Se guarda en el navegador; sin almacenamiento simplemente no se recuerda.
const KEY = 'cofd.farm.v4';
// Revisión de la partida guardada. 2: campos de tiro grandes (se rellenan los blancos que se
// guardaron con las cifras de antes). 3: niveles del granero (las partidas de antes, que ya
// tenían granada y misil Predator, empiezan con el granero en el nivel 2). 4: niveles de la
// casa (las de antes, con la casa ya arreglada, empiezan en el nivel 1)
const REV = 5;
const BARN = FARM.barn.levels;
const HOUSE = FARM.house.levels;
const OLD_KEYS = ['cofd.farm.v3', 'cofd.farm.v2']; // v3: un solo campo de trigo
const levelsOf = (id) => FIELD_BY_ID[id].levels;
const STORY = ['crop', 'alien', 'box', 'merchant', 'sold', 'house'];
const growMs = (id) => CROPS[FIELD_BY_ID[id].crop].growTime * 1000;

const MERCHANT_FRESH = () => ({ visit: -1, orders: [], trust: 0, streak: 0, missed: 0, mood: 'neutral', gift: null });
export { MERCHANT_FRESH };

export class FarmState {
    constructor(now = Date.now()) {
        // ¿Ya se ha visto el prólogo? (una partida nueva empieza por él)
        this.prologue = false;
        this.freeCosts = false; // depuración: las mejoras de campos y granero a 0
        this.freeHome = false; // depuración: las mejoras de la casa y la tienda del ovni a 0
        // open: el granero ya desbloqueado (lo primero que se hace en una partida nueva)
        this.barn = { level: 0, open: false };
        this.gatesOff = false; // pruebas y depuración: todo lo de la progresión abierto
        this.house = { level: 0 };
        // Armería (content/arsenal.js): lo comprado ('scope:tac'...) y lo que lleva montado el fusil
        // classes: las clases (rifle, mirilla, cargador y rachas, ks); active: la equipada.
        // loadout: la equipada (la misma, para lo que solo mira el fusil)
        const ks = KILLSTREAKS.map((k) => k.id);
        // classOwned: las clases desbloqueadas (la primera, de serie; las demás, con oro)
        this.arsenal = { owned: [], active: 0, classOwned: [0], classes: CLASSES.map(() => ({ ...DEFAULT_LOADOUT, ks: [...ks] })) };
        this.arsenal.loadout = this.arsenal.classes[0];
        // Lo recogido de cada cultivo y las monedas de oro (gold: la moneda del juego, la paga el
        // comerciante; son de cartón, pero que no se entere nadie)
        this.items = Object.fromEntries([...Object.keys(CROPS), 'gold'].map((c) => [c, 0]));
        // El comerciante: la visita de la que son los encargos que hay (cada uno: cultivo, cuánto,
        // cuánto oro paga y si ya se ha entregado)
        // Su vida con el tiempo (ver content/merchantLife.js): confianza (puntos), racha de visitas
        // cumplidas, visitas seguidas sin entregarle nada, ánimo, el regalo pendiente y lo que
        // tienes de su colección
        this.merchants = Object.fromEntries(MERCHANTS.map((m) => [m.id, MERCHANT_FRESH()]));
        // Lo que les has comprado (o te han regalado): la decoración del cráter (ver DECOR)
        this.village = [];
        // Lo que va pasando con ellos (para los logros), los logros conseguidos y el nivel del pueblo
        // que ya se ha celebrado
        this.flags = { gift: false, market: false };
        this.medals = [];
        this.villageLv = 0;
        // La historia: lo que ya ha pasado, una vez cada cosa (y lo que abre):
        //   crop      el trigo a nivel 2: el trigo mágico regala las rachas de cultivos
        //   alien     el trigo a nivel 3: regala las rachas alienígenas (y empiezan los alienígenas)
        //   box       el trigo al máximo: regala la caja sorpresa
        //   merchant  los tomates al máximo: llama el mercader y viene por primera vez
        //   sold      la primera venta al mercader
        //   house     tras ella, el trigo mágico abre la casa (y las parcelas, a la venta)
        this.story = {};
        // Parcelas compradas con oro (content/farm.js: lands)
        this.lands = Object.fromEntries(FARM.lands.filter((l) => l.price).map((l) => [l.id, false]));
        // El ovni (crashed: ya se ha estrellado en la parcela de la casa; met: ya se ha abierto su
        // tienda alguna vez) y la casa personalizada en su tienda: lo comprado (owned) y lo que
        // lleva puesto en cada parte (look)
        this.ufo = { met: false }; // met: ya se ha abierto la tienda de la casa
        // placed: lo de la parcela que está puesto en su hueco (lo comprado se puede quitar)
        this.home = { owned: [], look: { ...DEFAULT_LOOK }, placed: [] };
        // Los terrenos bloqueados se siembran al desbloquearlos (y quedan listos para recoger).
        // turrets: con sus torretas automáticas (la mejora extra con el campo al máximo)
        // ammo: las matas que le quedan por recoger a la torreta antes de quedarse sin balas
        this.fields = Object.fromEntries(FARM.fields.map((f) => [f.id, {
            unlocked: !f.locked,
            turrets: false,
            ammo: 0,
            level: 0,
            plantedAt: now - growMs(f.id),
            left: f.levels[0].sheaves,
        }]));
        this.load();
    }

    load() {
        try {
            const d = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (d && d.fields) {
                this.prologue = d.prologue === undefined ? true : !!d.prologue; // las de antes, ya empezadas
                for (const c of Object.keys(this.items)) this.items[c] = (d.items && d.items[c]) | 0;
                this.barn.level = Math.min(BARN.length - 1, Math.max(0, d.barn ? d.barn.level | 0 : (d.rev | 0) < 3 ? 2 : 0));
                this.barn.open = d.barn && d.barn.open !== undefined ? !!d.barn.open : true; // las de antes, ya abierto
                this.house.level = Math.min(HOUSE.length - 1, Math.max(0, d.house ? d.house.level | 0 : (d.rev | 0) < 4 ? 1 : 0));
                if (d.arsenal) {
                    // (las partidas de antes: las clases que ya tenían abiertas)
                    if (Array.isArray(d.arsenal.classOwned)) this.arsenal.classOwned = [0, ...d.arsenal.classOwned.filter((i) => i > 0 && i < CLASSES.length)];
                    else this.arsenal.classOwned = [0, 1, 2, ...(d.fields && d.fields.tomato && d.fields.tomato.unlocked ? [3] : []), ...((d.items && d.items.gold) || (d.lands && Object.values(d.lands).some(Boolean)) ? [4] : [])];
                    if (Array.isArray(d.arsenal.owned)) this.arsenal.owned = d.arsenal.owned.filter((k) => { const [kind, id] = k.split(':'); return ARSENAL[kind] && ARSENAL[kind].some((x) => x.id === id); });
                    // Las clases (las partidas de antes: su fusil pasa a la clase 1)
                    const saved = Array.isArray(d.arsenal.classes) ? d.arsenal.classes : [d.arsenal.loadout];
                    saved.forEach((c, i) => {
                        const C = this.arsenal.classes[i];
                        if (!c || !C) return;
                        for (const kind of ARSENAL_KINDS) if (this.ownsGear(kind, c[kind])) C[kind] = c[kind];
                        if (Array.isArray(c.ks)) C.ks = c.ks.filter((id) => KILLSTREAKS.some((k) => k.id === id));
                    });
                    this.arsenal.active = Math.min(CLASSES.length - 1, Math.max(0, d.arsenal.active | 0));
                    if (!this.arsenal.classOwned.includes(this.arsenal.active)) this.arsenal.active = 0;
                    this.arsenal.loadout = this.arsenal.classes[this.arsenal.active];
                }
                // Las monedas alienígenas de antes pasan a ser de oro (la única moneda)
                if (d.items && d.items.alien) this.items.gold += (d.items.alien | 0) * 3;
                for (const id of Object.keys(this.lands)) this.lands[id] = !!(d.lands && d.lands[id]);
                // (rev 5: las calabazas se mudan a la parcela de al lado; la suya pasa a ser el corral
                // de las gallinas, aún por comprar)
                if ((d.rev | 0) < 5 && d.lands && d.lands.west) {
                    this.lands.west2 = true;
                    this.lands.west = false;
                }
                // Los mercaderes (las de antes: un solo mercader, que es el primero; su colección pasa a
                // ser decoración del pueblo)
                const loadM = (m, M) => Object.assign(M, { visit: m.visit | 0, orders: (m.orders || []).filter((o) => o && CROPS[o.crop] && Object.keys(orderWants(o)).every((c) => CROPS[c])),
                    trust: m.trust | 0, streak: m.streak | 0, missed: m.missed | 0, mood: MOOD_PAY[m.mood] ? m.mood : 'neutral',
                    gift: m.gift === null || m.gift === undefined ? null : DECOR_BY_ID[m.gift] || typeof m.gift === 'number' ? m.gift : null });
                if (d.merchants) for (const id of Object.keys(this.merchants)) { if (d.merchants[id]) loadM(d.merchants[id], this.merchants[id]); }
                else if (d.merchant && Array.isArray(d.merchant.orders)) loadM(d.merchant, this.merchants.m0);
                const own = Array.isArray(d.village) ? d.village : d.merchant && Array.isArray(d.merchant.owned) ? d.merchant.owned : [];
                this.village = [...new Set(own.filter((id) => DECOR_BY_ID[id]))];
                this.flags = { gift: !!(d.flags && d.flags.gift), market: !!(d.flags && d.flags.market) };
                this.medals = Array.isArray(d.medals) ? d.medals.filter((id) => MEDALS.some((m) => m.id === id)) : [];
                this.villageLv = d.villageLv | 0;
                this.ufo.met = !!(d.ufo && d.ufo.met);
                if (d.home) {
                    if (Array.isArray(d.home.owned)) this.home.owned = d.home.owned.filter((id) => SHOP_ITEMS[id]);
                    for (const [slot, id] of Object.entries((d.home && d.home.look) || {})) if (slot in this.home.look && SHOP_ITEMS[id] && this.owns(id)) this.home.look[slot] = id;
                    if (Array.isArray(d.home.placed)) this.home.placed = d.home.placed.filter((id) => this.owns(id));
                }
                for (const [id, f] of Object.entries(this.fields)) {
                    const s = d.fields[id];
                    if (!s) continue;
                    f.unlocked = f.unlocked || !!s.unlocked;
                    f.level = Math.min(levelsOf(id).length - 1, Math.max(0, s.level | 0));
                    f.plantedAt = +s.plantedAt || 0;
                    f.left = s.left | 0;
                    f.turrets = f.unlocked && !!s.turrets;
                    // (las torretas de antes de la munición, cargadas)
                    f.ammo = f.turrets ? Math.max(0, Math.min(TURRETS.ammo, s.ammo === undefined ? TURRETS.ammo : s.ammo | 0)) : 0;
                    // Lo que está creciendo sale con las cifras de su nivel (si cambian en el
                    // contenido, al cargar ya valen); lo maduro guardado antes de la revisión 2,
                    // también, aunque ya se hubiera empezado a recoger
                    if (f.unlocked && (!this.isReady(id) || (d.rev | 0) < 2)) f.left = Math.max(this.isReady(id) ? f.left : 0, this.sheaves(id));
                }
                // La historia (las partidas de antes: lo que ya habrían visto, por cómo van)
                if (d.story && typeof d.story === 'object') for (const k of STORY) this.story[k] = !!d.story[k];
                else {
                    const w = this.fields.wheat, t = this.fields.tomato, met = t.unlocked && this.maxed('tomato');
                    Object.assign(this.story, { crop: w.unlocked && w.level >= 1, alien: w.unlocked && w.level >= 2, box: w.unlocked && this.maxed('wheat'), merchant: met, sold: met, house: met });
                }
                return;
            }
            // Partida de un solo campo de trigo: se conservan el trigo y el campo
            const v3 = JSON.parse(localStorage.getItem(OLD_KEYS[0]) || 'null');
            if (v3 && v3.plot) {
                this.items.wheat = v3.wheat | 0;
                const w = this.fields.wheat;
                w.unlocked = true;
                w.level = Math.min(levelsOf('wheat').length - 1, Math.max(0, v3.level | 0));
                w.plantedAt = +v3.plot.plantedAt || 0;
                w.left = v3.plot.left | 0;
                this.barn.level = 2;
                this.barn.open = true;
                this.house.level = 1;
                this.prologue = true;
            }
        } catch {
            /* sin almacenamiento */
        }
    }

    // Borra la partida (cosecha y campos); los ajustes y el idioma se quedan
    static reset() {
        try {
            for (const k of [KEY, ...OLD_KEYS]) localStorage.removeItem(k);
        } catch {
            /* sin almacenamiento */
        }
    }

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ rev: REV, prologue: this.prologue, items: this.items, fields: this.fields, barn: this.barn, house: this.house, arsenal: this.arsenal, ufo: this.ufo, home: this.home, merchants: this.merchants, village: this.village, flags: this.flags, medals: this.medals, villageLv: this.villageLv, lands: this.lands, story: this.story }));
        } catch {
            /* ignorar */
        }
    }

    // ---------- Casa ----------
    get houseMaxed() {
        return this.house.level >= HOUSE.length - 1;
    }

    houseCost() {
        const c = this.houseMaxed ? {} : HOUSE[this.house.level + 1].cost;
        return this.freeHome ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    get canUpgradeHouse() {
        return !FARM.house.hidden && this.open('house') && !this.houseMaxed && Object.entries(this.houseCost()).every(([c, n]) => this.items[c] >= n);
    }

    upgradeHouse() {
        if (!this.canUpgradeHouse) return false;
        for (const [c, n] of Object.entries(this.houseCost())) this.items[c] -= n;
        this.house.level++;
        this.save();
        return true;
    }

    // ---------- Tienda del ovni ----------
    // ¿Se tiene ya? (lo de serie, sí)
    owns(id) {
        const it = SHOP_ITEMS[id];
        return !!it && (!Object.keys(it.cost).length || this.home.owned.includes(id));
    }

    affordableCost(cost) {
        return Object.entries(cost).every(([c, n]) => this.items[c] >= n);
    }

    // Lo que cuesta un objeto de la tienda (todo a 0 con la depuración de la casa)
    itemCost(id) {
        const c = SHOP_ITEMS[id].cost;
        return this.freeHome ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    // Comprar (si no se tenía) y ponerlo. Lo de la casa se pone (una opción por parte); lo de la
    // parcela, al comprarlo se pone en su hueco y después se quita o se vuelve a poner.
    // false si no se puede (PRONTO o sin monedas)
    buyOrWear(id) {
        const it = SHOP_ITEMS[id];
        if (!it || it.cat.soon) return false;
        const had = this.owns(id);
        if (!had) {
            const cost = this.itemCost(id);
            if (!this.affordableCost(cost)) return false;
            for (const [c, n] of Object.entries(cost)) this.items[c] -= n;
            this.home.owned.push(id);
        }
        if (it.cat.slot) this.home.look[it.cat.slot] = id;
        else if (!had || !this.home.placed.includes(id)) this.home.placed.push(id);
        else this.home.placed = this.home.placed.filter((p) => p !== id);
        this.save();
        return true;
    }

    // Depuración: la casa a un nivel cualquiera (sin pagar)
    setHouseLevel(n) {
        this.house.level = Math.min(HOUSE.length - 1, Math.max(0, n));
        this.save();
    }

    // Depuración: todo lo de la tienda (menos lo que aún es PRONTO) comprado y puesto en su hueco
    unlockHome() {
        const ids = Object.keys(SHOP_ITEMS).filter((id) => !SHOP_ITEMS[id].cat.soon && !this.owns(id));
        this.home.owned.push(...ids);
        for (const id of Object.keys(SHOP_ITEMS)) if (SHOP_ITEMS[id].at && this.owns(id) && !this.home.placed.includes(id)) this.home.placed.push(id);
        this.save();
        return ids.length;
    }

    // Depuración: la casa como de serie y la parcela vacía (lo comprado se olvida)
    resetHome() {
        this.home = { owned: [], look: { ...DEFAULT_LOOK }, placed: [] };
        this.save();
    }

    // ---------- Armería (en el granero) ----------
    // ¿Se tiene ya? (lo de serie, sí)
    ownsGear(kind, id) {
        const it = ARSENAL[kind] && ARSENAL[kind].find((x) => x.id === id);
        return !!it && (!it.price || this.arsenal.owned.includes(`${kind}:${id}`));
    }

    gearPrice(kind, id) {
        return this.freeCosts ? 0 : arsenalItem(kind, id).price;
    }

    // ¿Está desbloqueada la clase i? (la primera, de serie; las demás, compradas con oro)
    classOpen(i) {
        return this.gatesOff || this.arsenal.classOwned.includes(i);
    }

    classPrice(i) {
        return this.freeCosts ? 0 : CLASSES[i].price;
    }

    // Desbloquear la clase i con oro (false si no llega)
    buyClass(i) {
        if (this.classOpen(i) || this.items.gold < this.classPrice(i)) return false;
        this.items.gold -= this.classPrice(i);
        this.arsenal.classOwned.push(i);
        this.save();
        return true;
    }

    // Equipar la clase i (la que se lleva al campo de tiro)
    useClass(i) {
        if (!this.classOpen(i)) return false;
        this.arsenal.active = i;
        this.arsenal.loadout = this.arsenal.classes[i];
        this.save();
        return true;
    }

    // Poner o quitar una racha de bajas en la clase i
    toggleStreak(i, id) {
        const c = this.arsenal.classes[i];
        c.ks = c.ks.includes(id) ? c.ks.filter((x) => x !== id) : [...c.ks, id];
        this.save();
    }

    // Comprarlo (si no se tenía, con oro) y montarlo en la clase ci (la equipada si no se dice);
    // false si no llega el oro
    equipGear(kind, id, ci = this.arsenal.active) {
        if (!this.ownsGear(kind, id)) {
            const price = this.gearPrice(kind, id);
            if (this.items.gold < price) return false;
            this.items.gold -= price;
            this.arsenal.owned.push(`${kind}:${id}`);
        }
        this.arsenal.classes[ci][kind] = id;
        this.save();
        return true;
    }

    // Depuración: toda la armería comprada
    ownAllGear() {
        const all = ARSENAL_KINDS.flatMap((kind) => ARSENAL[kind].filter((x) => x.price && !this.ownsGear(kind, x.id)).map((x) => `${kind}:${x.id}`));
        if (!all.length) return false;
        this.arsenal.owned.push(...all);
        this.save();
        return true;
    }

    // Atajo: el trigo recogido (lo más usado)
    get wheat() {
        return this.items.wheat;
    }

    set wheat(v) {
        this.items.wheat = v;
    }

    sheaves(id) {
        return levelsOf(id)[this.fields[id].level].sheaves;
    }

    maxed(id) {
        return this.fields[id].level >= levelsOf(id).length - 1;
    }

    // Lo que cuesta mejorar el campo id, por recurso (todo a 0 con la depuración de costes)
    cost(id) {
        const c = FIELD_BY_ID[id].cost;
        return this.freeCosts ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    // ¿Hay de todo lo que pide la mejora?
    affordable(id) {
        return Object.entries(this.cost(id)).every(([c, n]) => this.items[c] >= n);
    }

    canUpgrade(id) {
        return this.fields[id].unlocked && !this.maxed(id) && this.affordable(id);
    }

    // ---------- Los mercaderes ----------
    // (el primero, el de siempre: state.merchant)
    get merchant() {
        return this.merchants.m0;
    }

    set merchant(M) {
        this.merchants.m0 = M;
    }

    trustOf(id = 'm0') {
        return trustLevel(this.merchants[id].trust);
    }

    get trustLv() {
        return this.trustOf('m0');
    }

    // Los encargos de la visita (se piden al llegar). Antes de pedir los nuevos, cuenta cómo fue la
    // anterior que viste: todo cumplido sube la racha (cada GIFT_EVERY, un regalo) y lo pone
    // contento; nada entregado dos veces seguidas lo pone serio
    ordersFor(visit, id = 'm0') {
        const M = this.merchants[id];
        if (M.visit === visit) return M.orders;
        if (M.visit >= 0 && M.orders.length) {
            const done = M.orders.filter((o) => o.done).length;
            if (done === M.orders.length) {
                M.streak++;
                M.missed = 0;
                M.mood = 'happy';
                if (M.streak % GIFT_EVERY === 0) M.gift = this.giftItem(id);
            } else {
                M.streak = 0;
                M.missed = done ? 0 : M.missed + 1;
                M.mood = M.missed >= 2 ? 'serious' : 'neutral';
            }
        }
        this.newOrders(visit, id);
        return M.orders;
    }

    // Los encargos nuevos: el primero, de su cultivo favorito (si tienes ese campo; lo paga mejor);
    // los demás, de los campos que hay, en cantidad según su nivel. Con más confianza paga más y
    // pide más variado (combinado, urgente, especial). La nave madre, más grande y paga más
    newOrders(visit, id = 'm0') {
        const M = this.merchants[id], def = MERCHANT_BY_ID[id], lv = this.trustOf(id);
        const fields = FARM.fields.filter((f) => this.fields[f.id].unlocked);
        if (!fields.length) fields.push(FARM.fields[0]);
        const fav = fields.find((f) => f.crop === def.fav);
        // (celoso: si a otro le tienes bastante más confianza, paga más para recuperarte; en día de
        // mercado, todos pagan más)
        M.jealous = MERCHANTS.some((d) => d.id !== id && this.trustOf(d.id) >= lv + JEALOUS.gap);
        M.market = marketNow();
        const pay = (1 + TRUST_PAY * (lv - 1)) * MOOD_PAY[M.mood] * (rareVisit(visit) ? RARE.pay : 1) * def.pay * (M.jealous ? JEALOUS.pay : 1) * (M.market ? MARKET.pay : 1);
        const [a, b] = MERCHANT.size, big = def.mother ? 1.6 : 1;
        const size = (f, k = 1) => Math.max(MERCHANT.min, Math.round((this.sheaves(f.id) * (a + Math.random() * (b - a)) * k * big) / MERCHANT.step) * MERCHANT.step);
        const gold = (want) => Math.ceil(Object.entries(want).reduce((g, [c, n]) => g + n * MERCHANT.rate[c] * (c === def.fav ? FAV_PAY : 1), 0) * pay);
        const orders = [];
        const count = MERCHANT.orders - (M.mood === 'serious' ? 1 : 0);
        for (let k = 0; k < count; k++) {
            // El primero, de su favorito; los demás, repartidos entre los campos que haya
            const f = k === 0 && fav ? fav : fields[(k + visit) % fields.length], n = size(f);
            orders.push({ crop: f.crop, n, gold: gold({ [f.crop]: n }), done: false });
        }
        // Combinado (desde el nivel 2, con dos campos o más): varios cultivos a la vez, paga más
        if (lv >= 2 && fields.length >= 2) {
            const items = {};
            for (let k = 0; k < Math.min(fields.length, lv >= 4 ? 3 : 2); k++) {
                const f = fields[(k + visit + 1) % fields.length];
                items[f.crop] = size(f, 0.6);
            }
            const c0 = Object.keys(items)[0];
            orders[orders.length - 1] = { kind: 'basket', crop: c0, n: items[c0], items, gold: Math.ceil(gold(items) * BASKET_PAY), done: false };
        }
        // Urgente (desde el nivel 3): con cuenta atrás; a tiempo, paga URGENT.pay veces
        if (lv >= 3 && orders.length > 1) Object.assign(orders[1], { kind: 'urgent', until: Date.now() + URGENT.secs * 1000 });
        // Especial (desde el nivel 2, una visita sí y otra no; desde el 4, siempre): mucho de su
        // favorito a cambio de uno de sus objetos raros (si ya los tienes todos, oro)
        if (lv >= 2 && (lv >= 4 || visit % 2 === 0)) {
            const f = fav || fields[fields.length - 1], n = size(f, SPECIAL.size), reward = decorOf(id).map((d) => d.id).find((d) => !this.village.includes(d) && d !== M.gift) || null;
            orders.push({ kind: 'special', crop: f.crop, n, gold: reward ? gold({ [f.crop]: n }) : Math.ceil(gold({ [f.crop]: n }) * SPECIAL.gold), reward, done: false });
        }
        M.visit = visit;
        M.orders = orders;
        this.save();
        return orders;
    }

    // Lo que paga ahora (el urgente, a tiempo, más)
    payOf(o) {
        return o.until && Date.now() < o.until ? o.gold * URGENT.pay : o.gold;
    }

    canDeliver(o) {
        return !o.done && Object.entries(orderWants(o)).every(([c, n]) => this.items[c] >= n);
    }

    // Entregar un encargo: se da lo que pide y se cobra en oro (y el objeto, el especial). Sube la
    // confianza (más los especiales y combinados; y uno más al cumplirlo todo). Devuelve qué pasó
    deliver(visit, i, id = 'm0') {
        const M = this.merchants[id], o = this.ordersFor(visit, id)[i];
        if (!o || !this.canDeliver(o)) return false;
        const lv = this.trustOf(id), paid = this.payOf(o);
        for (const [c, n] of Object.entries(orderWants(o))) this.items[c] -= n;
        this.items.gold += paid;
        o.done = true;
        o.paid = paid;
        if (o.reward && !this.village.includes(o.reward)) this.village.push(o.reward);
        M.trust += o.kind === 'special' || o.kind === 'basket' ? 2 : 1;
        const all = M.orders.every((q) => q.done);
        if (all) M.trust++;
        if (marketNow()) this.flags.market = true;
        this.story.sold = true; // (la primera venta: el trigo mágico tiene una idea)
        this.save();
        return { paid, reward: o.reward || null, all, levelUp: this.trustOf(id) > lv ? this.trustOf(id) : 0 };
    }

    // ---------- Sus tiendas, sus regalos y el pueblo ----------
    // Lo que vende cada uno: sus objetos raros
    stock(visit, id = 'm0') {
        const out = decorOf(id).map((d) => d.id);
        // (la nave madre, además, el exclusivo de esta visita)
        const ex = MERCHANT_BY_ID[id].mother ? exclusiveFor(visit, this.village) : null;
        return ex ? [...out, ex] : out;
    }

    collects(item) {
        return this.village.includes(item);
    }

    buy(visit, item, id = 'm0') {
        const it = DECOR_BY_ID[item];
        if (!it || it.by !== id || this.collects(item) || this.items.gold < it.gold || !this.stock(visit, id).includes(item)) return false;
        this.items.gold -= it.gold;
        this.village.push(item);
        this.save();
        return true;
    }

    // El regalo de la racha: uno de sus objetos que no tengas (o, si los tienes todos, oro)
    giftItem(id = 'm0') {
        return decorOf(id).map((d) => d.id).find((d) => !this.village.includes(d)) || 30;
    }

    claimGift(id = 'm0') {
        const M = this.merchants[id], g = M.gift;
        if (g === null) return null;
        if (typeof g === 'number') this.items.gold += g;
        else if (!this.village.includes(g)) this.village.push(g);
        M.gift = null;
        this.flags.gift = true;
        this.save();
        return g;
    }

    // Los logros que se acaban de conseguir (dan su oro una vez)
    checkMedals() {
        const got = MEDALS.filter((m) => !this.medals.includes(m.id) && m.test(this));
        for (const m of got) {
            this.medals.push(m.id);
            this.items.gold += m.gold;
        }
        if (got.length) this.save();
        return got;
    }

    // El nivel del pueblo (según cuántas cosas tiene); si acaba de subir, lo devuelve (y da su oro)
    get villageLevel() {
        return villageLevel(this.village.length);
    }

    checkVillage() {
        const lv = this.villageLevel;
        if (lv <= this.villageLv) return null;
        let gold = 0;
        for (let k = this.villageLv + 1; k <= lv; k++) gold += VILLAGE_LEVELS[k].gold;
        this.villageLv = lv;
        this.items.gold += gold;
        this.save();
        return { lv, gold };
    }

    // ---------- Torretas automáticas (la mejora extra con el campo al máximo) ----------
    turretCost(id) {
        const c = FIELD_BY_ID[id].turrets;
        return this.freeCosts ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    canBuyTurrets(id) {
        const f = this.fields[id];
        return f.unlocked && this.maxed(id) && !f.turrets && this.affordableCost(this.turretCost(id));
    }

    buyTurrets(id, force = false) {
        if (!force && !this.canBuyTurrets(id)) return false;
        if (this.fields[id].turrets) return false;
        if (!force) for (const [c, n] of Object.entries(this.turretCost(id))) this.items[c] -= n;
        this.fields[id].turrets = true;
        this.fields[id].ammo = TURRETS.ammo;
        this.save();
        return true;
    }

    // Munición de la torreta: gasta una bala-mata (false si ya no le queda)
    useTurretAmmo(id) {
        const f = this.fields[id];
        if (!f.turrets || f.ammo <= 0) return false;
        f.ammo--;
        this.save();
        return true;
    }

    turretEmpty(id) {
        const f = this.fields[id];
        return f.turrets && f.ammo <= 0;
    }

    // Lo que cuesta recargarla: la parte que le falta del precio entero (al menos 1 moneda)
    reloadCost(id) {
        if (this.freeCosts) return 0;
        return Math.max(1, Math.ceil(TURRETS.reload * (1 - this.fields[id].ammo / TURRETS.ammo)));
    }

    canReloadTurret(id) {
        const f = this.fields[id];
        return f.turrets && f.ammo < TURRETS.ammo && this.items.gold >= this.reloadCost(id);
    }

    reloadTurret(id) {
        if (!this.canReloadTurret(id)) return false;
        this.items.gold -= this.reloadCost(id);
        this.fields[id].ammo = TURRETS.ammo;
        this.save();
        return true;
    }

    // Un terreno bloqueado se puede desbloquear ya, cuando el campo del que depende (after) está al
    // máximo, cuando se ha comprado su parcela (land) o, el trigo, con el granero abierto (barn)
    canUnlock(id) {
        const lock = FIELD_BY_ID[id].locked;
        return !!lock && !this.fields[id].unlocked && (!lock.after || this.maxed(lock.after)) && (!lock.land || this.lands[lock.land]) && (!lock.barn || this.open('barn'));
    }

    // ---------- Progresión ----------
    // Lo que se va abriendo, en orden: el granero nada más empezar; el trigo; con él a nivel 2, las
    // rachas de cultivos; a nivel 3, las alienígenas y los alienígenas a pie; al máximo, la caja
    // sorpresa y los tomates; con los tomates, también los ovnis; con los tomates al máximo, el
    // mercader; tras la primera venta, la casa y las parcelas en venta; con la casa al máximo, su
    // tienda. Los regalos del trigo mágico y la llamada del mercader van guardados en story
    open(gate) {
        if (this.gatesOff) return true;
        const S = this.story;
        switch (gate) {
            case 'barn': return this.barn.open;
            case 'grenades': return !!S.crop;
            case 'aliens': return !!S.alien;
            case 'ufos': return !!S.alien && this.fields.tomato.unlocked;
            case 'box': return !!S.box;
            case 'merchant': return !!S.merchant;
            case 'house': case 'lands': return !!S.house;
            case 'shop': return !!S.house && this.houseMaxed;
        }
        return true;
    }

    // Un paso de la historia hecho (true si no lo estaba)
    tell(step) {
        if (this.story[step]) return false;
        this.story[step] = true;
        this.save();
        return true;
    }

    openBarn() {
        if (this.barn.open) return false;
        this.barn.open = true;
        this.save();
        return true;
    }

    // ---------- Parcelas en venta ----------
    // La parcela del campo id (si es de las que se compran)
    landOf(id) {
        const lock = FIELD_BY_ID[id].locked;
        return lock && lock.land ? LAND_BY_ID[lock.land] : null;
    }

    landPrice(landId) {
        return this.freeCosts ? 0 : LAND_BY_ID[landId].price;
    }

    canBuyLand(landId) {
        return this.open('lands') && !this.lands[landId] && this.items.gold >= this.landPrice(landId);
    }

    // Comprar una parcela con oro (luego su campo se desbloquea con el barril)
    buyLand(landId) {
        if (!this.canBuyLand(landId)) return false;
        this.items.gold -= this.landPrice(landId);
        this.lands[landId] = true;
        this.save();
        return true;
    }

    // Terreno limpio: queda sembrado y listo para recoger la primera vez. force: sin mirar lo
    // que pide (depuración)
    unlock(id, now = Date.now(), force = false) {
        if (this.fields[id].unlocked || (!force && !this.canUnlock(id))) return false;
        const land = this.landOf(id);
        if (land) this.lands[land.id] = true; // (a la fuerza en DEBUG: también queda comprada)
        const f = this.fields[id];
        f.unlocked = true;
        f.plantedAt = now - growMs(id);
        f.left = this.sheaves(id);
        this.save();
        return true;
    }

    // Avance de 0 a 1 (1 = listo para recoger)
    progress(id, now = Date.now()) {
        const f = this.fields[id];
        if (!f.unlocked) return 0;
        return Math.min(1, Math.max(0, (now - f.plantedAt) / growMs(id)));
    }

    isReady(id, now) {
        return this.fields[id].unlocked && this.progress(id, now) >= 1 && this.fields[id].left > 0;
    }

    // Mejora el campo: más grande y con más blancos (los nuevos se suman a los que quedan)
    upgrade(id) {
        if (!this.canUpgrade(id)) return false;
        const before = this.sheaves(id);
        for (const [c, n] of Object.entries(this.cost(id))) this.items[c] -= n;
        this.fields[id].level++;
        this.fields[id].left += this.sheaves(id) - before;
        this.save();
        return true;
    }

    // Un blanco que se han llevado los alienígenas del campo id: se pierde (no suma a lo
    // recogido). Si era el último, se vuelve a sembrar.
    lose(id, now = Date.now()) {
        const f = this.fields[id];
        if (f.left <= 0) return false;
        if (--f.left === 0) {
            f.plantedAt = now;
            f.left = this.sheaves(id);
        }
        this.save();
        return true;
    }

    // Un blanco recogido en el campo id. Al recoger el último, se vuelve a sembrar.
    collect(id, now = Date.now()) {
        const f = this.fields[id];
        if (f.left <= 0) return false;
        f.left--;
        this.items[FIELD_BY_ID[id].crop]++;
        if (f.left === 0) {
            f.plantedAt = now;
            f.left = this.sheaves(id);
        }
        this.save();
        return true;
    }
}
