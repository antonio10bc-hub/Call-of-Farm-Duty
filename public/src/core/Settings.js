// Preferencias del jugador (música, sonido, vibración, estadísticas anónimas, tamaño de interfaz). Se guardan en el navegador;
// si el almacenamiento no está disponible, simplemente no se recuerdan.
const KEY = 'cofd.settings';
// analytics: null mientras no ha contestado al aviso; true/false después
// uiSize: tamaño de la interfaz en el ordenador ('small' | 'normal' | 'large')
// pixel: tamaño del píxel del juego en el ordenador ('big' | 'normal' | 'fine'; fino por defecto)
// freeCosts: depuración, las mejoras de campos y granero cuestan 0
// freeHome: depuración, las de la casa y lo de la tienda del ovni cuestan 0
// streaks: depuración, bajas que pide cada racha ({ grenade: 5, ... }; null = las normales)
// daytime: depuración, 'day' o 'night' fijos (null = el ciclo del reloj)
// merchant: depuración, el comerciante 'here' o 'away' fijo (null = el del reloj)
// boxFast: depuración, la caja sorpresa sale enseguida (a los pocos segundos, y vuelve pronto)
// boxPick: depuración, el arma que da la caja ('rpg', 'ray', 'xbow'; null = al azar)
// startWonder: depuración, se empieza el campo de tiro con esa arma de la caja (null = el fusil)
// cowsFull: depuración, las vacas salen con la ubre llena (gigantes y botando)
// noAliens: depuración, sin alienígenas a pie ni ovnis en el campo de tiro
const DEFAULTS = { music: true, sfx: true, vibration: true, analytics: null, uiSize: 'normal', pixel: 'fine', freeCosts: false, freeHome: false, streaks: null, daytime: null, merchant: null, boxFast: false, boxPick: null, startWonder: null, cowsFull: false, noAliens: false };

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
