// Preferencias del jugador (música, sonido, vibración, estadísticas anónimas, tamaño de interfaz). Se guardan en el navegador;
// si el almacenamiento no está disponible, simplemente no se recuerdan.
const KEY = 'cofd.settings';
// analytics: null mientras no ha contestado al aviso; true/false después
// uiSize: tamaño de la interfaz en el ordenador ('small' | 'normal' | 'large')
// pixel: tamaño del píxel del juego en el ordenador ('big' | 'normal' | 'fine'; fino por defecto)
// freeCosts: depuración, todas las mejoras cuestan 0
const DEFAULTS = { music: true, sfx: true, vibration: true, analytics: null, uiSize: 'normal', pixel: 'fine', freeCosts: false };

export const Settings = {
    ...DEFAULTS,

    load() {
        try {
            Object.assign(this, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
        } catch {
            /* sin almacenamiento: valores por defecto */
        }
        return this;
    },

    toggle(key) {
        return this.set(key, !this[key]);
    },

    set(key, value) {
        this[key] = value;
        try {
            const out = {};
            for (const k of Object.keys(DEFAULTS)) out[k] = this[k];
            localStorage.setItem(KEY, JSON.stringify(out));
        } catch {
            /* ignorar */
        }
        return value;
    },
};
