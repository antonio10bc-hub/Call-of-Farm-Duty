import { Settings } from './Settings.js';

// Vibración en móviles compatibles (Android/Chrome). En el resto no hace nada.
const PATTERNS = {
    hurt: [70],
    shield: [25, 30, 25],
    pickup: [20],
    kill: [40, 40, 90],
    dead: [220],
    crate: [12],
    nuke: [120, 60, 220],
};

export function vibrate(name) {
    if (!Settings.vibration || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
        navigator.vibrate(PATTERNS[name] || 20);
    } catch {
        /* algunos navegadores lo bloquean sin gesto previo */
    }
}
