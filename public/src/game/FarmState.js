import { CROPS } from '../content/crops.js';

// Estado de la granja: parcelas con su hora de siembra y el trigo recogido. Se guarda en el
// navegador; sin almacenamiento simplemente no se recuerda.
const KEY = 'cofd.farm';
export const PLOT_COUNT = 8;

export class FarmState {
    constructor(now = Date.now()) {
        this.wheat = 0;
        // Al empezar, algunas parcelas ya están listas para que se pueda jugar desde el principio
        const grow = CROPS.wheat.growTime * 1000;
        this.plots = Array.from({ length: PLOT_COUNT }, (_, i) => ({
            crop: 'wheat',
            plantedAt: i < 3 ? now - grow : now - grow * (i / PLOT_COUNT),
            left: CROPS.wheat.sheaves, // haces que quedan por recoger cuando está lista
        }));
        this.load();
    }

    load() {
        try {
            const d = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!d || !Array.isArray(d.plots) || d.plots.length !== PLOT_COUNT) return;
            this.wheat = d.wheat | 0;
            this.plots = d.plots.map((p) => ({ crop: CROPS[p.crop] ? p.crop : 'wheat', plantedAt: +p.plantedAt || 0, left: p.left | 0 }));
        } catch {
            /* sin almacenamiento */
        }
    }

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ wheat: this.wheat, plots: this.plots }));
        } catch {
            /* ignorar */
        }
    }

    // Avance de 0 a 1 (1 = listo para recoger)
    progress(i, now = Date.now()) {
        const p = this.plots[i];
        return Math.min(1, Math.max(0, (now - p.plantedAt) / (CROPS[p.crop].growTime * 1000)));
    }

    isReady(i, now) {
        return this.progress(i, now) >= 1 && this.plots[i].left > 0;
    }

    readyPlots(now = Date.now()) {
        const out = [];
        for (let i = 0; i < PLOT_COUNT; i++) if (this.isReady(i, now)) out.push(i);
        return out;
    }

    // Segundos que faltan para la próxima parcela lista (0 si ya hay alguna)
    nextReadyIn(now = Date.now()) {
        let best = Infinity;
        for (let i = 0; i < PLOT_COUNT; i++) {
            if (this.isReady(i, now)) return 0;
            const p = this.plots[i];
            best = Math.min(best, (p.plantedAt + CROPS[p.crop].growTime * 1000 - now) / 1000);
        }
        return Math.max(0, best);
    }

    // Un haz recogido de la parcela i. Al recoger el último, se vuelve a sembrar.
    collect(i, now = Date.now()) {
        const p = this.plots[i];
        if (p.left <= 0) return false;
        p.left--;
        this.wheat++;
        if (p.left === 0) {
            p.plantedAt = now;
            p.left = CROPS[p.crop].sheaves;
        }
        this.save();
        return true;
    }
}
