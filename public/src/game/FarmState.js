import { CROPS } from '../content/crops.js';
import { FARM } from '../content/farm.js';

// Estado de la granja: el campo de trigo (nivel, hora de siembra y matas que quedan) y el trigo
// recogido. Se guarda en el navegador; sin almacenamiento simplemente no se recuerda.
const KEY = 'cofd.farm.v3';
const OLD_KEY = 'cofd.farm.v2'; // seis campos: de ahí solo se conserva el trigo
const LEVELS = FARM.field.levels;

export class FarmState {
    constructor(now = Date.now()) {
        this.wheat = 0;
        this.level = 0; // índice en FARM.field.levels
        // Al empezar, el campo ya está listo para que se pueda jugar desde el principio
        this.plot = { crop: 'wheat', plantedAt: now - CROPS.wheat.growTime * 1000, left: LEVELS[0].sheaves };
        this.load();
    }

    load() {
        try {
            const d = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!d || !d.plot) {
                const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
                if (old) this.wheat = old.wheat | 0;
                return;
            }
            const p = d.plot;
            this.wheat = d.wheat | 0;
            this.level = Math.min(LEVELS.length - 1, Math.max(0, d.level | 0));
            this.plot = { crop: CROPS[p.crop] ? p.crop : 'wheat', plantedAt: +p.plantedAt || 0, left: p.left | 0 };
        } catch {
            /* sin almacenamiento */
        }
    }

    // Borra la partida (trigo y campo); los ajustes y el idioma se quedan
    static reset() {
        try {
            localStorage.removeItem(KEY);
            localStorage.removeItem(OLD_KEY);
        } catch {
            /* sin almacenamiento */
        }
    }

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ wheat: this.wheat, level: this.level, plot: this.plot }));
        } catch {
            /* ignorar */
        }
    }

    get sheaves() {
        return LEVELS[this.level].sheaves;
    }

    get maxed() {
        return this.level >= LEVELS.length - 1;
    }

    get canUpgrade() {
        return !this.maxed && this.wheat >= FARM.field.upgradeCost;
    }

    // Avance de 0 a 1 (1 = listo para recoger)
    progress(now = Date.now()) {
        const p = this.plot;
        return Math.min(1, Math.max(0, (now - p.plantedAt) / (CROPS[p.crop].growTime * 1000)));
    }

    isReady(now) {
        return this.progress(now) >= 1 && this.plot.left > 0;
    }

    // Mejora el campo: más grande y con más matas (las nuevas se suman a las que quedan)
    upgrade() {
        if (!this.canUpgrade) return false;
        const before = this.sheaves;
        this.wheat -= FARM.field.upgradeCost;
        this.level++;
        this.plot.left += this.sheaves - before;
        this.save();
        return true;
    }

    // Un haz recogido. Al recoger el último, se vuelve a sembrar.
    collect(now = Date.now()) {
        const p = this.plot;
        if (p.left <= 0) return false;
        p.left--;
        this.wheat++;
        if (p.left === 0) {
            p.plantedAt = now;
            p.left = this.sheaves;
        }
        this.save();
        return true;
    }
}
