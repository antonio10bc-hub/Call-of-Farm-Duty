import { CROPS } from '../content/crops.js';
import { FARM, FIELD_BY_ID, LAND_BY_ID } from '../content/farm.js';
import { SHOP_ITEMS, DEFAULT_LOOK } from '../content/ufo.js';
import { RIFLE, RIFLE_BY_ID, RIFLE_MAX } from '../content/rifle.js';
import { MERCHANT } from '../content/merchant.js';

// Estado de la granja: lo recogido de cada cultivo, cada campo (desbloqueado o no, nivel, hora
// de siembra y blancos que quedan), el nivel del granero y las mejoras del rifle.
// Se guarda en el navegador; sin almacenamiento simplemente no se recuerda.
const KEY = 'cofd.farm.v4';
// Revisión de la partida guardada. 2: campos de tiro grandes (se rellenan los blancos que se
// guardaron con las cifras de antes). 3: niveles del granero (las partidas de antes, que ya
// tenían granada y misil Predator, empiezan con el granero en el nivel 2). 4: niveles de la
// casa (las de antes, con la casa ya arreglada, empiezan en el nivel 1)
const REV = 4;
const BARN = FARM.barn.levels;
const VILLAGE = MERCHANT.village.levels;
const HOUSE = FARM.house.levels;
const OLD_KEYS = ['cofd.farm.v3', 'cofd.farm.v2']; // v3: un solo campo de trigo
const levelsOf = (id) => FIELD_BY_ID[id].levels;
const growMs = (id) => CROPS[FIELD_BY_ID[id].crop].growTime * 1000;

export class FarmState {
    constructor(now = Date.now()) {
        this.freeCosts = false; // depuración: las mejoras de campos y granero a 0
        this.freeHome = false; // depuración: las mejoras de la casa y la tienda del ovni a 0
        this.barn = { level: 0 };
        this.house = { level: 0 };
        // Nivel de cada mejora del rifle (content/rifle.js)
        this.rifle = Object.fromEntries(RIFLE.map((r) => [r.id, 0]));
        // Lo recogido de cada cultivo, las monedas alienígenas (alien) y las de oro (gold, del
        // comerciante)
        this.items = Object.fromEntries([...Object.keys(CROPS), 'alien', 'gold'].map((c) => [c, 0]));
        // El comerciante: la visita de la que son los encargos que hay (cada uno: cultivo, cuánto,
        // cuánto oro paga y si ya se ha entregado)
        this.merchant = { visit: -1, orders: [] };
        // El poblado del comerciante (de 0 a MERCHANT.village.levels.length - 1)
        this.village = { level: 0 };
        // Parcelas compradas con oro (content/farm.js: lands)
        this.lands = Object.fromEntries(FARM.lands.filter((l) => l.price).map((l) => [l.id, false]));
        // El ovni (crashed: ya se ha estrellado en la parcela de la casa; met: ya se ha abierto su
        // tienda alguna vez) y la casa personalizada en su tienda: lo comprado (owned) y lo que
        // lleva puesto en cada parte (look)
        this.ufo = { crashed: false, met: false };
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
                for (const c of Object.keys(this.items)) this.items[c] = (d.items && d.items[c]) | 0;
                this.barn.level = Math.min(BARN.length - 1, Math.max(0, d.barn ? d.barn.level | 0 : (d.rev | 0) < 3 ? 2 : 0));
                this.house.level = Math.min(HOUSE.length - 1, Math.max(0, d.house ? d.house.level | 0 : (d.rev | 0) < 4 ? 1 : 0));
                for (const r of RIFLE) this.rifle[r.id] = Math.min(RIFLE_MAX, Math.max(0, d.rifle ? d.rifle[r.id] | 0 : 0));
                this.ufo.crashed = !!(d.ufo && d.ufo.crashed);
                for (const id of Object.keys(this.lands)) this.lands[id] = !!(d.lands && d.lands[id]);
                this.village.level = Math.min(VILLAGE.length - 1, Math.max(0, d.village ? d.village.level | 0 : 0));
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
                this.house.level = 1;
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
            localStorage.setItem(KEY, JSON.stringify({ rev: REV, items: this.items, fields: this.fields, barn: this.barn, house: this.house, rifle: this.rifle, ufo: this.ufo, home: this.home, merchant: this.merchant, lands: this.lands, village: this.village }));
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

    get canUpgradeBarn() {
        return !this.barnMaxed && Object.entries(this.barnCost()).every(([c, n]) => this.items[c] >= n);
    }

    // Sube el granero (agranda su recinto); false si no se puede
    upgradeBarn() {
        if (!this.canUpgradeBarn) return false;
        for (const [c, n] of Object.entries(this.barnCost())) this.items[c] -= n;
        this.barn.level++;
        this.save();
        return true;
    }

    // ---------- Mejoras del rifle (en el granero) ----------
    rifleMaxed(id) {
        return this.rifle[id] >= RIFLE_MAX;
    }

    // Lo que cuesta el siguiente nivel de la mejora id (todo a 0 con la depuración de costes)
    rifleCost(id) {
        const c = this.rifleMaxed(id) ? {} : RIFLE_BY_ID[id].cost[this.rifle[id]];
        return this.freeCosts ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    canUpgradeRifle(id) {
        return !this.rifleMaxed(id) && this.affordableCost(this.rifleCost(id));
    }

    upgradeRifle(id) {
        if (!this.canUpgradeRifle(id)) return false;
        for (const [c, n] of Object.entries(this.rifleCost(id))) this.items[c] -= n;
        this.rifle[id]++;
        this.save();
        return true;
    }

    // Depuración: todas las mejoras del rifle al máximo
    maxRifle() {
        if (RIFLE.every((r) => this.rifleMaxed(r.id))) return false;
        for (const r of RIFLE) this.rifle[r.id] = RIFLE_MAX;
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
        const V = VILLAGE[this.village.level];
        for (let k = 0; k < V.orders; k++) {
            // Cada encargo de un campo (repartidos entre los que haya)
            const f = fields[(k + visit) % fields.length], [a, b] = MERCHANT.size;
            const n = Math.max(MERCHANT.min, Math.round((this.sheaves(f.id) * (a + Math.random() * (b - a))) / MERCHANT.step) * MERCHANT.step);
            orders.push({ crop: f.crop, n, gold: Math.ceil(n * MERCHANT.rate[f.crop] * V.pay), done: false });
        }
        this.merchant = { visit, orders };
        this.save();
        return orders;
    }

    // ---------- Poblado del comerciante ----------
    get villageMaxed() {
        return this.village.level >= VILLAGE.length - 1;
    }

    villageCost() {
        const c = this.villageMaxed ? {} : VILLAGE[this.village.level + 1].cost;
        return this.freeCosts ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
    }

    get canUpgradeVillage() {
        return !this.villageMaxed && this.affordableCost(this.villageCost());
    }

    upgradeVillage() {
        if (!this.canUpgradeVillage) return false;
        for (const [c, n] of Object.entries(this.villageCost())) this.items[c] -= n;
        this.village.level++;
        this.save();
        return true;
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
    // máximo o cuando se ha comprado su parcela (land)
    canUnlock(id) {
        const lock = FIELD_BY_ID[id].locked;
        return !!lock && !this.fields[id].unlocked && (!lock.after || this.maxed(lock.after)) && (!lock.land || this.lands[lock.land]);
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
