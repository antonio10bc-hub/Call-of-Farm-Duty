// Preferencias del jugador (música, sonido, vibración) y ajustes de depuración. Se guardan en el navegador;
// si el almacenamiento no está disponible, simplemente no se recuerdan.
const KEY = 'cofd.settings';
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
const DEFAULTS = { music: true, sfx: true, vibration: true, freeCosts: false, freeHome: false, streaks: null, daytime: null, merchant: null, boxFast: false, boxPick: null, startWonder: null, cowsFull: false, noAliens: false, fxPlus: true,
    // La sensación del disparo: feel (RESPUESTA DEL DISPARO, todo junto) y cada parte (sonido variado y eco,
    // golpe de zoom, mirilla que se abre, marcas por niveles, vibración, sacudida suave hacia arriba);
    // fxPlus (EFECTOS VISIBLES: fogonazo, casquillo, trozos, cámara lenta)
    feel: true, feelSound: true, feelFov: true, feelBloom: true, feelMarks: true, feelHaptic: true, feelShake: true,
    // Lo visible, cada cosa suelta (con fxPlus): fogonazo, humo (de serie, quitado), casquillo, trozos grandes y
    // cámara lenta; y al acertar: las partículas del blanco (con sus colores, el polvo y la onda) y la marca X
    fxFlash: true, fxSmoke: false, fxCasing: true, fxChunks: true, fxSlowmo: true, hitParticles: true, hitMark: true,
    // Más depuración: deseos gratis, lo que sale del pozo (null al azar, o 'common', 'rare', 'epic', 'dup') y balas infinitas
    freeWish: false, wishForce: null, infAmmo: false };

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

    // ¿Esta parte de la respuesta del disparo está puesta? (y la respuesta entera)
    feelOn(k) {
        return this.feel && this[k];
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
