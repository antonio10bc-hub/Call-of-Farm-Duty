import { CROPS } from '../content/crops.js';
import { FARM, FIELD_BY_ID, LAND_BY_ID } from '../content/farm.js';
import { SHOP_ITEMS, DEFAULT_LOOK } from '../content/ufo.js';
import { ARSENAL, ARSENAL_KINDS, DEFAULT_LOADOUT, CLASSES, arsenalItem } from '../content/arsenal.js';
import { KILLSTREAKS } from '../content/killstreaks.js';
import { MERCHANT } from '../content/merchant.js';

// Estado de la granja: lo recogido de cada cultivo, cada campo (desbloqueado o no, nivel, hora
// de siembra y blancos que quedan), el nivel del granero y el equipo del fusil.
// Se guarda en el navegador; sin almacenamiento simplemente no se recuerda.
const KEY = 'cofd.farm.v4';
// Revisión de la partida guardada. 2: campos de tiro grandes (se rellenan los blancos que se
// guardaron con las cifras de antes). 3: niveles del granero (las partidas de antes, que ya
// tenían granada y misil Predator, empiezan con el granero en el nivel 2). 4: niveles de la
// casa (las de antes, con la casa ya arreglada, empiezan en el nivel 1)
const REV = 4;
const BARN = FARM.barn.levels;
const HOUSE = FARM.house.levels;
const OLD_KEYS = ['cofd.farm.v3', 'cofd.farm.v2']; // v3: un solo campo de trigo
const levelsOf = (id) => FIELD_BY_ID[id].levels;
const growMs = (id) => CROPS[FIELD_BY_ID[id].crop].growTime * 1000;

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
        this.arsenal = { owned: [], active: 0, classes: CLASSES.map(() => ({ ...DEFAULT_LOADOUT, ks: [...ks] })) };
        this.arsenal.loadout = this.arsenal.classes[0];
        // Lo recogido de cada cultivo y las monedas de oro (gold: la moneda del juego, la paga el
        // comerciante; son de cartón, pero que no se entere nadie)
        this.items = Object.fromEntries([...Object.keys(CROPS), 'gold'].map((c) => [c, 0]));
        // El comerciante: la visita de la que son los encargos que hay (cada uno: cultivo, cuánto,
        // cuánto oro paga y si ya se ha entregado)
        this.merchant = { visit: -1, orders: [] };
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
        this.fields = Object.fromEntries(FARM.fields.map((f) => [f.id, {
            unlocked: !f.locked,
            turrets: false,
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
                    this.arsenal.loadout = this.arsenal.classes[this.arsenal.active];
                }
                // Las monedas alienígenas de antes pasan a ser de oro (la única moneda)
                if (d.items && d.items.alien) this.items.gold += (d.items.alien | 0) * 3;
                for (const id of Object.keys(this.lands)) this.lands[id] = !!(d.lands && d.lands[id]);
                if (d.merchant && Array.isArray(d.merchant.orders)) this.merchant = { visit: d.merchant.visit | 0, orders: d.merchant.orders.filter((o) => o && CROPS[o.crop]) };
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
                    // Lo que está creciendo sale con las cifras de su nivel (si cambian en el
                    // contenido, al cargar ya valen); lo maduro guardado antes de la revisión 2,
                    // también, aunque ya se hubiera empezado a recoger
                    if (f.unlocked && (!this.isReady(id) || (d.rev | 0) < 2)) f.left = Math.max(this.isReady(id) ? f.left : 0, this.sheaves(id));
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
            localStorage.setItem(KEY, JSON.stringify({ rev: REV, prologue: this.prologue, items: this.items, fields: this.fields, barn: this.barn, house: this.house, arsenal: this.arsenal, ufo: this.ufo, home: this.home, merchant: this.merchant, lands: this.lands }));
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
        return !this.houseMaxed && Object.entries(this.houseCost()).every(([c, n]) => this.items[c] >= n);
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

    // ---------- Granero ----------
    get barnMaxed() {
        return this.barn.level >= BARN.length - 1;
    }

    // Lo que cuesta el siguiente nivel del granero (todo a 0 con la depuración de costes)
    barnCost() {
        const c = this.barnMaxed ? {} : BARN[this.barn.level + 1].cost;
        return this.freeCosts ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    // El granero ya no se mejora: se queda como está
    get canUpgradeBarn() {
        return false;
    }

    // Sube el granero (agranda su recinto); false si no se puede
    upgradeBarn() {
        if (!this.canUpgradeBarn) return false;
        for (const [c, n] of Object.entries(this.barnCost())) this.items[c] -= n;
        this.barn.level++;
        this.save();
        return true;
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

    // ¿Está abierta la clase i? (las últimas, con su paso de la progresión)
    classOpen(i) {
        return !CLASSES[i].open || this.open(CLASSES[i].open);
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

    // ---------- Comerciante ----------
    // Los encargos de la visita (se piden al llegar: cultivos de los campos que hay, en cantidad
    // según su nivel)
    ordersFor(visit) {
        if (this.merchant.visit === visit) return this.merchant.orders;
        const fields = FARM.fields.filter((f) => this.fields[f.id].unlocked);
        if (!fields.length) fields.push(FARM.fields[0]);
        const orders = [];
        for (let k = 0; k < MERCHANT.orders; k++) {
            // Cada encargo de un campo (repartidos entre los que haya)
            const f = fields[(k + visit) % fields.length], [a, b] = MERCHANT.size;
            const n = Math.max(MERCHANT.min, Math.round((this.sheaves(f.id) * (a + Math.random() * (b - a))) / MERCHANT.step) * MERCHANT.step);
            orders.push({ crop: f.crop, n, gold: Math.ceil(n * MERCHANT.rate[f.crop]), done: false });
        }
        this.merchant = { visit, orders };
        this.save();
        return orders;
    }

    canDeliver(o) {
        return !o.done && this.items[o.crop] >= o.n;
    }

    // Entregar un encargo: se da lo que pide y se cobra en oro
    deliver(visit, i) {
        const o = this.ordersFor(visit)[i];
        if (!o || !this.canDeliver(o)) return false;
        this.items[o.crop] -= o.n;
        this.items.gold += o.gold;
        o.done = true;
        this.save();
        return true;
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
    // Lo que se va abriendo, en orden: el granero nada más empezar; el trigo; las rachas de
    // granadas con el trigo a nivel 2; los tomates con el trigo al máximo; las rachas alienígenas
    // con los tomates a nivel 2; y con los tomates al máximo, el mercader y la tienda de la casa
    // (con su oro se compran las demás parcelas)
    open(gate) {
        if (this.gatesOff) return true;
        const lv = (id) => (this.fields[id].unlocked ? this.fields[id].level : -1);
        switch (gate) {
            case 'barn': return this.barn.open;
            case 'grenades': return lv('wheat') >= 1;
            case 'aliens': return lv('tomato') >= 1;
            case 'ufos': return this.fields.tomato.unlocked;
            case 'merchant': case 'shop': return this.fields.tomato.unlocked && this.maxed('tomato');
        }
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
        return !this.lands[landId] && this.items.gold >= this.landPrice(landId);
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
