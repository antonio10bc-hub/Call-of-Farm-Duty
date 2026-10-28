import { L } from '../core/I18n.js';

// Rachas de bajas (como en Call of Duty): cada blanco recogido suma 1 a la racha y rellena la
// barra, que se vacía cada vez más deprisa; si llega a vaciarse, la racha se pierde. Al llegar
// a cada número se lanza su recompensa sola (las bajas que consigue también suman a la racha).
// Solo cuentan las equipadas en el granero (como mucho MAX_EQUIPPED).
//   at     bajas seguidas que hacen falta (se puede cambiar en Ajustes → DEBUG)
//   icon   sprite del menú del granero (--px-<icon>)
export const KILLSTREAKS = [
    { id: 'grenade', at: 5, icon: 'ks-grenade', name: L('GRENADE', 'GRANADA'), desc: L('FLIES BY ITSELF TO THE BIGGEST BUNCH.', 'SALE SOLA HACIA EL GRUPO MÁS GORDO.') },
    { id: 'predator', at: 10, icon: 'ks-predator', name: L('PREDATOR MISSILE', 'MISIL PREDATOR'), desc: L('STEER A MISSILE FROM THE SKY.', 'GUÍA UN MISIL DESDE EL CIELO.') },
    { id: 'bomber', at: 20, icon: 'ks-bomber', name: L('BOMBER', 'BOMBARDERO'), desc: L('A HUGE PLANE BOMBS THE FIELD.', 'UN AVIÓN ENORME BOMBARDEA EL CAMPO.') },
    { id: 'nuke', at: 30, icon: 'ks-nuke', name: L('NUKE', 'BOMBA NUCLEAR'), desc: L('COUNTDOWN... AND IT HARVESTS EVERYTHING.', 'CUENTA ATRÁS... Y LO RECOGE TODO.') },
];
export const MAX_EQUIPPED = 3;
export const DEFAULT_EQUIPPED = ['grenade', 'predator'];
for (const k of KILLSTREAKS) k.normalAt = k.at;

// Depuración: bajas que pide cada racha ({ id: n }); lo que no venga, su valor normal
export function setStreakCounts(counts) {
    for (const k of KILLSTREAKS) k.at = counts && counts[k.id] > 0 ? counts[k.id] : k.normalAt;
}

export const KS = {
    // Barra de la racha: segundos para vaciarse = time * decay^(racha - 1), nunca menos de min
    bar: { time: 4, decay: 0.93, min: 1.5 },
    // Granada: sale delante de la cámara (para verla salir), vuela en arco hasta el blanco con
    // más vecinos y recoge lo que pille en radius
    grenade: { radius: 2, flight: 1.4, arc: 3 },
    // Misil Predator: vista cenital desde height; baja solo a speed (boost con el gatillo) y se
    // guía moviendo la vista (steer: metros por unidad de giro)
    predator: { height: 48, speed: 7, boost: 32, steer: 9, radius: 3.8 },
    // Bombardero: cruza el campo a height y suelta una bomba cada every segundos
    bomber: { height: 13, speed: 17, every: 0.2, radius: 1.9 },
    // Bomba nuclear: cuenta atrás y lo recoge todo (el campo y lo maduro de toda la granja)
    nuke: { countdown: 5 },
};
