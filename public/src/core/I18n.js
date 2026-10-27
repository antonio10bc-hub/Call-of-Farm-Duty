// Idioma del juego: el elegido en Ajustes; si no, inglés por defecto y español si el navegador
// está en español (cualquiera de sus idiomas preferidos) o si la zona horaria es de España.
// Se decide una vez al cargar (cambiarlo recarga la página).
//   L('ENGLISH', 'ESPAÑOL')  → el texto en el idioma activo (el inglés va primero: es el de base)
//   En index.html el texto escrito es el inglés y el español va en data-es (o data-es-aria)
const SPAIN_TZ = ['Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary'];

// Elegido a mano en Ajustes (gana a la detección automática)
export const LANG_KEY = 'cofd.lang';

function detect() {
    try {
        const chosen = localStorage.getItem(LANG_KEY);
        if (chosen === 'es' || chosen === 'en') return chosen;
    } catch {
        /* sin almacenamiento */
    }
    try {
        const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
        if (langs.some((l) => l && l.toLowerCase().startsWith('es'))) return 'es';
    } catch {
        /* sin navigator */
    }
    try {
        if (SPAIN_TZ.includes(Intl.DateTimeFormat().resolvedOptions().timeZone)) return 'es';
    } catch {
        /* sin Intl */
    }
    return 'en';
}

export const LANG = detect();
export const L = (en, es) => (LANG === 'es' ? es : en);

// Textos fijos de la página (index.html)
export function applyHtmlTexts(root = document) {
    document.documentElement.lang = LANG;
    if (LANG !== 'es') return;
    for (const el of root.querySelectorAll('[data-es]')) el.innerHTML = el.dataset.es;
    for (const el of root.querySelectorAll('[data-es-aria]')) el.setAttribute('aria-label', el.dataset.esAria);
}

// Cambia el idioma y recarga (todos los textos se eligen al cargar). Vuelve a abrir Ajustes.
export function switchLang() {
    try {
        localStorage.setItem(LANG_KEY, LANG === 'es' ? 'en' : 'es');
        sessionStorage.setItem('cofd.reopenSettings', '1');
    } catch {
        return;
    }
    location.reload();
}
