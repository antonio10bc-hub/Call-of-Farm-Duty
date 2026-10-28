import { CROPS } from '../content/crops.js';
import { FARM, FIELD_BY_ID } from '../content/farm.js';
import { KILLSTREAKS } from '../content/killstreaks.js';
import { SHOP_ITEMS, DEFAULT_LOOK } from '../content/ufo.js';

// Estado de la granja: lo recogido de cada cultivo, cada campo (desbloqueado o no, nivel, hora
// de siembra y blancos que quedan), el nivel del granero y las rachas de bajas equipadas en él.
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
        this.freeCosts = false; // depuración: todas las mejoras a 0
        // barn.extra: rachas desbloqueadas a mano (depuración) aunque el granero no llegue;
        // barn.slot: el hueco extra, también a mano
        this.barn = { level: 0, extra: [], slot: false };
        this.house = { level: 0 };
        this.streaks = [];
        // Lo recogido de cada cultivo y las monedas alienígenas (alien)
        this.items = Object.fromEntries([...Object.keys(CROPS), 'alien'].map((c) => [c, 0]));
        // El ovni (crashed: ya se ha estrellado en la parcela de la casa) y la casa personalizada
        // en su tienda: lo comprado (owned) y lo que lleva puesto en cada parte (look)
        this.ufo = { crashed: false };
        this.home = { owned: [], look: { ...DEFAULT_LOOK } };
        // Los terrenos bloqueados se siembran al desbloquearlos (y quedan listos para recoger)
        this.fields = Object.fromEntries(FARM.fields.map((f) => [f.id, {
            unlocked: !f.locked,
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
                if (d.barn && Array.isArray(d.barn.extra)) this.barn.extra = d.barn.extra.filter((id) => KILLSTREAKS.some((k) => k.id === id));
                this.barn.slot = !!(d.barn && d.barn.slot);
                this.house.level = Math.min(HOUSE.length - 1, Math.max(0, d.house ? d.house.level | 0 : (d.rev | 0) < 4 ? 1 : 0));
                this.ufo.crashed = !!(d.ufo && d.ufo.crashed);
                if (d.home) {
                    if (Array.isArray(d.home.owned)) this.home.owned = d.home.owned.filter((id) => SHOP_ITEMS[id]);
                    for (const [slot, id] of Object.entries((d.home && d.home.look) || {})) if (slot in this.home.look && SHOP_ITEMS[id] && this.owns(id)) this.home.look[slot] = id;
                }
                if (Array.isArray(d.streaks)) this.streaks = d.streaks.filter((id) => this.streakAvailable(id)).slice(0, this.slots);
                for (const [id, f] of Object.entries(this.fields)) {
                    const s = d.fields[id];
                    if (!s) continue;
                    f.unlocked = f.unlocked || !!s.unlocked;
                    f.level = Math.min(levelsOf(id).length - 1, Math.max(0, s.level | 0));
                    f.plantedAt = +s.plantedAt || 0;
                    f.left = s.left | 0;
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
            localStorage.setItem(KEY, JSON.stringify({ rev: REV, items: this.items, fields: this.fields, barn: this.barn, house: this.house, ufo: this.ufo, home: this.home, streaks: this.streaks }));
        } catch {
            /* ignorar */
        }
    }

    // ---------- Granero y rachas de bajas ----------
    // Huecos para llevar rachas (según el nivel del granero)
    get slots() {
        return Math.max(BARN[this.barn.level].slots, this.barn.slot ? BARN[BARN.length - 1].slots : 0);
    }

    streakAvailable(id) {
        const k = KILLSTREAKS.find((s) => s.id === id);
        return !!k && (this.barn.level >= k.barn || this.barn.extra.includes(id));
    }

    // ---------- Casa ----------
    get houseMaxed() {
        return this.house.level >= HOUSE.length - 1;
    }

    houseCost() {
        const c = this.houseMaxed ? {} : HOUSE[this.house.level + 1].cost;
        return this.freeCosts ? Object.fromEntries(Object.keys(c).map((k) => [k, 0])) : c;
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

    // Comprar (si no se tenía) y ponerlo. false si no se puede (PRONTO o sin monedas)
    buyOrWear(id) {
        const it = SHOP_ITEMS[id];
        if (!it || it.cat.soon) return false;
        if (!this.owns(id)) {
            if (!this.affordableCost(it.cost)) return false;
            for (const [c, n] of Object.entries(it.cost)) this.items[c] -= n;
            this.home.owned.push(id);
        }
        if (it.cat.slot) this.home.look[it.cat.slot] = id;
        this.save();
        return true;
    }

    // Depuración: desbloquear una racha sin subir el granero (se equipa sola si hay hueco)
    unlockStreak(id) {
        if (this.streakAvailable(id)) return false;
        this.barn.extra.push(id);
        if (this.activeStreaks.length < this.slots) this.streaks = [...this.activeStreaks, id];
        this.save();
        return true;
    }

    // Depuración: el hueco extra para llevar más rachas
    unlockSlot() {
        if (this.slots >= BARN[BARN.length - 1].slots) return false;
        this.barn.slot = true;
        this.save();
        return true;
    }

    // Las equipadas que valen ahora (las que no estén desbloqueadas no cuentan)
    get activeStreaks() {
        return this.streaks.filter((id) => this.streakAvailable(id)).slice(0, this.slots);
    }

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

    // Sube el granero; la racha que desbloquee se equipa sola si hay hueco. Devuelve la racha
    // desbloqueada (o true si no desbloquea ninguna), o false si no se puede
    upgradeBarn() {
        if (!this.canUpgradeBarn) return false;
        for (const [c, n] of Object.entries(this.barnCost())) this.items[c] -= n;
        this.barn.level++;
        const k = KILLSTREAKS.find((s) => s.barn === this.barn.level);
        if (k && !this.streaks.includes(k.id) && this.activeStreaks.length < this.slots) this.streaks.push(k.id);
        this.save();
        return k ? k.id : true;
    }

    // Equipar o quitar una racha de bajas. Sin desbloquear o sin hueco no entra: false
    toggleStreak(id) {
        this.streaks = this.activeStreaks;
        const i = this.streaks.indexOf(id);
        if (i >= 0) this.streaks.splice(i, 1);
        else if (!this.streakAvailable(id) || this.streaks.length >= this.slots) return false;
        else this.streaks.push(id);
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

    // Un terreno bloqueado se puede desbloquear ya, o cuando el campo del que depende (after)
    // está al máximo
    canUnlock(id) {
        const lock = FIELD_BY_ID[id].locked;
        return !!lock && !this.fields[id].unlocked && (!lock.after || this.maxed(lock.after));
    }

    // Terreno limpio: queda sembrado y listo para recoger la primera vez. force: sin mirar lo
    // que pide (depuración)
    unlock(id, now = Date.now(), force = false) {
        if (this.fields[id].unlocked || (!force && !this.canUnlock(id))) return false;
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
