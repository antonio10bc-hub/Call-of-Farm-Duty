import { THEME } from '../content/theme.js';

const C = THEME.cycle, LEN = C.day + C.night;

// Ciclo de día y noche con el reloj de verdad (así sigue donde iba aunque se recargue la página).
// k: lo de noche que es, de 0 (día) a 1 (noche cerrada), con su transición al final de cada parte.
// force: 'day', 'night' o 'dusk' (atardecer, el del prólogo) para fijarlo; null, el del reloj.
// dusk: lo de amanecer/atardecer que es (0..1): sube y baja en cada transición.
export class DayNight {
    constructor(force = null) {
        this.force = force;
        this.hold = false; // de día hasta que el reloj llegue al día (al acabar el prólogo)
    }

    // Segundos desde que empezó este ciclo
    t(now = Date.now()) {
        return (now / 1000) % LEN;
    }

    get k() {
        if (this.force) return this.force === 'night' ? 1 : this.force === 'dusk' ? 0.12 : 0;
        const t = this.t();
        if (this.hold) {
            if (t < C.day - C.fade) this.hold = false;
            else return 0;
        }
        if (t < C.day) return Math.max(0, (t - (C.day - C.fade)) / C.fade);
        return Math.min(1, Math.max(0, (LEN - t) / C.fade));
    }

    get dusk() {
        if (this.force) return this.force === 'dusk' ? 1 : 0;
        const k = this.k;
        return Math.min(1, Math.sin(k * Math.PI) * 1.4);
    }

    get night() {
        return this.k > 0.5;
    }

    // Segundos que faltan para que cambie (de día a noche o al revés); null si está fijado
    get left() {
        if (this.force || this.hold) return null;
        const t = this.t();
        return t < C.day ? C.day - t : LEN - t;
    }
}
