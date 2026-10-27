import { L } from '../core/I18n.js';

// Rachas de bajas (como en Call of Duty): cada blanco recogido suma 1 a la racha y rellena la
// barra, que se vacía cada vez más deprisa; si llega a vaciarse, la racha se pierde. Al llegar
// a cada número se lanza su recompensa sola (las bajas que consigue también suman a la racha).
//   at       bajas seguidas que hacen falta
//   debugAt  las que hacen falta con la depuración de rachas (Ajustes → DEBUG)
export const KILLSTREAKS = [
    { id: 'grenade', at: 5, debugAt: 1, name: L('GRENADE', 'GRANADA') },
    { id: 'predator', at: 10, debugAt: 2, name: L('PREDATOR MISSILE', 'MISIL PREDATOR') },
    { id: 'bomber', at: 15, debugAt: 3, name: L('BOMBER', 'BOMBARDERO') },
    { id: 'nuke', at: 25, debugAt: 4, name: L('NUKE', 'BOMBA NUCLEAR') },
];
for (const k of KILLSTREAKS) k.normalAt = k.at;

// Depuración: rachas a 1, 2, 3 y 4 para probar cada recompensa enseguida
export function useDebugStreaks(on) {
    for (const k of KILLSTREAKS) k.at = on ? k.debugAt : k.normalAt;
}

export const KS = {
    // Barra de la racha: segundos para vaciarse = time * decay^(racha - 1), nunca menos de min
    bar: { time: 4, decay: 0.93, min: 1.5 },
    // Granada: vuela en arco hasta el blanco con más vecinos y recoge lo que pille en radius
    grenade: { radius: 2.6, flight: 0.9, arc: 4 },
    // Misil Predator: vista cenital desde height; baja solo a speed (boost con el gatillo) y se
    // guía moviendo la vista (steer: metros por unidad de giro)
    predator: { height: 48, speed: 7, boost: 32, steer: 9, radius: 5 },
    // Bombardero: cruza el campo a height y suelta una bomba cada every segundos
    bomber: { height: 13, speed: 17, every: 0.2, radius: 2.6 },
    // Bomba nuclear: cuenta atrás y lo recoge todo (el campo y lo maduro de toda la granja)
    nuke: { countdown: 5 },
};
