import { CROPS } from '../content/crops.js';
import { FARM, FIELD_BY_ID } from '../content/farm.js';

// Estado de la granja: lo recogido de cada cultivo y cada campo (desbloqueado o no, nivel, hora
// de siembra y blancos que quedan). Se guarda en el navegador; sin almacenamiento simplemente no
// se recuerda.
const KEY = 'cofd.farm.v4';
const OLD_KEYS = ['cofd.farm.v3', 'cofd.farm.v2']; // v3: un solo campo de trigo
const levelsOf = (id) => FIELD_BY_ID[id].levels;
const growMs = (id) => CROPS[FIELD_BY_ID[id].crop].growTime * 1000;

export class FarmState {
    constructor(now = Date.now()) {
        this.freeCosts = false; // depuración: todas las mejoras a 0
        this.items = Object.fromEntries(Object.keys(CROPS).map((c) => [c, 0]));
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
                for (const [id, f] of Object.entries(this.fields)) {
                    const s = d.fields[id];
                    if (!s) continue;
                    f.unlocked = f.unlocked || !!s.unlocked;
                    f.level = Math.min(levelsOf(id).length - 1, Math.max(0, s.level | 0));
                    f.plantedAt = +s.plantedAt || 0;
                    f.left = s.left | 0;
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
            localStorage.setItem(KEY, JSON.stringify({ items: this.items, fields: this.fields }));
        } catch {
            /* ignorar */
        }
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

    // Terreno limpio: queda sembrado y listo para recoger la primera vez
    unlock(id, now = Date.now()) {
        if (!this.canUnlock(id)) return false;
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
